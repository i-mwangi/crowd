// An x402 ClientHederaSigner that stamps a human-readable memo on the payment.
//
// x402's own createClientHederaSigner builds the transfer without a memo, so
// the settlement shows up on HashScan as an unlabelled CRYPTOTRANSFER. The
// client is the party that builds and signs the body — the facilitator only
// adds its fee-payer signature — so a memo set here survives into the record
// and makes each payment self-describing next to the audit trail.
//
// The transaction is otherwise byte-for-byte what x402 would have produced.

const HBAR_ASSET = '0.0.0';
const MEMO_LIMIT = 100; // bytes, not characters

export const clampMemo = (memo: string): string => {
    const encoder = new TextEncoder();
    if (encoder.encode(memo).length <= MEMO_LIMIT) return memo;
    let out = '';
    for (const char of memo) {
        if (encoder.encode(out + char).length > MEMO_LIMIT) break;
        out += char;
    }
    return out;
};

interface PaymentRequirements {
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    extra?: { feePayer?: unknown };
}

export interface MemoSigner {
    readonly accountId: string;
    createPartiallySignedTransferTransaction(requirements: PaymentRequirements): Promise<string>;
}

export function createMemoClientSigner(
    accountId: string,
    privateKeyString: string,
    network: string,
    memo: string
): MemoSigner {
    return {
        accountId,
        async createPartiallySignedTransferTransaction(requirements): Promise<string> {
            const feePayer = requirements.extra?.feePayer;
            if (typeof feePayer !== 'string') {
                throw new Error('feePayer is required in paymentRequirements.extra');
            }

            const amount = BigInt(requirements.amount);
            if (amount <= BigInt(0)) throw new Error('amount must be greater than zero');

            const {
                AccountId,
                TokenId,
                Hbar,
                TransferTransaction,
                TransactionId,
                PrivateKey,
                createHederaClient,
            } = await import('@x402/hedera');

            const payer = AccountId.fromString(accountId);
            const payTo = AccountId.fromString(requirements.payTo);
            const tx = new TransferTransaction();

            if (requirements.asset === HBAR_ASSET) {
                tx.addHbarTransfer(payer, Hbar.fromTinybars((-amount).toString()));
                tx.addHbarTransfer(payTo, Hbar.fromTinybars(amount.toString()));
            } else {
                const tokenId = TokenId.fromString(requirements.asset);
                tx.addTokenTransfer(tokenId, payer, Number(-amount));
                tx.addTokenTransfer(tokenId, payTo, Number(amount));
            }

            // The facilitator pays the network fee, so the id is generated
            // against its account — matching x402's own signer.
            tx.setTransactionId(TransactionId.generate(AccountId.fromString(feePayer)));
            tx.setTransactionMemo(clampMemo(memo));

            const client = createHederaClient(requirements.network);
            try {
                tx.freezeWith(client);
                const signed = await tx.sign(PrivateKey.fromStringECDSA(privateKeyString));
                return Buffer.from(signed.toBytes()).toString('base64');
            } finally {
                client.close();
            }
        },
    };
}
