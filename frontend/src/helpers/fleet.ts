// Robotics-as-a-Service settlement layer. Server-only: imported by route
// handlers and contract-server, never by client components.
//
// The warehouse does not own its robots — it rents them from a fleet operator
// and pays per COMPLETED task. The chain is the coordination layer:
//
//   1. dispatchTask()  — hub publishes TaskAssigned to the task topic. This is
//                        the command bus; robots subscribe to it directly, so
//                        no HTTP tunnel into the warehouse is required.
//   2. the robot       — executes, then publishes TaskCompleted signed by its
//                        OWN Hedera account (see robot-agent/).
//   3. settleTasks()   — reads the topic from the public mirror node, matches
//                        completions to assignments, and verifies that the
//                        completion's payer_account_id is the account of the
//                        robot that was actually assigned. Only then does it
//                        pay the fleet operator.
//
// The verification step is the point: the warehouse cannot fabricate a
// completion, because it does not hold the robot's key. No provable work,
// no payment.

import { readFile } from 'fs/promises';
import path from 'path';

import { productWeightsKg } from '@/constants';

export interface FleetTask {
    orderId: string;
    robotType: string;
    robotId: number;
    robotAccount: string;
    assignedAt: string; // consensus timestamp of the paid unlock
    /** Package weight the fee was priced from. */
    weightKg?: number;
    completedAt?: string;
    completedBy?: string; // payer_account_id of the completion message
    verified?: boolean;
    /** Completions published by someone other than the assigned robot. */
    forgeryAttempts?: number;
    rejectedReason?: string;
    /** Fee paid to unlock the task, in USDC. */
    feeUsdc?: number;
    paymentTx?: string;
}

interface FleetConfig {
    fleetOperator: { accountId: string };
    taskTopic: string;
    robots: Record<string, { accountId: string; privateKey: string }>;
}

const store = globalThis as unknown as {
    __crowdFleetConfig?: FleetConfig | null;
};

const taskKey = (orderId: string, robotType: string) => `${orderId}:${robotType}`;

/** Reads fleet.json (gitignored). Returns null when the fleet isn't provisioned. */
async function fleetConfig(): Promise<FleetConfig | null> {
    if (store.__crowdFleetConfig !== undefined) return store.__crowdFleetConfig;
    try {
        const raw = await readFile(path.join(process.cwd(), 'fleet.json'), 'utf8');
        store.__crowdFleetConfig = JSON.parse(raw) as FleetConfig;
    } catch {
        store.__crowdFleetConfig = null;
    }
    return store.__crowdFleetConfig;
}

export async function fleetEnabled(): Promise<boolean> {
    return Boolean(
        process.env.HEDERA_OPERATOR_ID &&
            process.env.HEDERA_OPERATOR_KEY &&
            process.env.FLEET_OPERATOR_ACCOUNT &&
            (await fleetConfig())
    );
}

export async function robotAccountFor(robotType: string, robotId: number): Promise<string | null> {
    const config = await fleetConfig();
    return config?.robots[`${robotType}-${robotId}`]?.accountId ?? null;
}

const mirrorUrl = () =>
    process.env.NEXT_PUBLIC_MIRROR_URL ?? 'https://testnet.mirrornode.hedera.com';

export interface TaskUnlock {
    unlocked: boolean;
    phase: string;
    robotId: number;
    robotAccount: string;
    weightKg: number;
    feeUsdc: number;
    paymentTx: string | null;
    unlockTx: string;
}

const PHASE_OF: Record<string, string> = {
    Picking: 'picking',
    Packing: 'packing',
    Delivery: 'delivery',
};

/**
 * Buys one robot task from the fleet operator over x402.
 *
 * The warehouse does not own these robots, so it cannot simply command them:
 * it calls the operator's resource server, receives a 402 quoting a fee based
 * on the package weight, pays it on Hedera, and only then is the robot
 * unlocked for that single task. Payment precedes work, and the price scales
 * with the labour — hauling 35 kg costs more than 2 kg.
 */
