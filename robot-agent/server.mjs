// The fleet operator's x402 resource server — robot labour sold per task.
//
// This is an INDEPENDENT service run by the fleet operator. The warehouse is
// its customer, not its owner. Robot time is the paid resource:
//
//   POST /tasks/picking?order=X&robot=2&product=0&weight=2
//     unpaid  -> 402 with a payment-required challenge, priced from the
//                tariff and the package weight
//     paid    -> the robot is UNLOCKED for exactly that one task and the work
//                is dispatched to it over the on-chain task bus
//
// A robot performs no work that was not paid for: with no settled payment
// there is no unlock, and the agent ignores any task lacking one. Each unlock
// covers a single task and is consumed when the robot reports completion, so
// one payment can never buy two jobs.
//
// Run:  node robot-agent/server.mjs     (port 4022 by default)

import { createServer } from 'http';
import { readFileSync } from 'fs';
import {
    HTTPFacilitatorClient,
    x402HTTPResourceServer,
    x402ResourceServer,
} from '@x402/core/server';
import { ExactHederaScheme } from '@x402/hedera/exact/server';
import { Client, PrivateKey, TopicMessageSubmitTransaction } from '@hashgraph/sdk';

import { TARIFF, PHASES, feeFor, toAtomic, USDC_TOKEN } from './tariff.mjs';

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

const fleet = JSON.parse(readFileSync(new URL('../frontend/fleet.json', import.meta.url), 'utf8'));
const PORT = Number(process.env.FLEET_PORT ?? '4022');
const NETWORK = process.env.HEDERA_NETWORK ?? 'hedera:testnet';
const FACILITATOR = process.env.FACILITATOR_URL ?? 'https://api.testnet.blocky402.com';

// --- x402 resource server -------------------------------------------------
// Payments are made out to the fleet operator's own account. This server holds
// no key for settlement; the facilitator is the fee payer.

const core = new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR })).register(
    'hedera:*',
    new ExactHederaScheme()
);

const routes = Object.fromEntries(
    PHASES.map((phase) => [
        `POST /tasks/${phase}`,
        {
            description: `Unlock a ${phase} robot for one task — priced by package weight`,
            accepts: {
                scheme: 'exact',
                network: NETWORK,
                payTo: fleet.fleetOperator.accountId,
                maxTimeoutSeconds: 180,
                price: (ctx) => {
                    const weight = ctx.adapter.getQueryParam?.('weight');
                    // Priced and settled in USDC — a stable rate for labour.
                    return { asset: USDC_TOKEN, amount: toAtomic(feeFor(phase, weight)) };
                },
            },
        },
    ])
);

const x402Server = new x402HTTPResourceServer(core, routes);
await x402Server.initialize();

// --- robot dispatch -------------------------------------------------------
// Publishing to the task bus is what actually puts a robot to work. It happens
// only after payment settles, so the on-chain record of an unlock always
// carries the transaction that paid for it.

const hub = Client.forTestnet().setOperator(
    fleet.fleetOperator.accountId,
    PrivateKey.fromStringECDSA(fleet.fleetOperator.privateKey)
);

const PHASE_TO_TYPE = { picking: 'Picking', packing: 'Packing', delivery: 'Delivery' };

async function unlockRobot({ orderId, phase, robotId, productId, weightKg, feeUsdc, paymentTx }) {
    const robotType = PHASE_TO_TYPE[phase];
    const name = `${robotType}-${robotId}`;
    const robot = fleet.robots[name];
    if (!robot) throw new Error(`no such robot: ${name}`);

    const response = await new TopicMessageSubmitTransaction()
        .setTopicId(fleet.taskTopic)
        .setTransactionMemo(
            // Shown on HashScan's Summary tab, where the protocol TYPE is
            // always the generic "SUBMIT MESSAGE".
            clampMemo(`Crowd · ${robotType} robot #${robotId} unlocked · $${feeUsdc} USDC · order ${orderId}`)
        )
        .setMessage(
            JSON.stringify({
                type: 'TaskUnlocked',
                order_id: orderId,
                robot_type: PHASE_TO_TYPE[phase],
                robot_id: robotId,
                robot_account: robot.accountId,
                product_id: productId,
                weight_kg: weightKg,
                fee_usdc: feeUsdc,
                // Proof the work was paid for before it began.
                payment_tx: paymentTx ?? null,
            })
        )
        .execute(hub);
    await response.getReceipt(hub);
    return { unlockTx: response.transactionId.toString(), robotAccount: robot.accountId, robotType };
}

