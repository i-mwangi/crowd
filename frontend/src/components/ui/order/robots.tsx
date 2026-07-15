'use client';

import Link from 'next/link';
import Image from 'next/image';
import { CopyButton } from '@/components/ui/copy-button';

import { addresses, hashscanTx } from '@/constants';

import { sliceDigest } from '@/utils/formatter';
import { cn } from '@/lib/utils';

interface Props {
    order: Order;
    className?: string;
}

export default function Robots({ order, className }: Props) {
    return (
        <section className={cn('flex flex-col gap-y-4', className)}>
            <section className='flex items-center gap-x-2.5 col-span-3'>
                <h4>Load Assignment</h4>
                <figure className='order-note'>
                    <Image src={'/images/icons/power.svg'} alt='power' height={8} width={8} />
                    <h6>Hub Load Balancing on Hedera</h6>
                </figure>
                <figure className='order-note'>
                    <Image
                        src={'/images/icons/important.svg'}
                        alt='important'
                        height={8}
                        width={8}
                    />
                    <h6>Click to view on HashScan</h6>
                </figure>
            </section>
            <section className='grid grid-cols-3 gap-x-2'>
                {order.robots.map((robot, index) => (
                    <figure
                        className='p-4 relative grid grid-cols-3 border border-secondary rounded-lg'
                        key={index}
                    >
                        {robot.digest && (
                            <Link
                                className='absolute top-2 right-2'
                                href={hashscanTx(robot.digest)}
                                target='_blank'
                            >
                                <Image
                                    src={'/images/icons/side-arrow.svg'}
                                    alt='arrow'
                                    height={12}
                                    width={12}
                                />
                            </Link>
                        )}
                        <Image src={'/images/icons/crane.svg'} alt='crane' height={62} width={54} />
                        <div className='col-span-2'>
                            <h5 className='text-sm'>
                                {index == 0
                                    ? 'Product Picking'
                                    : index == 1
                                    ? 'Order Packing'
                                    : 'Parcel Delivery'}
                            </h5>
                            <div className='mt-2.5 mb-2 text-xs text-secondary'>ROBOT ID</div>
                            {robot.id > -1 ? (
                                <span title={
                                    addresses.kiosks[
                                        index == 0
                                            ? 'pickingRobots'
                                            : index == 1
                                            ? 'packingRobots'
                                            : 'deliveringRobots'
                                    ][robot.id]
                                }>
                                    {robot.id}
                                </span>
                            ) : (
                                <div className='spinner' />
                            )}
                        </div>
                        <div className='flex items-center gap-x-2 text-sm font-light text-secondary'>
                            {robot.digest ? (
                                <>
                                    <h5>Tx: {sliceDigest(robot.digest)}</h5>
                                    <CopyButton content={robot.digest} />
                                </>
                            ) : (
                                <h5>Executing...</h5>
                            )}
                        </div>
                    </figure>
                ))}
            </section>
        </section>
    );
}
