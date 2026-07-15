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

    const { createClientHederaSigner, PrivateKey } = await import('@x402/hedera');
    const { ExactHederaScheme } = await import('@x402/hedera/exact/client');

    const signer = createClientHederaSigner(
        process.env.HEDERA_AGENT_ID as string,
        PrivateKey.fromStringECDSA(process.env.HEDERA_AGENT_KEY as string),
        { network: process.env.HEDERA_NETWORK ?? 'hedera:testnet' }
    );
    const client = new x402Client().register('hedera:*', new ExactHederaScheme(signer));
    const fetchWithPayment = wrapFetchWithPayment(fetch, client);
    const httpClient = new x402HTTPClient(client);

    const response = await fetchWithPayment(orderUrl, { method: 'POST' });
    const body = await response.json();

    const settlement = httpClient.getPaymentSettleResponse((name) =>
        response.headers.get(name)
    );
    if (settlement?.transaction && body?.payment)
        body.payment.transactionId = settlement.transaction;

    return NextResponse.json(body, { status: response.status });
}
