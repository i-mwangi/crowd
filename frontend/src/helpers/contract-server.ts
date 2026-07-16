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
    executedPhases: Map<string, Set<number>>;
    stock: number[];
    topicId?: string;
}

const globalState = globalThis as unknown as { __crowdWarehouse?: WarehouseState };
const state: WarehouseState = (globalState.__crowdWarehouse ??= {
    events: new Map(),
    executedPhases: new Map(),
    stock: [25, 25, 25],
});

// Idempotency guard: each fulfillment phase may execute at most once per
// order, even if multiple clients orchestrate the same order concurrently.
export async function claimPhase(orderId: string, processId: number): Promise<boolean> {
    const phases = state.executedPhases.get(orderId) ?? new Set<number>();
    if (phases.has(processId)) return false;
    phases.add(processId);
    state.executedPhases.set(orderId, phases);
    return true;
}

const isLive = (): boolean =>
    Boolean(process.env.HEDERA_OPERATOR_ID && process.env.HEDERA_OPERATOR_KEY);

// The WarehouseRegistry contract enforces phase ordering and draws robot
// assignments from Hedera's PRNG. When configured it becomes the source of
// truth for those decisions; the HCS trail still records them for the UI.
const registryId = (): string => process.env.NEXT_PUBLIC_REGISTRY_CONTRACT ?? '';
const registryEnabled = (): boolean => isLive() && Boolean(registryId());

// Executes a registry function. Best-effort: a failure never blocks the demo,
// it falls back to hub-side behavior. Returns the tx id and (optionally) the
// contract's return value.
async function callRegistry(
    fn: string,
    build: (params: import('@hashgraph/sdk').ContractFunctionParameters) => import('@hashgraph/sdk').ContractFunctionParameters,
    wantsReturn: boolean
): Promise<{ txId: string; value?: number } | null> {
    if (!registryEnabled()) return null;

    const { Client, PrivateKey, ContractExecuteTransaction, ContractFunctionParameters } =
        await import('@hashgraph/sdk');

    const client = Client.forTestnet().setOperator(
        process.env.HEDERA_OPERATOR_ID as string,
        PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY as string)
    );

    try {
        const resp = await new ContractExecuteTransaction()
            .setContractId(registryId())
            .setGas(400_000)
            .setFunction(fn, build(new ContractFunctionParameters()))
            .execute(client);

        if (!wantsReturn) {
            await resp.getReceipt(client);
            return { txId: resp.transactionId.toString() };
        }

        const record = await resp.getRecord(client);
        return {
            txId: resp.transactionId.toString(),
            value: record.contractFunctionResult!.getUint32(0),
        };
    } catch (error) {
        console.error(`[hedera] registry ${fn} failed (non-fatal):`, error);
        return null;
    } finally {
        client.close();
    }
}

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

// Moves one unit of the tokenized product (HTS) from the shelf treasury to
// the buying agent — a real on-chain asset movement backing the order.
// Best-effort: token not configured / transfer failure never blocks the demo.
async function transferProductToken(productId: number): Promise<void> {
    const tokenId = addresses.products[productId];
    const agent = process.env.HEDERA_AGENT_ID;
    if (!isLive() || !agent || !tokenId || tokenId === '0.0.0') return;

    const { Client, PrivateKey, TransferTransaction } = await import('@hashgraph/sdk');
    const client = Client.forTestnet().setOperator(
        process.env.HEDERA_OPERATOR_ID as string,
        PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY as string)
    );
    try {
        await (
            await new TransferTransaction()
                .addTokenTransfer(tokenId, process.env.HEDERA_OPERATOR_ID as string, -1)
                .addTokenTransfer(tokenId, agent, 1)
                .execute(client)
        ).getReceipt(client);
    } catch (error) {
        console.error('[hedera] product token transfer failed (non-fatal):', error);
    } finally {
        client.close();
    }
}

// Order placement: the x402 payment settled first (its transaction id is
// digests[0]); this records the OrderReceived event on the audit trail and
// moves the tokenized product to the buyer.
export async function receiveOrder(orderId: string, productId: number): Promise<string> {
    const digest = await submitToHcs({
        type: 'OrderReceived',
        order_id: orderId,
        product_id: productId,
    });

    if (state.stock[productId] > 0) state.stock[productId] -= 1;

    // Register the order on-chain so the contract can enforce phase ordering
    // for the robot steps that follow.
    await callRegistry('receiveOrder', (p) => p.addString(orderId).addUint8(productId), false);
    await transferProductToken(productId);

    pushEvent(orderId, {
        type: 'OrderReceived',
        orderId,
        digest,
        timestamp: Date.now(),
    });

    return digest;
}

// pick_order / pack_order / deliver_order — the registry contract enforces
// that this phase follows the previous one and draws the robot from on-chain
// PRNG; the selection is then committed to the readable audit trail. Falls
// back to hub-side random selection when the contract isn't configured.
export async function processOrder(
    action: 'pick' | 'pack' | 'deliver',
    orderId: string
): Promise<string> {
    const robotType: RobotType =
        action == 'pick' ? 'Picking' : action == 'pack' ? 'Packing' : 'Delivery';
    const robotTypeEnum = action == 'pick' ? 0 : action == 'pack' ? 1 : 2;

    const enforced = await callRegistry(
        'selectRobot',
        (p) => p.addString(orderId).addUint8(robotTypeEnum),
        true
    );
    const robotId = enforced?.value ?? Math.floor(Math.random() * 5);

    const digest = await submitToHcs({
        type: 'SelectedRobot',
        order_id: orderId,
        robot_type: robotType,
        robot_id: robotId,
        selected_by: enforced ? `contract ${registryId()} (PRNG)` : 'hub',
        contract_tx: enforced?.txId ?? null,
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
    // Contract requires the order to have reached the Delivery phase.
    await callRegistry('shipOrder', (p) => p.addString(orderId), false);

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
