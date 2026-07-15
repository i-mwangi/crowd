import type { Metadata } from 'next';
import { Geist } from 'next/font/google';

import WalletProvider from '@/context/WalletProvider';

import 'react-loading-skeleton/dist/skeleton.css';
import './globals.css';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Crowd',
    description: 'Warehouse robotic automation on Hedera with x402 pay-before-fulfillment',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='en'>
            <WalletProvider>
                <body className={`${geist.className} antialiased`}>{children}</body>
            </WalletProvider>
        </html>
    );
}
