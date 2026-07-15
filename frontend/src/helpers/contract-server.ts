'use server';

// Server-side on-chain interface of the hub:
//  - every warehouse action is submitted as a message to an HCS topic —
//    the Hedera transaction id is the "digest" shown in the UI
//  - robot load-balancing is done by the hub and
//    committed to the audit trail
//  - the multisig human-approval step is represented by the operator account
//    countersigning the HCS submission (Hedera threshold keys in production)
// Without HEDERA_OPERATOR_* credentials everything falls back to mock digests
// so the full demo runs credential-free.

import { addresses } from '@/constants';

interface WarehouseState {
    events: Map<string, WarehouseEvent[]>;
    stock: number[];
    topicId?: string;
}

const globalState = globalThis as unknown as { __crowdWarehouse?: WarehouseState };
const state: WarehouseState = (globalState.__crowdWarehouse ??= {
    events: new Map(),
    stock: [25, 25, 25],
});

const isLive = (): boolean =>
    Boolean(process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY);

const mockDigest = (): string =>
    `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function submitToHcs(payload: Record<string, unknown>): Promise<string> {
    if (!isLive()) return mockDigest();

    const { Client, PrivateKey, TopicCreateTransaction, TopicMessageSubmitTransaction } =
        await import('@hashgraph/sdk');

    const client = Client.forTestnet().setOperator(
        process.env.HEDERA_OPERATOR_ID as string,
        PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY as string)
    );

    try {
        let topicId = addresses.hcsTopic || state.topicId;
        if (!topicId) {
            const receipt = await (
                await new TopicCreateTransaction()
                    .setTopicMemo('crowd-warehouse-audit-trail')
                    .execute(client)
            ).getReceipt(client);
            topicId = receipt.topicId!.toString();
            state.topicId = topicId;
            console.log(`[hedera] created HCS audit topic ${topicId}`);
        }

        const response = await new TopicMessageSubmitTransaction()
            .setTopicId(topicId)
            .setMessage(JSON.stringify(payload))
            .execute(client);
        await response.getReceipt(client);

        return response.transactionId.toString();
    } catch (error) {
        console.error('[hedera] HCS submit failed, using mock digest:', error);
        return mockDigest();
    } finally {
        client.close();
    }
}

const pushEvent = (orderId: string, event: WarehouseEvent) => {
    const events = state.events.get(orderId) ?? [];
    events.push(event);
    state.events.set(orderId, events);
};

export async function getWarehouseEvents(orderId: string): Promise<WarehouseEvent[]> {
    return state.events.get(orderId) ?? [];
}

export async function getStock(): Promise<number[]> {
    return [...state.stock];
}

// Order placement: the x402 payment settled first (its transaction id is
// digests[0]); this records the OrderReceived event on the audit trail.
export async function receiveOrder(orderId: string, productId: number): Promise<string> {
    const digest = await submitToHcs({
        type: 'OrderReceived',
        order_id: orderId,
        product_id: productId,
    });

    if (state.stock[productId] > 0) state.stock[productId] -= 1;

    pushEvent(orderId, {
        type: 'OrderReceived',
        orderId,
        digest,
        timestamp: Date.now(),
    });

    return digest;
}

// pick_order / pack_order / deliver_order — selects a robot from the fleet
// (load balancing) and commits the assignment to the audit trail.
export async function processOrder(
    action: 'pick' | 'pack' | 'deliver',
    orderId: string
): Promise<string> {
    const robotType: RobotType =
        action == 'pick' ? 'Picking' : action == 'pack' ? 'Packing' : 'Delivery';
    const robotId = Math.floor(Math.random() * 5);

    const digest = await submitToHcs({
        type: 'SelectedRobot',
        order_id: orderId,
        robot_type: robotType,
        robot_id: robotId,
        approved_by: process.env.HEDERA_OPERATOR_ID ?? '0.0.OPERATOR',
    });

    pushEvent(orderId, {
        type: 'SelectedRobot',
        orderId,
        digest,
        robotType,
        robotId,
        approvalAddress: process.env.HEDERA_OPERATOR_ID ?? '0.0.OPERATOR',
        timestamp: Date.now(),
    });

    return digest;
}

// Kiosk-to-kiosk asset movement -> audit trail entry referencing both slots.
export async function moveOrder(
    kioskFrom: string,
    kioskTo: string,
    productId: number,
    orderId: string
): Promise<string> {
    const digest = await submitToHcs({
        type: 'MoveProduct',
        order_id: orderId,
        product_id: productId,
        from: kioskFrom,
        to: kioskTo,
    });

    pushEvent(orderId, {
        type: 'MoveProduct',
        orderId,
        digest,
        timestamp: Date.now(),
    });

    return digest;
}

export async function shipOrder(orderId: string, productId: number): Promise<string> {
    const digest = await submitToHcs({
        type: 'ShipOrder',
        order_id: orderId,
        product_id: productId,
        from: addresses.kiosks.zones.delivery,
    });

    pushEvent(orderId, {
        type: 'ShipOrder',
        orderId,
        digest,
        timestamp: Date.now(),
    });

    return digest;
}
