import { useCallback, useEffect, useState } from 'react';

import { getProducts } from '@/helpers/contract-client';

const useProducts = () => {
    const [products, setProduсts] = useState<Product[]>(new Array(3).fill(undefined));

    const fetchProducts = useCallback(async () => {
        const data = await getProducts();
        setProduсts(data);
    }, []);

    useEffect(() => {
        fetchProducts();
    }, []);

    return { products, fetchProducts };
};

export default useProducts;
