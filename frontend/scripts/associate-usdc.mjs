// Associates the accounts that receive USDC with the token, and reports
// balances. On Hedera an account must opt in to a token before it can hold it,
// so the fleet operator cannot be paid in USDC until this runs.
//
// Run from frontend/:  node scripts/associate-usdc.mjs

import { readFileSync } from 'fs';
import { Client, PrivateKey, TokenAssociateTransaction, Hbar } from '@hashgraph/sdk';

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
const MIRROR = 'https://testnet.mirrornode.hedera.com';

const client = Client.forTestnet()
    .setOperator(env.HEDERA_OPERATOR_ID, PrivateKey.fromStringECDSA(env.HEDERA_OPERATOR_KEY))
    .setDefaultMaxTransactionFee(new Hbar(20));

const balanceOf = async (accountId) => {
    const res = await fetch(`${MIRROR}/api/v1/accounts/${accountId}/tokens?token.id=${USDC}`);
    const data = await res.json();
    const entry = (data.tokens ?? [])[0];
    return entry ? entry.balance : null; // null = not associated
};

const parties = [
    { label: 'warehouse (receives customer payments)', accountId: env.HEDERA_OPERATOR_ID, key: env.HEDERA_OPERATOR_KEY },
    { label: 'buying agent (pays for goods)', accountId: env.HEDERA_AGENT_ID, key: env.HEDERA_AGENT_KEY },
    { label: 'fleet operator (receives robot fees)', accountId: fleet.fleetOperator.accountId, key: fleet.fleetOperator.privateKey },
];

console.log(`USDC token ${USDC}\n`);

for (const party of parties) {
    const before = await balanceOf(party.accountId);
    if (before !== null) {
        console.log(`  ${party.accountId}  already associated — ${(before / 1e6).toFixed(6)} USDC  (${party.label})`);
        continue;
    }
    try {
        const tx = await new TokenAssociateTransaction()
            .setAccountId(party.accountId)
            .setTokenIds([USDC])
            .freezeWith(client)
            .sign(PrivateKey.fromStringECDSA(party.key));
        await (await tx.execute(client)).getReceipt(client);
        console.log(`  ${party.accountId}  ASSOCIATED  (${party.label})`);
    } catch (error) {
        console.error(`  ${party.accountId}  association failed: ${error.message}`);
    }
}

console.log('\nspendable USDC:');
for (const party of parties) {
    const balance = await balanceOf(party.accountId);
    console.log(`  ${party.accountId}: ${balance === null ? 'not associated' : (balance / 1e6).toFixed(6) + ' USDC'}`);
}

client.close();
