// One-time: tokenize warehouse inventory and robot digital twins on Hedera.
//
//  - 3 fungible HTS tokens  -> the products (Green/Purple/Blue Cube), supply 25
//  - 3 NFT collections      -> the robot twins (Picking/Packing/Delivery),
//                              5 serials each = 15 robots
//  - associates the buying agent with the product tokens so per-order
//    transfers settle without a separate association step
//
// Credentials are read from frontend/.env — nothing is hardcoded or printed.
// Run from frontend/:  node scripts/mint-tokens.mjs
// Copy the printed NEXT_PUBLIC_TOKEN_* / NEXT_PUBLIC_ROBOT_* lines into .env.

import { readFileSync } from 'fs';
import {
    Client,
    PrivateKey,
    TokenCreateTransaction,
    TokenMintTransaction,
    TokenAssociateTransaction,
    TokenType,
    TokenSupplyType,
    Hbar,
} from '@hashgraph/sdk';

// --- load .env (no dependency on dotenv) ---
const env = Object.fromEntries(
    readFileSync(new URL('../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
        .map((l) => {
            const i = l.indexOf('=');
            return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        })
);

const operatorId = env.HEDERA_OPERATOR_ID;
const operatorKey = PrivateKey.fromStringECDSA(env.HEDERA_OPERATOR_KEY);
const agentId = env.HEDERA_AGENT_ID;
const agentKey = PrivateKey.fromStringECDSA(env.HEDERA_AGENT_KEY);

const client = Client.forTestnet()
    .setOperator(operatorId, operatorKey)
    .setDefaultMaxTransactionFee(new Hbar(20));

const PRODUCTS = [
    { name: 'Green Cube', symbol: 'GRNCUBE' },
    { name: 'Purple Cube', symbol: 'PRPCUBE' },
    { name: 'Blue Cube', symbol: 'BLUCUBE' },
];

const ROBOTS = [
    { type: 'Picking', name: 'Crowd Picking Robot', symbol: 'CRWDPICK' },
    { type: 'Packing', name: 'Crowd Packing Robot', symbol: 'CRWDPACK' },
    { type: 'Delivery', name: 'Crowd Delivery Robot', symbol: 'CRWDDLVR' },
];

async function createFungible({ name, symbol }) {
    const receipt = await (
        await new TokenCreateTransaction()
            .setTokenName(name)
            .setTokenSymbol(symbol)
            .setTokenType(TokenType.FungibleCommon)
            .setDecimals(0)
            .setInitialSupply(25)
            .setTreasuryAccountId(operatorId)
            .setSupplyType(TokenSupplyType.Infinite)
            .setSupplyKey(operatorKey)
            .execute(client)
    ).getReceipt(client);
    return receipt.tokenId.toString();
}

async function createNftCollection({ name, symbol, type }) {
    const createReceipt = await (
        await new TokenCreateTransaction()
            .setTokenName(name)
            .setTokenSymbol(symbol)
            .setTokenType(TokenType.NonFungibleUnique)
            .setSupplyType(TokenSupplyType.Finite)
            .setMaxSupply(5)
            .setTreasuryAccountId(operatorId)
            .setSupplyKey(operatorKey)
            .execute(client)
    ).getReceipt(client);
    const tokenId = createReceipt.tokenId.toString();

    // One digital twin per robot (serials 1..5).
    await (
        await new TokenMintTransaction()
            .setTokenId(tokenId)
            .setMetadata(
                Array.from({ length: 5 }, (_, i) =>
                    Buffer.from(`${type} Robot #${i}`)
                )
            )
            .execute(client)
    ).getReceipt(client);

    return tokenId;
}

async function associateAgent(tokenIds) {
    const tx = await new TokenAssociateTransaction()
        .setAccountId(agentId)
        .setTokenIds(tokenIds)
        .freezeWith(client)
        .sign(agentKey);
    await (await tx.execute(client)).getReceipt(client);
}

const productIds = [];
for (const p of PRODUCTS) {
    const id = await createFungible(p);
    productIds.push(id);
    console.log(`  minted ${p.name} -> ${id}`);
}

const robotIds = [];
for (const r of ROBOTS) {
    const id = await createNftCollection(r);
    robotIds.push(id);
    console.log(`  minted ${r.name} collection (5 NFTs) -> ${id}`);
}

await associateAgent(productIds);
console.log(`  agent ${agentId} associated with product tokens`);

console.log('\n--- paste into frontend/.env ---');
console.log(`NEXT_PUBLIC_TOKEN_GREEN=${productIds[0]}`);
console.log(`NEXT_PUBLIC_TOKEN_PURPLE=${productIds[1]}`);
console.log(`NEXT_PUBLIC_TOKEN_BLUE=${productIds[2]}`);
console.log(`NEXT_PUBLIC_ROBOT_PICKING=${robotIds[0]}`);
console.log(`NEXT_PUBLIC_ROBOT_PACKING=${robotIds[1]}`);
console.log(`NEXT_PUBLIC_ROBOT_DELIVERY=${robotIds[2]}`);

client.close();
