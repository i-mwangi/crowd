'use client';

import Image from 'next/image';
import Method from '@/components/ui/simulation-method';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { checkPassword } from '../../actions';

import { cn } from '@/lib/utils';

interface Props {
    orderId: string;
}

export default function SimulationMethod({ orderId }: Props) {
    const router = useRouter();

    const [isLocal, setIsLocal] = useState(false);
    const passcode = useRef('');
    const url = useRef('');

    return (
        <div className='modal-background'>
            <figure
                className={cn(
                    'w-3/5 relative p-14 flex flex-col gap-y-10 bg-background rounded-lg',
                    isLocal ? 'items-center' : ''
                )}
            >
                {isLocal ? (
                    <>
                        <Image
                            className='absolute right-6 top-6 cursor-pointer'
                            src={'/images/icons/cross.svg'}
                            alt='cross'
                            width={16}
                            height={16}
                            onClick={() => setIsLocal(false)}
                        />
                        <h1 className='text-3xl'>Connect to local Webots simulation</h1>
                        <h5 className='w-1/2 text-xs text-center'>
                            This option only available for the owner of this web application for
                            demonstration purpose . If you are a normal user of this web
                            application, either contact the owner or kindly proceed for an online
                            simulation.
                        </h5>
                        <div className='w-1/2 flex flex-col gap-y-2'>
                            <label htmlFor='passcode'>Passcode</label>
                            <input
                                type='text'
                                onChange={(event) => (passcode.current = event.target.value)}
                            />
                        </div>
                        <div className='w-1/2 flex flex-col gap-y-2'>
                            <label htmlFor='url'>Ngrok URL</label>
                            <input
                                type='text'
                                onChange={(event) => (url.current = event.target.value)}
                            />
                        </div>
                        <button
                            className='primary-button'
                            onClick={async () => {
                                const isAdmin = await checkPassword(passcode.current);
                                if (isAdmin) router.push(`/order?id=${orderId}&url=${url.current}`);
                                else alert!('Wrong Passcode');
                            }}
                        >
                            Establish connection
                        </button>
                    </>
                ) : (
                    <>
                        <div className='w-full pb-8 flex items-center justify-end gap-x-2 border-b border-tetriary'>
                            <Image
                                src={'/images/webots-logo.svg'}
                                alt='logo'
                                width={50}
                                height={50}
                            />
                            <Image
                                src={'/images/webots-name.svg'}
                                alt='name'
                                width={150}
                                height={50}
                            />
                        </div>
                        <div className='grid grid-cols-2 gap-x-6'>
                            <h1 className='my-8 text-3xl col-span-2'>Choose a simulation method</h1>
                            <Method
                                name='Online Simulation Only'
                                description='Simulate robot warehouse activities via Webots pre-recorded simulation stream.'
                                handler={() => router.push(`/order?id=${orderId}`)}
                            />
                            <Method
                                name='Online + Local Simulation'
                                description='Simulate robot warehouse activities via Webots pre-recorded simulation stream as well as in sync with a local Webots World.'
                                handler={() => setIsLocal(true)}
                            />
                        </div>
                    </>
                )}
            </figure>
        </div>
    );
}
