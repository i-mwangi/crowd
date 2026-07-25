// Robotics-as-a-Service ledger. Reconciles the on-chain task bus and pays the
// fleet operator for each task whose completion was signed by the assigned
// robot. Polled by the order page.

import { NextRequest, NextResponse } from 'next/server';

import { fleetEnabled, settleTasks } from '@/helpers/fleet';

export async function GET(request: NextRequest) {
    if (!(await fleetEnabled())) {
        return NextResponse.json({ enabled: false, tasks: [] });
    }

    const orderId = new URL(request.url).searchParams.get('orderId') ?? undefined;
    const tasks = await settleTasks(orderId);

    return NextResponse.json({
        enabled: true,
        fleetOperator: process.env.FLEET_OPERATOR_ACCOUNT,
        currency: 'USDC',
        paidUsdc: Number(
            tasks.filter((t) => t.paymentTx).reduce((sum, t) => sum + (t.feeUsdc ?? 0), 0).toFixed(6)
        ),
        tasks,
    });
}
