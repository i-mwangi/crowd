// Real Hedera wallet connection via WalletConnect (HashPack and any other
// HIP-820 wallet). Browser-only: everything here is dynamically imported so it
// never runs during SSR or the production build.
//
// When NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is unset the app falls back to the
// server-managed agent account (see WalletProvider), so the demo still runs
// without wallet setup.

import type { ClientHederaSigner } from '@/lib/hashpack-x402-signer';

interface Connection {
    accountId: string;
    topic: string;
    // Produces an x402 signer backed by the connected wallet.
    paymentSigner: ClientHederaSigner;
    disconnect: () => Promise<void>;
}

// Module singleton — the order flow reads the live connection from here.
const state = globalThis as unknown as { __crowdWallet?: Connection | null };

export const projectId = (): string =>
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '';

export const walletConnectEnabled = (): boolean => Boolean(projectId());

export const activeConnection = (): Connection | null => state.__crowdWallet ?? null;

const APP_METADATA = {
    name: 'Crowd',
    description: 'Warehouse robotics on Hedera with x402 pay-before-fulfillment',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://crowd.local',
    icons: [
        typeof window !== 'undefined'
            ? `${window.location.origin}/images/logo.svg`
            : 'https://crowd.local/logo.svg',
    ],
};

/**
 * Opens the wallet-selection modal and establishes a session. Returns the
 * connected account id. Throws if the user cancels or no wallet is available.
 */
export async function connectWallet(): Promise<string> {
    if (!walletConnectEnabled()) {
        throw new Error('WalletConnect project id not configured');
    }

    const {
        DAppConnector,
        HederaChainId,
        HederaJsonRpcMethod,
        HederaSessionEvent,
    } = await import('@hashgraph/hedera-wallet-connect');
    // The wallet library builds on @hiero-ledger/sdk; use the same SDK for the
    // types we hand it, so instances match at both type- and runtime level.
    const { LedgerId } = await import('@hiero-ledger/sdk');

    const connector = new DAppConnector(
        APP_METADATA,
        LedgerId.TESTNET,
        projectId(),
        Object.values(HederaJsonRpcMethod),
        [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
        [HederaChainId.Testnet]
    );

    await connector.init({ logger: 'error' });
    const session = await connector.openModal();

    // account strings look like "hedera:testnet:0.0.1234" — take the id.
    const account = session.namespaces?.hedera?.accounts?.[0];
    const accountId = account?.split(':').pop();
    if (!accountId) throw new Error('wallet returned no account');

    const { AccountId } = await import('@hiero-ledger/sdk');
    const signer = connector.getSigner(AccountId.fromString(accountId));

    const { createHashpackX402Signer } = await import('@/lib/hashpack-x402-signer');

    state.__crowdWallet = {
        accountId,
        topic: session.topic,
        paymentSigner: createHashpackX402Signer(accountId, signer),
        disconnect: async () => {
            try {
                await connector.disconnect(session.topic);
            } finally {
                state.__crowdWallet = null;
            }
        },
    };

    return accountId;
}

export async function disconnectWallet(): Promise<void> {
    await state.__crowdWallet?.disconnect();
    state.__crowdWallet = null;
}
