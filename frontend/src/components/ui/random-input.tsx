'use client';

import Image from 'next/image';

import { generateRandomValue } from '@/utils/generator';

interface InputProps {
    name: string;
    id: string;
    ref: React.RefObject<string>;
    isTextArea?: boolean;
    className?: string;
}

export default function RandomInput({ name, id, ref, isTextArea, className }: InputProps) {
    return (
        <div className='relative flex flex-col h-min'>
            <label className='mb-2 text-sm' htmlFor={id}>
                {name}
            </label>
            {isTextArea ? (
                <textarea
                    className={className}
                    id={id}
                    defaultValue={ref.current}
                    onChange={(event) => (ref.current = event.target.value)}
                />
            ) : (
                <input
                    type='text'
                    className={className}
                    id={id}
                    defaultValue={ref.current}
                    onChange={(event) => (ref.current = event.target.value)}
                />
            )}
            <Image
                className='absolute -right-9 top-1/2 cursor-pointer'
                src={'/images/icons/dice.svg'}
                alt='dice'
                width={24}
                height={24}
                onClick={() => (ref.current = generateRandomValue(id))}
            />
        </div>
    );
}
