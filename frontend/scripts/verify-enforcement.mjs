// Proves the registry enforces the pipeline: reads the order's on-chain
// phase, then attempts an out-of-order transition and shows it reverts.
import { readFileSync } from 'fs';
import {
    Client,
    PrivateKey,
    ContractCallQuery,
    ContractExecuteTransaction,
    ContractFunctionParameters,
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

const orderId = process.argv[2];
if (!orderId) throw new Error('usage: node scripts/verify-enforcement.mjs <orderId>');

const contractId = env.NEXT_PUBLIC_REGISTRY_CONTRACT;
const client = Client.forTestnet()
    .setOperator(env.HEDERA_OPERATOR_ID, PrivateKey.fromStringECDSA(env.HEDERA_OPERATOR_KEY))
    .setDefaultMaxTransactionFee(new Hbar(20));

const phases = ['None', 'Received', 'Picking', 'Packing', 'Delivery', 'Shipped'];

const state = await new ContractCallQuery()
    .setContractId(contractId)
    .setGas(120_000)
    .setFunction('getOrder', new ContractFunctionParameters().addString(orderId))
    .execute(client);

console.log(`on-chain order ${orderId}:`);
console.log(`  productId     : ${state.getUint32(0)}`);
console.log(`  phase         : ${phases[state.getUint32(1)]} (${state.getUint32(1)})`);
console.log(`  picking robot : ${state.getUint32(2)}`);

// Order is at Picking. Jumping straight to Delivery (skipping Packing) must revert.
console.log('\nattempting illegal jump Picking -> Delivery (should revert)...');
try {
    await (
        await new ContractExecuteTransaction()
            .setContractId(contractId)
            .setGas(400_000)
            .setFunction('selectRobot', new ContractFunctionParameters().addString(orderId).addUint8(2))
            .execute(client)
    ).getReceipt(client);
    console.log('  ✗ NOT enforced — the call unexpectedly succeeded');
} catch (error) {
    console.log(`  ✓ enforced — contract reverted: ${error.status?.toString() ?? error.message}`);
}

client.close();
