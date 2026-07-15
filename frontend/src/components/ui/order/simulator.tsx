'use client';

import Image from 'next/image';
import WarehousePopup from './warehouse-popup';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface Props {
    order: Order;
    method: string;
    className?: string;
}

export default function Simulator({ method, order, className }: Props) {
    const [design, setDesign] = useState(false);
    const [status, setStatus] = useState<SimulatorStatus>('processing');

    useEffect(() => {
        switch (order?.digests.length) {
            case 3:
                setStatus('picking');
                break;
            case 6:
                setStatus('packing');
                break;
            case 9:
                setStatus('delivery');
                break;
            case 11:
                setStatus('completed');
                break;
            default:
                setStatus('processing');
                break;
        }
    }, [order.digests.length]);

    return (
        <>
            <WarehousePopup active={design} setActive={setDesign} />
            <section className={cn(className)}>
                <section className='mb-4 flex items-center gap-x-2.5'>
                    <h4>Robot Simulator</h4>
                    <div className='order-note'>
                        <Image src={'/images/icons/power.svg'} alt='power' height={9} width={9} />
                        <h6>Webots Simulator</h6>
                    </div>
                    <Image
                        className='cursor-pointer'
                        src={'/images/icons/info.svg'}
                        alt='info'
                        width={18}
                        height={18}
                        onClick={() => setDesign(true)}
                    />
                </section>
                <div className='h-[400px] flex flex-col items-center justify-center gap-y-4 border border-secondary rounded-lg'>
                    {(method == 'local' || status == 'completed' || status == 'processing') && (
                        <Image src={'/images/webots-logo.svg'} alt='logo' height={96} width={96} />
                    )}
                    {status == 'completed' ? (
                        <>
                            <h4>Simulation Completed</h4>
                            <Image
                                src={'/images/icons/success.svg'}
                                alt='success'
                                height={36}
                                width={36}
                            />
                        </>
                    ) : method == 'local' || status == 'processing' ? (
                        <>
                            <h4>Waiting for next command</h4>
                            <div className='spinner w-8 h-8' />
                        </>
                    ) : (
                        <video className='h-full' autoPlay disablePictureInPicture>
                            <source
                                src={`/videos/${status}${
                                    status != 'delivery' ? `-${order.productId + 1}` : ''
                                }.mp4`}
                                type='video/mp4'
                            />
                            Your browser does not support the video tag.
                        </video>
                    )}
                </div>
            </section>
        </>
    );
}
