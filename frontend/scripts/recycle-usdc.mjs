// Returns circulated USDC to the customer wallet so the demo can keep running.
//
// Value flows one way through the system: the customer buys goods from the
// warehouse, and the warehouse buys robot labour from the fleet operator. The
// fleet never spends, so on testnet the customer eventually runs dry while the
// fleet accumulates. This sweeps earnings back to the customer, closing the
// loop without minting anything.
//
// Run from frontend/:  node scripts/recycle-usdc.mjs [customerAccountId]

import { readFileSync } from 'fs';
import { Client, PrivateKey, TransferTransaction, Hbar } from '@hashgraph/sdk';

const env = Object.fromEntries(
    readFileSync(new URL('../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
        .map((l) => {
            const i = l.indexOf('=');
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
);

const fleet = JSON.parse(readFileSync(new URL('../fleet.json', import.meta.url), 'utf8'));

const USDC = env.NEXT_PUBLIC_USDC_TOKEN ?? '0.0.5449';
const DECIMALS = 6;
const MIRROR = 'https://testnet.mirrornode.hedera.com';

// Default to the wallet created by create-customer.mjs.
const customer =
    process.argv[2] ??
    JSON.parse(readFileSync(new URL('../customer-wallet.json', import.meta.url), 'utf8')).accountId;

const balanceOf = async (accountId) => {
    const res = await fetch(`${MIRROR}/api/v1/accounts/${accountId}/tokens?token.id=${USDC}`);
    const entry = (await res.json()).tokens?.[0];
    return entry ? entry.balance : null;
};

// Leave a float behind so each party can still transact.
const FLOAT = Math.round(0.02 * 10 ** DECIMALS);

const sweep = async (fromId, fromKey, label) => {
    const balance = await balanceOf(fromId);
    if (balance === null) {
        console.log(`  ${label}: not associated — skipped`);
        return 0;
    }
    const amount = balance - FLOAT;
    if (amount <= 0) {
        console.log(`  ${label}: ${(balance / 10 ** DECIMALS).toFixed(6)} USDC — nothing spare`);
        return 0;
    }

    const client = Client.forTestnet()
        .setOperator(fromId, PrivateKey.fromStringECDSA(fromKey))
        .setDefaultMaxTransactionFee(new Hbar(20));
    try {
        await (
            await new TransferTransaction()
                .addTokenTransfer(USDC, fromId, -amount)
                .addTokenTransfer(USDC, customer, amount)
                .execute(client)
        ).getReceipt(client);
        console.log(`  ${label}: returned ${(amount / 10 ** DECIMALS).toFixed(6)} USDC`);
        return amount;
    } catch (error) {
        console.log(`  ${label}: transfer failed — ${error.message}`);
        return 0;
    } finally {
        client.close();
    }
};

console.log(`recycling USDC back to customer ${customer}\n`);

let total = 0;
total += await sweep(fleet.fleetOperator.accountId, fleet.fleetOperator.privateKey, 'fleet operator');
total += await sweep(env.HEDERA_OPERATOR_ID, env.HEDERA_OPERATOR_KEY, 'warehouse');

await new Promise((r) => setTimeout(r, 8000)); // mirror node lag
const now = await balanceOf(customer);
console.log(
    `\n  recovered ${(total / 10 ** DECIMALS).toFixed(6)} USDC — customer now holds ` +
        `${((now ?? 0) / 10 ** DECIMALS).toFixed(6)} USDC`
);
