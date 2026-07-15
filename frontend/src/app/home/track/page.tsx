'use client';

import Image from 'next/image';

import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletProvider';
import useOrders from '@/hooks/use-orders';

import { cn } from '@/lib/utils';

export default function Track() {
    const router = useRouter();

    const { address } = useWallet();
    const { orders } = useOrders(address);

    return (
        <section className='w-full flex flex-col items-center'>
            <h2 className='mb-10 text-2xl'>
                Total Order(s){' '}
                <span className='py-2 px-4 text-xl bg-foreground text-background rounded-full'>
                    {orders.length}
                </span>
            </h2>
            <section className='w-3/4 grid grid-cols-3 gap-x-2 gap-y-4'>
                {orders.map((order, index) => (
                    <figure
                        key={index}
                        className='py-5 px-4 grid grid-cols-2 gap-y-5 border border-secondary rounded-lg cursor-pointer'
                        onClick={() => {
                            if (order.status == 'completed') router.push(`/order?id=${order.id}`);
                        }}
                    >
                        <Image src={'/images/icons/track.svg'} alt='track' width={34} height={34} />
                        <h5
                            className={cn(
                                'w-fit justify-self-end text-sm',
                                order.status == 'completed'
                                    ? 'green-background'
                                    : order.status == 'cancelled'
                                    ? 'red-background'
                                    : 'gray-background'
                            )}
                        >
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </h5>
                        <h2 className='text-2xl'>#{order.id}</h2>
                    </figure>
                ))}
            </section>
        </section>
    );
}
