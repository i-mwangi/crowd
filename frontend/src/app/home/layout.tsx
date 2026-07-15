'use client';

import Image from 'next/image';
import NavBar from '@/components/ui/nav-bar';

import { useRouter, usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

export default function HomeLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <>
            <NavBar />
            <main className='flex flex-col items-center'>
                <figure className='p-3 mb-16 grid grid-cols-3 border border-secondary rounded-lg'>
                    {['Store', 'Track', 'Twins'].map((page, index) => {
                        const lowerCase = page.toLowerCase();
                        const includes = pathname.includes(lowerCase);

                        return (
                            <button
                                key={index}
                                className={cn(includes ? 'primary-button' : 'white-button')}
                                onClick={() => router.push(`/home/${lowerCase}`)}
                            >
                                <Image
                                    className={cn(
                                        'transition-all duration-[250ms]',
                                        includes ? 'invert' : ''
                                    )}
                                    src={`/images/icons/${lowerCase}.svg`}
                                    alt='page'
                                    width={21}
                                    height={21}
                                />
                                {page}
                            </button>
                        );
                    })}
                </figure>
                {children}
            </main>
        </>
    );
}
