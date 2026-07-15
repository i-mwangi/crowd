// The order page polls this endpoint for warehouse events
// (SelectedRobot / MoveProduct / ShipOrder) recorded by the
// hub on the HCS audit trail.

import { NextRequest, NextResponse } from 'next/server';

import { getWarehouseEvents } from '@/helpers/contract-server';

export async function GET(request: NextRequest) {
    const orderId = new URL(request.url).searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });

    return NextResponse.json({ events: await getWarehouseEvents(orderId) });
}