// --- HTTP plumbing --------------------------------------------------------

const adapterFor = (req, url) => ({
    getHeader: (name) => req.headers[name.toLowerCase()],
    getMethod: () => req.method,
    getPath: () => url.pathname,
    getUrl: () => url.toString(),
    getAcceptHeader: () => req.headers.accept ?? 'application/json',
    getUserAgent: () => req.headers['user-agent'] ?? '',
    getQueryParams: () => Object.fromEntries(url.searchParams.entries()),
    getQueryParam: (name) => url.searchParams.get(name) ?? undefined,
});

const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'content-type': 'application/json', ...headers });
    res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    // Public price list — how the warehouse sees what robot labour costs.
    if (req.method === 'GET' && url.pathname === '/tariff') {
        return send(res, 200, {
            fleetOperator: fleet.fleetOperator.accountId,
            currency: 'USDC',
            token: USDC_TOKEN,
            model: 'base call-out fee + rate per kg of package weight, in USDC',
            tariff: TARIFF,
        });
    }

    const match = url.pathname.match(/^\/tasks\/(picking|packing|delivery)$/);
    if (req.method !== 'POST' || !match) return send(res, 404, { error: 'not found' });

    const phase = match[1];
    const orderId = url.searchParams.get('order');
    const robotId = Number(url.searchParams.get('robot'));
    const productId = Number(url.searchParams.get('product'));
    const weightKg = Number(url.searchParams.get('weight'));

    if (!orderId || !Number.isInteger(robotId) || !Number.isFinite(weightKg)) {
        return send(res, 400, { error: 'order, robot and weight are required' });
    }

    let feeUsdc;
    try {
        feeUsdc = feeFor(phase, weightKg);
    } catch (error) {
        return send(res, 400, { error: error.message });
    }

    // --- the x402 gate: no payment, no robot ---
    const result = await x402Server.processHTTPRequest({
        adapter: adapterFor(req, url),
        path: url.pathname,
        method: req.method,
        paymentHeader: req.headers['payment-signature'] ?? req.headers['x-payment'],
    });

    if (result.type === 'payment-error') {
        const { status, headers, body } = result.response;
        console.log(`  402 ${phase} ${orderId} — quoted $${feeUsdc} USDC for ${weightKg} kg`);
        return send(res, status, body ?? {}, headers);
    }

    let paymentTx = null;
    if (result.type === 'payment-verified') {
        const settlement = await x402Server.processSettlement(
            result.paymentPayload,
            result.paymentRequirements,
            result.declaredExtensions
        );
        if (!settlement.success) {
            return send(res, 402, { error: 'settlement failed', reason: settlement.errorReason });
        }
        paymentTx = settlement.transaction ?? null;
    }

    // Paid — unlock the robot for this one task and dispatch it.
    try {
        const { unlockTx, robotAccount } = await unlockRobot({
            orderId,
            phase,
            robotId,
            productId,
            weightKg,
            feeUsdc,
            paymentTx,
        });
        console.log(
            `  ✓ paid $${feeUsdc} USDC (${weightKg} kg) — unlocked ${PHASE_TO_TYPE[phase]} #${robotId} for ${orderId}`
        );
        return send(res, 200, {
            unlocked: true,
            phase,
            orderId,
            robotId,
            robotAccount,
            weightKg,
            feeUsdc,
            paymentTx,
            unlockTx,
        });
    } catch (error) {
        console.error('  ! dispatch failed:', error.message);
        return send(res, 500, { error: error.message });
    }
}).listen(PORT, () => {
    console.log(`fleet operator ${fleet.fleetOperator.accountId}`);
    console.log(`selling robot labour on http://localhost:${PORT}`);
    console.log(`tariff: ${JSON.stringify(TARIFF)}\n`);
});