export async function purchaseTask(
    orderId: string,
    robotType: string,
    robotId: number,
    productId: number
): Promise<TaskUnlock | null> {
    if (!(await fleetEnabled())) return null;

    const phase = PHASE_OF[robotType];
    const weightKg = productWeightsKg[productId];
    if (!phase || weightKg == undefined) return null;

    const base = process.env.FLEET_SERVER_URL ?? 'http://localhost:4022';
    const url =
        `${base}/tasks/${phase}?order=${encodeURIComponent(orderId)}` +
        `&robot=${robotId}&product=${productId}&weight=${weightKg}`;

    try {
        const { createClientHederaSigner, PrivateKey } = await import('@x402/hedera');
        const { ExactHederaScheme } = await import('@x402/hedera/exact/client');
        const { x402Client } = await import('@x402/core/client');
        const { wrapFetchWithPayment } = await import('@x402/fetch');

        // The warehouse pays as itself — the same account that receives
        // customer payments now spends on robot labour.
        const signer = createClientHederaSigner(
            process.env.HEDERA_OPERATOR_ID as string,
            PrivateKey.fromStringECDSA(process.env.HEDERA_OPERATOR_KEY as string),
            { network: process.env.HEDERA_NETWORK ?? 'hedera:testnet' }
        );
        const client = new x402Client().register('hedera:*', new ExactHederaScheme(signer));
        const fetchWithPayment = wrapFetchWithPayment(fetch, client);

        const response = await fetchWithPayment(url, { method: 'POST' });
        if (!response.ok) {
            console.error(`[fleet] task purchase rejected (${response.status})`);
            return null;
        }
        return (await response.json()) as TaskUnlock;
    } catch (error) {
        console.error('[fleet] task purchase failed (non-fatal):', error);
        return null;
    }
}

interface BusMessage {
    payer: string;
    timestamp: string;
    body: Record<string, unknown>;
}

/** Reads the task bus from the public mirror node — anyone can audit this. */
async function readTaskBus(): Promise<BusMessage[]> {
    const config = await fleetConfig();
    if (!config) return [];

    const response = await fetch(
        `${mirrorUrl()}/api/v1/topics/${config.taskTopic}/messages?limit=200&order=desc`,
        { cache: 'no-store' }
    );
    if (!response.ok) return [];

    const data = (await response.json()) as {
        messages?: { payer_account_id: string; consensus_timestamp: string; message: string }[];
    };

    return (data.messages ?? []).flatMap((m) => {
        try {
            return [
                {
                    payer: m.payer_account_id,
                    timestamp: m.consensus_timestamp,
                    body: JSON.parse(Buffer.from(m.message, 'base64').toString()),
                },
            ];
        } catch {
            return [];
        }
    });
}

/**
 * Reads the task ledger off-chain-free: every entry is reconstructed from the
 * public task topic. Each task shows what was paid to unlock it (before the
 * work) and whether the assigned robot then proved completion by signing with
 * its own account. Nothing here moves money — payment already happened at the
 * x402 gate.
 */
export async function settleTasks(orderId?: string): Promise<FleetTask[]> {
    if (!(await fleetEnabled())) return [];

    const messages = await readTaskBus();

    const assignments = new Map<string, FleetTask>();
    for (const m of messages) {
        // Only a paid unlock counts as a task — it carries the x402
        // settlement that bought it.
        if (m.body.type !== 'TaskUnlocked') continue;
        const key = taskKey(String(m.body.order_id), String(m.body.robot_type));
        if (assignments.has(key)) continue; // newest wins (desc order)
        assignments.set(key, {
            orderId: String(m.body.order_id),
            robotType: String(m.body.robot_type),
            robotId: Number(m.body.robot_id),
            robotAccount: String(m.body.robot_account),
            assignedAt: m.timestamp,
            weightKg: Number(m.body.weight_kg ?? 0),
            feeUsdc: Number(m.body.fee_usdc ?? 0),
            paymentTx: m.body.payment_tx ? String(m.body.payment_tx) : undefined,
        });
    }

    for (const m of messages) {
        if (m.body.type !== 'TaskCompleted') continue;
        const key = taskKey(String(m.body.order_id), String(m.body.robot_type));
        const task = assignments.get(key);
        if (!task) continue;

        // The verification that makes payment trustworthy: a completion counts
        // only if it was signed by the account of the robot that was actually
        // assigned. Anyone can publish to the topic, so an unsigned-by-the-robot
        // message is recorded as a rejected attempt and otherwise ignored — it
        // can neither earn payment nor block the genuine completion.
        if (m.payer !== task.robotAccount) {
            task.forgeryAttempts = (task.forgeryAttempts ?? 0) + 1;
            task.rejectedReason = `completion from ${m.payer} ignored — not the assigned robot ${task.robotAccount}`;
            continue;
        }

        if (task.completedAt) continue; // already have the genuine completion

        task.completedAt = m.timestamp;
        task.completedBy = m.payer;
        task.verified = true;
    }

    const all = [...assignments.values()].sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
    return orderId ? all.filter((t) => t.orderId === orderId) : all;
}
