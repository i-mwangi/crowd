// The x402-protected resource: placing a warehouse order.
// Payment settles on Hedera before the OrderReceived event is recorded.

import { NextRequest, NextResponse } from 'next/server';

import { productPricesHbar } from '@/constants';
import { receiveOrder } from '@/helpers/contract-server';
import { gateOrderPayment } from '@/helpers/x402';

export async function POST(request: NextRequest) {
    const url = new URL(request.url);
    const productId = Number(url.searchParams.get('product'));
    const orderId = url.searchParams.get('order') ?? '';

    if (!orderId) return NextResponse.json({ error: 'No order id was provided' }, { status: 400 });
    if (productPricesHbar[productId] == undefined)
        return NextResponse.json({ error: `Unknown product: ${productId}` }, { status: 404 });

    const gate = await gateOrderPayment(request);
    if (gate.kind === 'response') return gate.response;

    const digest = await receiveOrder(orderId, productId);

    return NextResponse.json(
        {
            digest,
            payment: {
                amountHbar: productPricesHbar[productId],
                transactionId: gate.payment.transactionId ?? '',
                mode: gate.payment.mode,
            },
        },
        { status: 201 }
    );
}
