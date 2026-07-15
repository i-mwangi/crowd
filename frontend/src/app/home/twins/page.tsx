'use client';

import Image from 'next/image';

import { useEffect } from 'react';
import useTwinsRobots from '@/hooks/use-twins-robots';

import { cn } from '@/lib/utils';

export default function Twins() {
    const { robots, fetchRobots } = useTwinsRobots();

    useEffect(() => {
        const interval = setInterval(() => fetchRobots(), 5_000);
        return () => clearInterval(interval);
    }, []);

    return (
        <main>
            <section className='grid grid-cols-3 gap-x-14 [&>div]:flex [&>div]:flex-col [&>div]:gap-y-2'>
                <div>
                    {robots
                        .filter((robot) => robot.type == 'Picking')
                        .map((robot, index) => (
                            <Robot key={index} robot={robot} />
                        ))}
                </div>
                <div>
                    {robots
                        .filter((robot) => robot.type == 'Packing')
                        .map((robot, index) => (
                            <Robot key={index} robot={robot} />
                        ))}
                </div>
                <div>
                    {robots
                        .filter((robot) => robot.type == 'Delivery')
                        .map((robot, index) => (
                            <Robot key={index} robot={robot} />
                        ))}
                </div>
            </section>
        </main>
    );
}

function Robot({ robot }: { robot: TwinsRobot }) {
    return (
        <figure className='p-4 flex gap-x-3 border border-secondary rounded-lg'>
            <Image src={'/images/icons/robot.svg'} alt='robot' width={40} height={46} />
            <section className='flex flex-col gap-y-2'>
                <h4>{`${robot.type} Robot #${robot.id}`}</h4>
                <div
                    className={cn(
                        'w-fit text-xs',
                        robot.isActive ? 'green-background' : 'red-background'
                    )}
                >
                    {robot.isActive ? 'Active' : 'Busy'}
                </div>
            </section>
        </figure>
    );
}
