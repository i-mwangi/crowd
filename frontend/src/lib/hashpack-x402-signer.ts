// An x402 ClientHederaSigner backed by a connected wallet (HashPack et al.).
//
// The x402 exact-Hedera scheme only needs a signer that returns a base64
// partially-signed TransferTransaction; it doesn't care how the signature was
// produced. This mirrors what @x402/hedera's createClientHederaSigner does with
// a raw private key, but delegates the actual signing to the wallet, so the
// customer approves the payment in their own wallet and no key touches the app.
//
// The SDK classes come from @x402/hedera's re-export of @hiero-ledger/sdk so
// the transaction instance matches what the wallet's DAppSigner expects.

import type { DAppSigner } from '@hashgraph/hedera-wallet-connect';

import { clampMemo } from '@/lib/memo-x402-signer';

// Matches @x402/hedera's ClientHederaSigner shape.
export interface ClientHederaSigner {
    readonly accountId: string;
    createPartiallySignedTransferTransaction(requirements: PaymentRequirements): Promise<string>;
}

interface PaymentRequirements {
    network: string;
    asset: string; // "0.0.0" for HBAR, otherwise a token id
    amount: string; // atomic units
    payTo: string;
    extra?: { feePayer?: unknown };
}

const HBAR_ASSET = '0.0.0';

export function createHashpackX402Signer(
    accountId: string,
    walletSigner: DAppSigner,
    /** Shown in the wallet's approval prompt and recorded on-chain. */
    memo = 'Crowd · Order payment'
): ClientHederaSigner {
    return {
        accountId,
        async createPartiallySignedTransferTransaction(requirements): Promise<string> {
            const feePayer = requirements.extra?.feePayer;
            if (typeof feePayer !== 'string') {
                throw new Error('feePayer is required in paymentRequirements.extra');
            }

            const amount = BigInt(requirements.amount);
            if (amount <= BigInt(0)) throw new Error('amount must be greater than zero');

            // Same SDK build the wallet library and x402 use.
            const { AccountId, TokenId, Hbar, TransferTransaction, TransactionId } = await import(
                '@x402/hedera'
            );

            const payer = AccountId.fromString(accountId);
            const payTo = AccountId.fromString(requirements.payTo);

            // Buyer and seller must be different parties: a transfer to self
            // nets to zero, leaves no positive receiver, and is rejected during
            // verification as an opaque 402. Fail loudly instead.
            if (payer.toString() === payTo.toString()) {
                throw new Error(
                    `Connected wallet ${accountId} is the merchant account — connect a different account to pay for an order.`
                );
            }

            const tx = new TransferTransaction();

            if (requirements.asset === HBAR_ASSET) {
                tx.addHbarTransfer(payer, Hbar.fromTinybars((-amount).toString()));
                tx.addHbarTransfer(payTo, Hbar.fromTinybars(amount.toString()));
            } else {
                const tokenId = TokenId.fromString(requirements.asset);
                tx.addTokenTransfer(tokenId, payer, Number(-amount));
                tx.addTokenTransfer(tokenId, payTo, Number(amount));
            }

            // The facilitator is the fee payer; the transfer is signed by the
            // customer's wallet only (partial signature).
            tx.setTransactionId(TransactionId.generate(AccountId.fromString(feePayer)));
            tx.setTransactionMemo(clampMemo(memo));

            // The wallet freezes and signs; the user approves in-wallet.
            const signed = await walletSigner.signTransaction(tx as never);
            return Buffer.from((signed as { toBytes(): Uint8Array }).toBytes()).toString('base64');
        },
    };
}
