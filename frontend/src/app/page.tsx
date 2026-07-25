'use client';

import Image from 'next/image';
import { RainbowButton } from '@/components/ui/rainbow-button';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletProvider';

export default function Connection() {
    const router = useRouter();

    const { isConnected, connect, connecting, error } = useWallet();

    useEffect(() => {
        if (isConnected) router.push('/home/store');
    }, [isConnected]);

    return (
        <main className='h-dvh flex flex-col items-center justify-center gap-y-10'>
            <Image src={'/images/logo.svg'} alt='logo' width={120} height={100} />
            <h1 className='text-6xl font-bold'>
                The Ecommerce Warehouse <br /> Automation Run By Robots.{' '}
            </h1>
            <section className='flex items-center gap-x-3'>
                <h3 className='p-6 flex items-center gap-x-3 border border-tetriary rounded-full'>
                    <Image src={'/images/hedera.svg'} alt='hedera' width={40} height={40} />
                    Deployed on Hedera Testnet
                </h3>
                <h3 className='p-6 flex items-center gap-x-3 border border-tetriary rounded-full'>
                    <Image src={'/images/icons/energy.svg'} alt='energy' width={40} height={40} />
                    x402 payments settle before robots move
                </h3>
            </section>
            <RainbowButton
                className='mt-5 px-14 py-6 primary-button text-2xl font-normal'
                onClick={() => connect()}
                disabled={connecting}
            >
                <h3>{connecting ? 'Connecting…' : 'Connect Hedera Wallet'}</h3>
            </RainbowButton>
            {error && <p className='text-sm text-red'>{error}</p>}
        </main>
    );
}
