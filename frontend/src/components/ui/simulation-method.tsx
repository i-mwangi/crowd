'use client';

import Image from 'next/image';

interface Props {
    name: string;
    description: string;
    handler: () => void;
}

export default function Method({ name, description, handler }: Props) {
    return (
        <div className='p-7 flex flex-col justify-between gap-y-6 border border-tetriary rounded-lg'>
            <Image src={'/images/webots-logo.svg'} alt='webots' width={50} height={50} />
            <h2 className='text-2xl'>{name}</h2>
            <h6 className='text-xs'>{description}</h6>
            <button className='primary-button' onClick={handler}>
                Start Simulation
            </button>
        </div>
    );
}
