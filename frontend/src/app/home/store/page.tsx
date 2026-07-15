'use client';

import ProductCard from '@/components/product-card';
import OrderForm from '@/components/order-form-modal';

import { useEffect, useState } from 'react';
import useProducts from '@/hooks/use-products';

export default function Store() {
    const [orderedProduct, setOrderProduct] = useState<Product>();
    const { products, fetchProducts } = useProducts();

    useEffect(() => {
        const interval = setInterval(() => fetchProducts(), 3_000);
        return () => clearInterval(interval);
    }, []);

    return (
        <section className='flex items-center gap-x-6'>
            <OrderForm orderedProduct={orderedProduct} setOrderProduct={setOrderProduct} />
            {products.map((item, index) => (
                <ProductCard key={index} product={item} setOrderProduct={setOrderProduct} />
            ))}
        </section>
    );
}
