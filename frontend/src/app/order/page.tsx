'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import NavBar from '@/components/ui/nav-bar';
import Robots from '@/components/ui/order/robots';
import Simulator from '@/components/ui/order/simulator';
import Approval from '@/components/ui/order/approval';
import Logs from '@/components/ui/order/logs';

import { useSearchParams } from 'next/navigation';
import useOrderProcessing from '@/hooks/use-order-processing';

import { cn } from '@/lib/utils';
import { addresses, hashscanEntity, hashscanTx } from '@/constants';

function Order() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('id');
    const ngrokUrl = searchParams.get('url');

    const { activeOrder } = useOrderProcessing(orderId, ngrokUrl);

    if (!activeOrder) return <></>;

    return (
        <>
            <NavBar>
                {activeOrder.status == 'completed' && (
                    <>
                        <Link
                            className='p-3.5 border border-secondary rounded-full'
                            href={'/home/track'}
                        >
                            <Image
                                src={'/images/icons/track.svg'}
                                alt='track'
                                width={24}
                                height={24}
                            />
                        </Link>
                        <Link
                            className='p-3.5 border border-secondary rounded-full'
                            href={'/home/store'}
                        >
                            <Image
                                src={'/images/icons/store.svg'}
                                alt='store'
                                width={24}
                                height={24}
                            />
                        </Link>
                    </>
                )}
            </NavBar>
            <main className='w-full flex items-center justify-center'>
                <div className='w-4/5 mb-8 flex flex-col items-center justify-center gap-y-12'>
                    <section className='grid grid-cols-3 gap-x-6'>
                        <div className='mb-10 col-span-3 flex items-center gap-x-6'>
                            <h1 className='text-4xl'>
                                #<span className='underline'>{activeOrder.id.toUpperCase()}</span>
                            </h1>
                            <h5
                                className={cn(
                                    'p-3.5 rounded-sm',
                                    activeOrder.status == 'completed'
                                        ? 'green-background'
                                        : 'gray-background'
                                )}
                            >
                                {activeOrder.status.charAt(0).toUpperCase() +
                                    activeOrder.status.slice(1)}
                            </h5>
                        </div>
                        <figure className='relative h-fit self-end [&>*]:p-4 grid grid-cols-2 [&_h4]:text-secondary border border-secondary rounded-lg'>
                            <section className='border-r border-secondary'>
                                <h4 className='mb-4'>Order</h4>
                                <Image
                                    src={`/images/product/${activeOrder.productId}.png`}
                                    alt='product-image'
                                    height={32}
                                    width={32}
                                />
                                <Link
                                    className='underline text-xs'
                                    href={hashscanEntity(addresses.products[activeOrder.productId])}
                                    target='_blank'
                                >
                                    Product #{activeOrder.productId + 1}
                                </Link>
                            </section>
                            <section className='[&>h5]:text-xs'>
                                <h4 className='mb-4'>Mailing Info</h4>
                                <h5>{activeOrder.mailingInfo.name}</h5>
                                <h5>{activeOrder.mailingInfo.phone}</h5>
                                <h5>{activeOrder.mailingInfo.address}</h5>
                            </section>
                            {activeOrder.payment && (
                                <section className='border-t border-secondary col-span-2'>
                                    <h4 className='mb-4'>x402 Payment</h4>
                                    <Link
                                        className='flex items-center gap-x-2'
                                        href={hashscanTx(activeOrder.payment.transactionId)}
                                        target='_blank'
                                    >
                                        <Image
                                            src={`/images/icons/success.svg`}
                                            alt='success'
                                            height={24}
                                            width={24}
                                        />
                                        <h4 className='underline !text-foreground'>
                                            {activeOrder.payment.amountHbar} ℏ settled on Hedera
                                        </h4>
                                        <Image
                                            src={`/images/hedera.svg`}
                                            alt='hedera'
                                            height={18}
                                            width={18}
                                        />
                                    </Link>
                                </section>
                            )}
                            {activeOrder.receipt && (
                                <section className='border-t border-secondary col-span-2'>
                                    <h4 className='mb-4'>Lifecycle Report</h4>
                                    <Link
                                        className='flex items-center gap-x-2'
                                        href={`https://${process.env.NEXT_PUBLIC_GATEWAY}/ipfs/${activeOrder.receipt}`}
                                        target='_blank'
                                    >
                                        <Image
                                            src={`/images/icons/success.svg`}
                                            alt='success'
                                            height={24}
                                            width={24}
                                        />
                                        <h4 className='underline !text-foreground'>
                                            Recorded on Pinata
                                        </h4>
                                        <Image
                                            src={`/images/pinata.svg`}
                                            alt='pinata'
                                            height={18}
                                            width={18}
                                        />
                                    </Link>
                                </section>
                            )}
                        </figure>
                        <Robots order={activeOrder} className='col-span-2 self-end' />
                    </section>
                    <section className='w-full grid grid-cols-5 gap-x-9'>
                        <Logs order={activeOrder} className='col-span-2' />
                        <Simulator
                            order={activeOrder}
                            method={ngrokUrl ? 'local' : 'online'}
                            className='col-span-3'
                        />
                    </section>
                    <Approval approvals={activeOrder.approvals} className='w-full' />
                </div>
            </main>
        </>
    );
}

export default function Suspended() {
    return (
        <Suspense>
            <Order />
        </Suspense>
    );
}
