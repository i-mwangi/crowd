// The buying agent (x402 reference architecture: software pays software).
// Drives the 402 -> sign -> retry flow against POST /api/orders using the
// agent's Hedera key, which stays server-side and never reaches the browser.

import { NextRequest, NextResponse } from 'next/server';
import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client, x402HTTPClient } from '@x402/core/client';

import { isLivePayments } from '@/helpers/x402';

export async function POST(request: NextRequest) {
    const { orderId, productId } = await request.json().catch(() => ({}));
    if (!orderId || productId == undefined)
        return NextResponse.json({ error: 'orderId and productId are required' }, { status: 400 });

    const origin = new URL(request.url).origin;
    const orderUrl = `${origin}/api/orders?order=${encodeURIComponent(
        orderId
    )}&product=${productId}`;

    // Mock mode: the resource server skips the gate, plain fetch is enough.
    if (!isLivePayments()) {
        const response = await fetch(orderUrl, { method: 'POST' });
        return NextResponse.json(await response.json(), { status: response.status });
    }

    const { ExactHederaScheme } = await import('@x402/hedera/exact/client');
    const { createMemoClientSigner } = await import('@/lib/memo-x402-signer');

    // Memo so the goods payment is identifiable on HashScan rather than
    // appearing as an unlabelled transfer.
    const signer = createMemoClientSigner(
        process.env.HEDERA_AGENT_ID as string,
        process.env.HEDERA_AGENT_KEY as string,
        process.env.HEDERA_NETWORK ?? 'hedera:testnet',
        `Crowd · Order payment · product ${productId} · order ${orderId}`
    );
    const client = new x402Client().register(
        'hedera:*',
        new ExactHederaScheme(signer as never)
    );
    const fetchWithPayment = wrapFetchWithPayment(fetch, client);
    const httpClient = new x402HTTPClient(client);

    const response = await fetchWithPayment(orderUrl, { method: 'POST' });
    const body = await response.json();

    // The settlement transaction id normally arrives in the response body
    // (set by the payment gate); the header is only present when the resource
    // server echoes it, so treat it as an optional enrichment.
    try {
        const settlement = httpClient.getPaymentSettleResponse((name) =>
            response.headers.get(name)
        );
        if (settlement?.transaction && body?.payment)
            body.payment.transactionId = settlement.transaction;
    } catch {
        /* body.payment.transactionId already set by the gate */
    }

    return NextResponse.json(body, { status: response.status });
}
