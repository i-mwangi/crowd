'use client';

// Wallet connection context.
//
// With NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID set, "Connect" opens the
// WalletConnect modal and the customer connects a real Hedera wallet
// (HashPack et al.); that wallet then signs the x402 order payment itself.
//
// Without a project id it falls back to the server-managed agent account, so
// the demo still runs with no wallet setup. `walletSigned` tells callers which
// mode is live, so the order flow knows whether to sign in-browser.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface WalletState {
    address: string | undefined;
    network: string;
    isConnected: boolean;
    /** true only once the persisted session has been checked */
    isDisconnected: boolean;
    /** true when a real wallet is connected and will sign payments itself */
    walletSigned: boolean;
    connecting: boolean;
    error: string | undefined;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
    address: undefined,
    network: 'hedera:testnet',
    isConnected: false,
    isDisconnected: true,
    walletSigned: false,
    connecting: false,
    error: undefined,
    connect: async () => {},
    disconnect: () => {},
});

export const useWallet = () => useContext(WalletContext);

function HederaProvider({ children }: { children: React.ReactNode }) {
    const [address, setAddress] = useState<string>();
    const [network] = useState('hedera:testnet');
    const [ready, setReady] = useState(false);
    const [walletSigned, setWalletSigned] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string>();

    useEffect(() => {
        const saved = localStorage.getItem('hedera:wallet');
        if (saved) setAddress(saved);
        // A real wallet session isn't restored across reloads here, so a
        // persisted address from a prior WalletConnect run reverts to the
        // server-agent path until the user reconnects.
        setReady(true);
    }, []);

    const connect = useCallback(async () => {
        setError(undefined);
        setConnecting(true);
        try {
            const { walletConnectEnabled, connectWallet } = await import('@/lib/wallet-connect');

            if (walletConnectEnabled()) {
                // Guard against a silent hang (unreachable relay, closed modal
                // without event) so the button never sticks on "Connecting…".
                const accountId = await Promise.race([
                    connectWallet(),
                    new Promise<never>((_, reject) =>
                        setTimeout(
                            () => reject(new Error('Wallet connection timed out — is HashPack open?')),
                            90_000
                        )
                    ),
                ]);
                localStorage.setItem('hedera:wallet', accountId);
                setAddress(accountId);
                setWalletSigned(true);
                return;
            }

            // Fallback: server-managed agent account.
            const response = await fetch('/api/wallet');
            const data = await response.json();
            localStorage.setItem('hedera:wallet', data.address);
            setAddress(data.address);
            setWalletSigned(false);
        } catch (err) {
            // WalletConnect rejects with plain objects that stringify to "{}",
            // so dig for anything human-readable before giving up.
            const detail =
                err instanceof Error
                    ? err.message
                    : typeof err === 'string'
                      ? err
                      : ((err as { message?: string; reason?: string })?.message ??
                        (err as { reason?: string })?.reason ??
                        JSON.stringify(err));
            console.error('[wallet] connection failed:', err);
            setError(detail && detail !== '{}' ? detail : 'Wallet connection failed or was rejected');
        } finally {
            setConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        void import('@/lib/wallet-connect').then((m) => m.disconnectWallet()).catch(() => {});
        localStorage.removeItem('hedera:wallet');
        setAddress(undefined);
        setWalletSigned(false);
    }, []);

    return (
        <WalletContext.Provider
            value={{
                address,
                network,
                isConnected: Boolean(address),
                isDisconnected: ready && !address,
                walletSigned,
                connecting,
                error,
                connect,
                disconnect,
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export default HederaProvider;
