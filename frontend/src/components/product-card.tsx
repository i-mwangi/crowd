'use client';

import Image from 'next/image';
import Link from 'next/link';
import SkeletonCard from '@/components/ui/skeleton-product-card';

import { addresses, hashscanEntity } from '@/constants';

import { cn } from '@/lib/utils';

interface Props {
    product: Product | undefined;
    setOrderProduct?: React.Dispatch<React.SetStateAction<Product | undefined>>;
}

export default function ProductCard({ product, setOrderProduct }: Props) {
    if (!product) return <SkeletonCard />;

    return (
        <section className='flex flex-col text-center'>
            <section
                className={cn(
                    'min-w-fit w-72 px-6 py-7 flex flex-col gap-y-4 items-center border border-foreground rounded-lg',
                    !setOrderProduct ? 'product-shadow' : ''
                )}
            >
                <h2 className='text-2xl'>Product #{product.id + 1}</h2>
                <Image
                    src={`/images/product/${product.id}.png`}
                    alt='product'
                    width={160}
                    height={160}
                />
                <section className='w-full grid grid-cols-2 items-end justify-items-center text-secondary [&_h5]:text-sm'>
                    <div>
                        <h3 className='text-xl font-medium'>{product.stock}</h3>
                        <h5>Stock</h5>
                    </div>
                    <div className='flex flex-col items-center'>
                        <h3 className='text-xl font-medium'>{product.priceHbar} ℏ</h3>
                        <h5>via x402</h5>
                    </div>
                </section>
                {setOrderProduct && (
                    <button
                        className='w-full text-xl primary-button'
                        onClick={() => setOrderProduct(product)}
                    >
                        Order
                    </button>
                )}
            </section>
            <Link
                className='mt-6 text-secondary underline'
                href={hashscanEntity(addresses.products[product.id])}
                target='_blank'
            >
                View on HashScan
            </Link>
        </section>
    );
}
