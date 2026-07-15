// Session wallet endpoint:
// the dapp "connects" to the Hedera buying-agent account managed server-side
// (the account that pays x402 order settlements). Only the account id is
// exposed — the key never leaves the server.

import { NextResponse } from 'next/server';

export async function GET() {
    const accountId = process.env.HEDERA_AGENT_ID ?? '';
    return NextResponse.json({
        address: accountId || `0.0.MOCK${Math.floor(Math.random() * 10000)}`,
        live: Boolean(accountId),
        network: process.env.HEDERA_NETWORK ?? 'hedera:testnet',
    });
}
