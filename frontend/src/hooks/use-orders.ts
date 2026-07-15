import { useCallback, useEffect, useRef, useState } from 'react';

import Database from '@/service/firebase';

const useOrders = (wallet: string | undefined) => {
    const [orders, setOrders] = useState<Order[]>([]);

    const database = useRef(new Database());

    const fetchOrders = useCallback(async () => {
        if (!wallet) return;
        const data = await database.current.fetchOrders(wallet);
        setOrders(data);
    }, [wallet]);

    const addOrder = useCallback(
        async (order: Order) => {
            if (!wallet) return;
            await database.current.addOrUpdateOrder(wallet, order);

            const copy = [...orders];
            copy.unshift(order);
            setOrders(copy);
        },
        [orders, wallet]
    );

    const updateOrder = useCallback(
        async (orderToUpdate: Order) => {
            if (!wallet) return;
            await database.current.addOrUpdateOrder(wallet, orderToUpdate);

            const updated = [...orders].map((order) => {
                if (order.id == orderToUpdate.id) return orderToUpdate;
                return order;
            });
            setOrders(updated);
        },
        [orders, wallet]
    );

    useEffect(() => {
        fetchOrders();
    }, [wallet]);

    return { orders, fetchOrders, addOrder, updateOrder };
};

export default useOrders;
