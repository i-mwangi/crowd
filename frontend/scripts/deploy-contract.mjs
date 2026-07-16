// One-time: compile and deploy the warehouse order registry to Hedera testnet.
//
// The contract is the enforcement layer beneath the HCS audit trail: it
// rejects out-of-order fulfillment phases and draws robot assignments from
// Hedera's PRNG system contract.
//
// Credentials are read from frontend/.env — nothing is hardcoded or printed.
// Run from frontend/:  node scripts/deploy-contract.mjs
// Copy the printed NEXT_PUBLIC_REGISTRY_* lines into .env.

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import solc from 'solc';
import { Client, PrivateKey, ContractCreateFlow, Hbar } from '@hashgraph/sdk';

const env = Object.fromEntries(
    readFileSync(new URL('../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
        .map((l) => {
            const i = l.indexOf('=');
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
);

const SOURCE_PATH = fileURLToPath(new URL('../../contracts/WarehouseRegistry.sol', import.meta.url));
const ABI_PATH = fileURLToPath(new URL('../src/constants/registry-abi.json', import.meta.url));

// --- compile ---
const input = {
    language: 'Solidity',
    sources: { 'WarehouseRegistry.sol': { content: readFileSync(SOURCE_PATH, 'utf8') } },
    settings: {
        optimizer: { enabled: true, runs: 200 },
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

for (const error of output.errors ?? []) {
    if (error.severity === 'error') throw new Error(error.formattedMessage);
    console.warn(error.formattedMessage.trim());
}

const compiled = output.contracts['WarehouseRegistry.sol'].WarehouseRegistry;
const bytecode = compiled.evm.bytecode.object;
console.log(`compiled — bytecode ${(bytecode.length / 2 / 1024).toFixed(1)} kB`);

// The ABI is committed so the app can decode contract results.
mkdirSync(new URL('../src/constants/', import.meta.url), { recursive: true });
writeFileSync(ABI_PATH, JSON.stringify(compiled.abi, null, 2) + '\n');
console.log('wrote src/constants/registry-abi.json');

// --- deploy ---
const client = Client.forTestnet()
    .setOperator(env.HEDERA_OPERATOR_ID, PrivateKey.fromStringECDSA(env.HEDERA_OPERATOR_KEY))
    .setDefaultMaxTransactionFee(new Hbar(20));

const receipt = await (
    await new ContractCreateFlow().setGas(1_500_000).setBytecode(bytecode).execute(client)
).getReceipt(client);

const contractId = receipt.contractId.toString();
console.log(`deployed WarehouseRegistry -> ${contractId}`);

console.log('\n--- paste into frontend/.env ---');
console.log(`NEXT_PUBLIC_REGISTRY_CONTRACT=${contractId}`);

client.close();
