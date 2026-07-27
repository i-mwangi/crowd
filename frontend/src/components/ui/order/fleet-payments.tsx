'use client';

// Robotics-as-a-Service ledger for one order.
//
// The customer's payment buys the goods; these buy the labour. The warehouse
// rents its robots, so each fulfillment phase is unlocked by its own x402
// payment to the fleet operator — priced from the package weight and settled
// before the robot moves. Without this panel three of an order's four x402
// payments are invisible.

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { hashscanTx } from '@/constants';
import { cn } from '@/lib/utils';

interface FleetTask {
    robotType: string;
    robotId: number;
    weightKg?: number;
    feeUsdc?: number;
    paymentTx?: string;
    completedBy?: string;
    verified?: boolean;
}

interface FleetLedger {
    enabled: boolean;
    fleetOperator?: string;
    paidUsdc?: number;
    tasks: FleetTask[];
}

const PHASE_LABEL: Record<string, string> = {
    Picking: 'Product Pickup',
    Packing: 'Order Packing',
    Delivery: 'Parcel Delivery',
};

const ORDER: Record<string, number> = { Picking: 0, Packing: 1, Delivery: 2 };

interface Props {
    orderId: string;
    className?: string;
}

export default function FleetPayments({ orderId, className }: Props) {
    const [ledger, setLedger] = useState<FleetLedger>();

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const response = await fetch(`/api/fleet?orderId=${orderId}`);
                const data = (await response.json()) as FleetLedger;
                if (active) setLedger(data);
            } catch {
                /* keep the last good ledger */
            }
        };
        load();
        const interval = setInterval(load, 5_000);
        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [orderId]);

    if (!ledger?.enabled || !ledger.tasks?.length) return null;

    const tasks = [...ledger.tasks].sort(
        (a, b) => (ORDER[a.robotType] ?? 9) - (ORDER[b.robotType] ?? 9)
    );

    return (
        <section className={className}>
            <section className='mb-4 flex items-center gap-x-2.5 flex-wrap'>
                <h4>Robot Labour · x402</h4>
                <figure className='order-note'>
                    <Image src={'/images/icons/power.svg'} alt='power' height={8} width={8} />
                    <h6>Paid per task, before the robot moves</h6>
                </figure>
                <figure className='order-note'>
                    <Image src={'/images/icons/success.svg'} alt='total' height={8} width={8} />
                    <h6>
                        ${ledger.paidUsdc} USDC to fleet operator {ledger.fleetOperator}
                    </h6>
                </figure>
            </section>
            <section className='grid grid-cols-3 gap-x-3'>
                {tasks.map((task, index) => (
                    <figure
                        key={index}
                        className='p-4 flex flex-col gap-y-3 border border-secondary rounded-lg'
                    >
                        <div className='flex items-center justify-between'>
                            <h5 className='text-sm'>
                                {PHASE_LABEL[task.robotType] ?? task.robotType} · Robot #
                                {task.robotId}
                            </h5>
                            {task.paymentTx && (
                                <Link href={hashscanTx(task.paymentTx)} target='_blank'>
                                    <Image
                                        src={'/images/icons/side-arrow.svg'}
                                        alt='view payment'
                                        height={12}
                                        width={12}
                                    />
                                </Link>
                            )}
                        </div>

                        <div className='flex items-end gap-x-2'>
                            <h3 className='text-xl font-medium'>${task.feeUsdc}</h3>
                            <h6 className='text-xs text-secondary pb-1'>
                                USDC · {task.weightKg}kg
                            </h6>
                        </div>

                        <div
                            className={cn(
                                'w-fit text-xs',
                                task.verified ? 'green-background' : 'gray-background'
                            )}
                        >
                            {task.verified ? 'Work proven on-chain' : 'Awaiting proof'}
                        </div>

                        {task.completedBy && (
                            <h6 className='text-xs text-secondary'>
                                Signed by robot {task.completedBy}
                            </h6>
                        )}
                    </figure>
                ))}
            </section>
        </section>
    );
}
