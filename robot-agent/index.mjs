// The rented robot fleet.
//
// This process belongs to the FLEET OPERATOR, not the warehouse. It holds one
// Hedera key per robot and does three things:
//
//   1. subscribes to the task topic — robots receive work from the chain, so
//      the warehouse never needs a tunnel into the fleet's network
//   2. executes the task (optionally driving a real Webots robot)
//   3. publishes TaskCompleted SIGNED BY THAT ROBOT'S OWN ACCOUNT
//
// Step 3 is what makes the payment trustworthy: the warehouse holds no robot
// key, so it cannot fabricate a completion to avoid or fake a payment. The
// mirror node records payer_account_id on every message, making the claim
// attributable to exactly one robot.
//
// Run from the repo root:  node robot-agent/index.mjs

import { readFileSync } from 'fs';
import {
    Client,
    PrivateKey,
    TopicMessageQuery,
    TopicMessageSubmitTransaction,
} from '@hashgraph/sdk';

// Hedera memos are capped at 100 BYTES; the separator below is multi-byte.
const clampMemo = (memo) => {
    const encoder = new TextEncoder();
    if (encoder.encode(memo).length <= 100) return memo;
    let out = '';
    for (const char of memo) {
        if (encoder.encode(out + char).length > 100) break;
        out += char;
    }
    return out;
};

const fleet = JSON.parse(
    readFileSync(new URL('../frontend/fleet.json', import.meta.url), 'utf8')
);

// How long a robot "works" before reporting completion. Real hardware would
// report when the physical task finishes; see robot-sim/ for that path.
const WORK_MS = Number(process.env.ROBOT_WORK_MS ?? '6000');

const listener = Client.forTestnet(); // listening needs no account
const handled = new Set();

const robotClient = (robotKey) => {
    const client = Client.forTestnet();
    client.setOperator(robotKey.accountId, PrivateKey.fromStringECDSA(robotKey.privateKey));
    return client;
};

async function completeTask(task, robotKey) {
    const client = robotClient(robotKey);
    try {
        const response = await new TopicMessageSubmitTransaction()
            .setTopicId(fleet.taskTopic)
            .setTransactionMemo(
                clampMemo(`Crowd · ${task.robot_type} robot #${task.robot_id} completed · order ${task.order_id}`)
            )
            .setMessage(
                JSON.stringify({
                    type: 'TaskCompleted',
                    order_id: task.order_id,
                    robot_type: task.robot_type,
                    robot_id: task.robot_id,
                    // Signed by this robot's own account — the warehouse
                    // cannot produce this message.
                    robot_account: robotKey.accountId,
                })
            )
            .execute(client);
        await response.getReceipt(client);
        console.log(
            `  ✓ ${task.robot_type} #${task.robot_id} completed ${task.order_id} ` +
                `— signed by ${robotKey.accountId}`
        );
    } catch (error) {
        console.error(`  ✗ ${task.robot_type} #${task.robot_id} failed to report:`, error.message);
    } finally {
        client.close();
    }
}

console.log(`fleet operator ${fleet.fleetOperator.accountId}`);
console.log(`${Object.keys(fleet.robots).length} robots listening on task topic ${fleet.taskTopic}\n`);

new TopicMessageQuery()
    .setTopicId(fleet.taskTopic)
    .setStartTime(Date.now() / 1000) // only new work; ignore history
    .subscribe(listener, null, async (message) => {
        let task;
        try {
            task = JSON.parse(Buffer.from(message.contents).toString());
        } catch {
            return;
        }
        // A robot works only on payment-backed unlocks. TaskAssigned alone —
        // which the warehouse can publish freely — is not authorisation; the
        // unlock is issued by the fleet operator once x402 settlement clears
        // and carries the transaction that paid for it.
        if (task.type !== 'TaskUnlocked') return;
        if (!task.payment_tx) {
            console.log(`  ⨯ ignoring unlock for ${task.order_id} — no payment attached`);
            return;
        }

        const id = `${task.order_id}:${task.robot_type}`;
        if (handled.has(id)) return;
        handled.add(id);

        const name = `${task.robot_type}-${task.robot_id}`;
        const robotKey = fleet.robots[name];
        if (!robotKey) {
            console.error(`  ! no key for ${name} — ignoring task`);
            return;
        }

        console.log(
            `→ ${task.robot_type} #${task.robot_id} unlocked for ${task.order_id} ` +
                `— ${task.weight_kg} kg, paid $${task.fee_usdc} USDC — working...`
        );

        setTimeout(() => completeTask(task, robotKey), WORK_MS);
    });

process.on('SIGINT', () => {
    console.log('\nfleet agent stopped.');
    process.exit(0);
});
