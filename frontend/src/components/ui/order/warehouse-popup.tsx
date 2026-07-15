'use client';

import Image from 'next/image';

import { cn } from '@/lib/utils';

interface Props {
    active: boolean;
    setActive: (value: boolean) => void;
}

export default function WarehousePopup({ active, setActive }: Props) {
    return (
        <figure
            className={cn(
                'p-11 w-3/4 fixed top-1/2 -translate-y-1/2 flex flex-col gap-y-8 bg-background border border-secondary rounded-lg pointer-events-none transition-all duration-500 ease-in-out',
                active ? 'opacity-100' : 'opacity-0'
            )}
        >
            <Image
                className='absolute top-4 right-4 cursor-pointer pointer-events-auto'
                src={'/images/icons/cross.svg'}
                alt='cross'
                width={16}
                height={16}
                onClick={() => setActive(false)}
            />
            <div className='flex items-center gap-x-2.5'>
                <Image src={'/images/icons/info.svg'} alt='info' width={24} height={24} />
                <h3 className='text-xl'>About the Webot simulation setup</h3>
            </div>
            <h5 className='text-secondary text-sm'>
                The robots simulated in the Webot scenes are programmed to perform warehouse
                operations based on the activity on the Hedera Testnet, and will also report back
                to the Hedera Testnet once jobs are completed. Our team had built a simulated
                warehouse scene to demonstrate how robots deal with product picking, parcel
                packing, and parcel delivery:
            </h5>
            <div className='flex flex-col items-center gap-y-4'>
                <Image src={'/images/warehouse-design.svg'} alt='design' width={630} height={413} />
                <h6>Warehouse Simulation Design</h6>
            </div>
        </figure>
    );
}
