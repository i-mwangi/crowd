// The robot command API. Each scenario performs kiosk-to-kiosk movements
// and robot selections, committed to the Hedera audit trail.

import { NextRequest, NextResponse } from 'next/server';

import { addresses } from '@/constants';

import { claimPhase, moveOrder, processOrder, shipOrder } from '@/helpers/contract-server';

export async function POST(request: NextRequest) {
    try {
        const { orderId, robotId, productId, processId } = await request.json();

        if (!orderId) throw new Error('No order id was provided');
        if (processId == undefined) throw new Error('Process id was not provided');
        if (processId > 3) throw new Error('Wrong process id');
        if (productId == undefined) throw new Error('No productId was provided');

        if (robotId == undefined && processId > 0) throw new Error('No robot id was provided');

        // Already executed (e.g. the same order page is open in two tabs):
        // acknowledge without re-running the phase.
        if (!(await claimPhase(orderId, processId))) return NextResponse.json({}, { status: 200 });

        const color: 'green' | 'purple' | 'blue' =
            productId == 0 ? 'green' : productId == 1 ? 'purple' : 'blue';

        switch (processId) {
            case 0:
                await processOrder('pick', orderId);
                break;
            case 1:
                await moveOrder(
                    addresses.kiosks.shelfs[color],
                    addresses.kiosks.pickingRobots[robotId],
                    productId,
                    orderId
                );
                await moveOrder(
                    addresses.kiosks.pickingRobots[robotId],
                    addresses.kiosks.zones.buffer,
                    productId,
                    orderId
                );
                await processOrder('pack', orderId);
                break;
            case 2:
                await moveOrder(
                    addresses.kiosks.zones.buffer,
                    addresses.kiosks.packingRobots[robotId],
                    productId,
                    orderId
                );
                await moveOrder(
                    addresses.kiosks.packingRobots[robotId],
                    addresses.kiosks.zones.packing,
                    productId,
                    orderId
                );
                await processOrder('deliver', orderId);
                break;
            case 3:
                await moveOrder(
                    addresses.kiosks.zones.packing,
                    addresses.kiosks.deliveringRobots[robotId],
                    productId,
                    orderId
                );
                await moveOrder(
                    addresses.kiosks.deliveringRobots[robotId],
                    addresses.kiosks.zones.delivery,
                    productId,
                    orderId
                );
                await shipOrder(orderId, productId);
                break;
        }

        return NextResponse.json({}, { status: 200 });
    } catch (error: any) {
        console.log(error);
        return NextResponse.json({ error: error?.message ?? 'error' }, { status: 500 });
    }
}
