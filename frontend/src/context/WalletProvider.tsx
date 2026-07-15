'use client';

// Wallet connection context. The dapp
// connects to the server-managed Hedera buying-agent account (the x402
// payer); only the account id ever reaches the browser. A HashPack /
// WalletConnect integration can be dropped in behind the same interface.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface WalletState {
    address: string | undefined;
    network: string;
    isConnected: boolean;
    /** true only once the persisted session has been checked */
    isDisconnected: boolean;
    connect: () => Promise<void>;
    disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
    address: undefined,
    network: 'hedera:testnet',
    isConnected: false,
    isDisconnected: true,
    connect: async () => {},
    disconnect: () => {},
});

export const useWallet = () => useContext(WalletContext);

function HederaProvider({ children }: { children: React.ReactNode }) {
    const [address, setAddress] = useState<string>();
    const [network, setNetwork] = useState('hedera:testnet');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('hedera:wallet');
        if (saved) setAddress(saved);
        setReady(true);
    }, []);

    const connect = useCallback(async () => {
        const response = await fetch('/api/wallet');
        const data = await response.json();

        localStorage.setItem('hedera:wallet', data.address);
        setAddress(data.address);
        setNetwork(data.network);
    }, []);

    const disconnect = useCallback(() => {
        localStorage.removeItem('hedera:wallet');
        setAddress(undefined);
    }, []);

    return (
        <WalletContext.Provider
            value={{
                address,
                network,
                isConnected: Boolean(address),
                isDisconnected: ready && !address,
                connect,
                disconnect,
            }}
        >
            {children}
        </WalletContext.Provider>
    );
}

export default HederaProvider;
