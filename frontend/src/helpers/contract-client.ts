// Client-side interface to the hub. Order placement runs the x402
// buying-agent flow: POST /api/agent/order drives 402 -> sign -> retry
// server-side, settling the payment on Hedera before the order is accepted.
// getProducts() reads live stock from the hub.

import { productPricesHbar } from '@/constants';

export interface PlacedOrder {
    digest: string;
    payment: {
        amountHbar: number;
        transactionId: string;
        mode: 'live' | 'mock';
    };
}

export async function placeOrder(orderId: string, productId: number): Promise<PlacedOrder> {
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
        priceHbar: productPricesHbar[id],
    }));
}
