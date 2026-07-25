// One-time: provision the robot fleet as independent on-chain parties.
//
// Creates:
//   - 1 fleet operator account  — the third party the warehouse rents robots
//     from, and which receives a micropayment per completed task.
//   - 15 robot accounts         — one per digital twin. Each robot signs its
//     OWN completion messages, so the mirror node's payer_account_id proves
//     which robot did the work. The warehouse cannot forge a completion.
//   - 1 task topic (HCS)        — the on-chain command bus: the hub publishes
//     TaskAssigned here, robots subscribe and publish TaskCompleted back.
//
// Robot keys are written to fleet.json (gitignored) rather than .env, since
// 15 keypairs would make .env unmanageable. Credentials are read from .env.
//
// Run from frontend/:  node scripts/provision-fleet.mjs

import { readFileSync, writeFileSync, existsSync } from 'fs';
import {
    Client,
    PrivateKey,
    AccountCreateTransaction,
    TopicCreateTransaction,
    Hbar,
} from '@hashgraph/sdk';

const env = Object.fromEntries(
    readFileSync(new URL('../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
        .map((l) => {
            const i = l.indexOf('=');
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
);

const FLEET_PATH = new URL('../fleet.json', import.meta.url);
if (existsSync(FLEET_PATH)) {
    console.error('fleet.json already exists — refusing to overwrite existing keys.');
    console.error('Delete it first if you really want to re-provision a new fleet.');
    process.exit(1);
}

const client = Client.forTestnet()
    .setOperator(env.HEDERA_OPERATOR_ID, PrivateKey.fromStringECDSA(env.HEDERA_OPERATOR_KEY))
    .setDefaultMaxTransactionFee(new Hbar(20));

const createAccount = async (initialHbar) => {
    const key = PrivateKey.generateECDSA();
    const receipt = await (
        await new AccountCreateTransaction()
            .setKeyWithoutAlias(key)
            .setInitialBalance(new Hbar(initialHbar))
            .execute(client)
    ).getReceipt(client);
    return { accountId: receipt.accountId.toString(), privateKey: key.toStringRaw() };
};

// 1. The fleet operator — receives per-task micropayments.
const operator = await createAccount(1);
console.log(`fleet operator      -> ${operator.accountId}`);

// 2. One account per robot. 2 HBAR each covers many HCS submits
//    (a topic message costs a fraction of a cent).
const types = ['Picking', 'Packing', 'Delivery'];
const robots = {};
for (const type of types) {
    for (let id = 0; id < 5; id++) {
        const account = await createAccount(2);
        robots[`${type}-${id}`] = account;
        console.log(`  ${type} robot #${id}  -> ${account.accountId}`);
    }
}

// 3. The task topic — the on-chain command bus.
const topicReceipt = await (
    await new TopicCreateTransaction()
        .setTopicMemo('crowd-robot-task-bus')
        .execute(client)
).getReceipt(client);
const taskTopic = topicReceipt.topicId.toString();
console.log(`task topic          -> ${taskTopic}`);

writeFileSync(
    FLEET_PATH,
    JSON.stringify({ fleetOperator: operator, taskTopic, robots }, null, 2) + '\n'
);
console.log('\nwrote fleet.json (gitignored — contains robot private keys)');

console.log('\n--- paste into frontend/.env ---');
console.log(`FLEET_OPERATOR_ACCOUNT=${operator.accountId}`);
console.log(`NEXT_PUBLIC_TASK_TOPIC=${taskTopic}`);

client.close();
