// Checks a wallet's readiness to pay for orders, and tops it up with testnet
// USDC from the warehouse account.
//
// A wallet can only pay an x402 order if it has the USDC token ASSOCIATED and
// a balance. Association must be signed by the wallet itself, so that step has
// to happen in HashPack ("Add Token" -> 0.0.5449); funding can be done here.
//
// Run from frontend/:  node scripts/fund-wallet.mjs 0.0.xxxx [usdcAmount]

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

const target = process.argv[2];
const amountUsdc = Number(process.argv[3] ?? '0.1');
if (!target) {
    console.error('usage: node scripts/fund-wallet.mjs <accountId> [usdcAmount]');
    process.exit(1);
}

const USDC = env.NEXT_PUBLIC_USDC_TOKEN ?? '0.0.5449';
const MIRROR = 'https://testnet.mirrornode.hedera.com';
const DECIMALS = 6;

const tokenBalance = async (accountId) => {
    const res = await fetch(`${MIRROR}/api/v1/accounts/${accountId}/tokens?token.id=${USDC}`);
    if (!res.ok) return null;
    const entry = (await res.json()).tokens?.[0];
    return entry ? entry.balance : null; // null => not associated
};

const hbarBalance = async (accountId) => {
    const res = await fetch(`${MIRROR}/api/v1/accounts/${accountId}`);
    if (!res.ok) return null;
    return (await res.json()).balance?.balance ?? 0;
};

console.log(`wallet ${target}`);

const hbar = await hbarBalance(target);
if (hbar === null) {
    console.error('  account not found on testnet — is HashPack set to testnet?');
    process.exit(1);
}
console.log(`  HBAR : ${(hbar / 1e8).toFixed(4)}`);

const before = await tokenBalance(target);
if (before === null) {
    console.error(`  USDC : NOT ASSOCIATED`);
    console.error('');
    console.error(`  Associate the token in HashPack first (Add Token -> ${USDC}),`);
    console.error('  then run this script again to fund it. Association must be');
    console.error('  signed by the wallet itself, so it cannot be done from here.');
    process.exit(1);
}
console.log(`  USDC : ${(before / 10 ** DECIMALS).toFixed(6)}`);

const client = Client.forTestnet()
    .setOperator(env.HEDERA_OPERATOR_ID, PrivateKey.fromStringECDSA(env.HEDERA_OPERATOR_KEY))
    .setDefaultMaxTransactionFee(new Hbar(20));

const atomic = Math.round(amountUsdc * 10 ** DECIMALS);
console.log(`\nsending ${amountUsdc} USDC from ${env.HEDERA_OPERATOR_ID}...`);

try {
    const response = await new TransferTransaction()
        .addTokenTransfer(USDC, env.HEDERA_OPERATOR_ID, -atomic)
        .addTokenTransfer(USDC, target, atomic)
        .execute(client);
    await response.getReceipt(client);
    console.log(`  sent — tx ${response.transactionId.toString()}`);
} catch (error) {
    console.error(`  transfer failed: ${error.message}`);
    process.exit(1);
}

client.close();

// Mirror node lags a few seconds behind consensus.
await new Promise((r) => setTimeout(r, 8000));
const after = await tokenBalance(target);
console.log(`\n  USDC now: ${((after ?? 0) / 10 ** DECIMALS).toFixed(6)} — ready to place orders.`);
