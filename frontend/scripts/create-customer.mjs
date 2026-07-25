// Creates a ready-to-use CUSTOMER wallet for the demo.
//
// The buyer and the warehouse must be different accounts: an x402 payment from
// the merchant account to itself nets to zero and is rejected. This provisions
// a separate account, associates it with USDC, and funds it, so it can be
// imported into HashPack and used to pay for orders.
//
// Run from frontend/:  node scripts/create-customer.mjs [usdcAmount]

import { readFileSync, writeFileSync, existsSync } from 'fs';
import {
    Client,
    PrivateKey,
    AccountCreateTransaction,
    TokenAssociateTransaction,
    TransferTransaction,
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

const OUT = new URL('../customer-wallet.json', import.meta.url);
if (existsSync(OUT)) {
    console.error('customer-wallet.json already exists — delete it to create a new customer.');
    process.exit(1);
}

const USDC = env.NEXT_PUBLIC_USDC_TOKEN ?? '0.0.5449';
const DECIMALS = 6;
const amountUsdc = Number(process.argv[2] ?? '0.15');
const atomic = Math.round(amountUsdc * 10 ** DECIMALS);

const client = Client.forTestnet()
    .setOperator(env.HEDERA_OPERATOR_ID, PrivateKey.fromStringECDSA(env.HEDERA_OPERATOR_KEY))
    .setDefaultMaxTransactionFee(new Hbar(20));

// ECDSA so the key can be imported into HashPack.
const key = PrivateKey.generateECDSA();
const receipt = await (
    await new AccountCreateTransaction()
        .setKeyWithoutAlias(key)
        .setInitialBalance(new Hbar(5))
        .execute(client)
).getReceipt(client);

const accountId = receipt.accountId.toString();
console.log(`created customer account ${accountId} (5 HBAR)`);

// Associate USDC — signed by the new account itself.
const associate = await new TokenAssociateTransaction()
    .setAccountId(accountId)
    .setTokenIds([USDC])
    .freezeWith(client)
    .sign(key);
await (await associate.execute(client)).getReceipt(client);
console.log(`associated USDC ${USDC}`);

// Fund it from the warehouse account.
await (
    await new TransferTransaction()
        .addTokenTransfer(USDC, env.HEDERA_OPERATOR_ID, -atomic)
        .addTokenTransfer(USDC, accountId, atomic)
        .execute(client)
).getReceipt(client);
console.log(`funded with ${amountUsdc} USDC`);

writeFileSync(
    OUT,
    JSON.stringify({ accountId, privateKey: key.toStringRaw(), usdcToken: USDC }, null, 2) + '\n'
);

console.log('\n--- import this account into HashPack (testnet) ---');
console.log(`  account id  : ${accountId}`);
console.log(`  private key : ${key.toStringRaw()}`);
console.log('\nsaved to customer-wallet.json (gitignored).');
console.log('Testnet only — never reuse this key on mainnet.');

client.close();
