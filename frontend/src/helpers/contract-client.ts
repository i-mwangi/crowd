// Client-side interface to the hub. Order placement runs the x402 flow:
//  - a connected wallet (HashPack) signs the USDC payment in-browser, so the
//    customer approves it themselves and no key touches the server;
//  - otherwise the server-side buying agent pays (POST /api/agent/order).
// Either way payment settles on Hedera before the order is accepted.

import { productPricesUsdc, productWeightsKg } from '@/constants';

export interface PlacedOrder {
    digest: string;
    payment: {
        amountUsdc: number;
        transactionId: string;
        mode: 'live' | 'mock';
    };
}

// Wallet-signed path: run the x402 client in the browser against the
// protected /api/orders endpoint, with the connected wallet as the signer.
async function placeOrderWithWallet(
    orderId: string,
    productId: number
): Promise<PlacedOrder | null> {
    const { activeConnection } = await import('@/lib/wallet-connect');
    const connection = activeConnection();
    if (!connection) return null;

    const { x402Client } = await import('@x402/core/client');
    const { ExactHederaScheme } = await import('@x402/hedera/exact/client');
    const { wrapFetchWithPayment } = await import('@x402/fetch');

    const client = new x402Client().register(
        'hedera:*',
        new ExactHederaScheme(connection.paymentSigner as never)
    );
    const fetchWithPayment = wrapFetchWithPayment(fetch, client);

    const url = `/api/orders?order=${encodeURIComponent(orderId)}&product=${productId}`;
    const response = await fetchWithPayment(url, { method: 'POST' });
    const body = await response.json();

    if (!response.ok) {
        // A second 402 means the signed payment was rejected rather than the
        // challenge simply being unmet — almost always because the connected
        // wallet can't actually fund the transfer.
        if (response.status === 402) {
            throw new Error(
                `Wallet payment for ${connection.accountId} was rejected — check it holds enough USDC on testnet and approved the request.`
            );
        }
        throw new Error(body.error ?? `Order payment failed (${response.status})`);
    }

    return body as PlacedOrder;
}

export async function placeOrder(orderId: string, productId: number): Promise<PlacedOrder> {
    // Prefer the connected wallet; fall back to the server agent.
    const walletResult = await placeOrderWithWallet(orderId, productId);
    if (walletResult) return walletResult;

    const response = await fetch('/api/agent/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, productId }),
    });

    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? `Order payment failed (${response.status})`);

    return body as PlacedOrder;
}

export async function getProducts(): Promise<Product[]> {
    const response = await fetch('/api/products');
    const { stock } = (await response.json()) as { stock: number[] };

    return stock.map((amount, id) => ({
        id,
        stock: amount,
        priceUsdc: productPricesUsdc[id],
        weightKg: productWeightsKg[id],
    }));
}
