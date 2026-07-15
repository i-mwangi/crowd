// Core orchestration hook. Polls /api/events for the warehouse events the
// hub committed to the Hedera audit trail and drives the digest-based state
// machine (11 lifecycle steps, scenario triggers at digests.length 2/3/6/9).

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWallet } from '@/context/WalletProvider';
import useOrders from './use-orders';
import useTwinsRobots from './use-twins-robots';

import { uploadReceipt } from '@/service/pinata';
import { sendWebotsCommand } from '../../actions';

import { digestNames } from '@/constants';

const useOrderProcessing = (orderId: string | null, webotsUrl?: string | null) => {
    const router = useRouter();
    const { address } = useWallet();

    const { updateRobotStatus } = useTwinsRobots();

    const { orders, updateOrder } = useOrders(address);
    const activeOrder = useMemo(
        () => orders.find((order) => order.id == orderId),
        [orders, orderId, webotsUrl]
    );

    const [events, setEvents] = useState<WarehouseEvent[]>([]);

    useEffect(() => {
        if (!orderId) return;
        const poll = async () => {
            try {
                const response = await fetch(`/api/events?orderId=${orderId}`);
                const data = await response.json();
                setEvents(data.events ?? []);
            } catch {
                /* keep polling */
            }
        };
        poll();
        const interval = setInterval(poll, 2_000);
        return () => clearInterval(interval);
    }, [orderId]);

    useEffect(() => {
        if (!events.length || !activeOrder) return;

        events.map(async (event) => {
            if (activeOrder.digests.includes(event.digest)) return;
            if (event.type == 'OrderReceived') return;

            if (event.type == 'SelectedRobot') {
                const robotType = event.robotType!;
                const robotIndex = robotType == 'Picking' ? 0 : robotType == 'Packing' ? 1 : 2;

                activeOrder.robots[robotIndex].id = event.robotId!;
                activeOrder.robots[robotIndex].digest = event.digest;

                activeOrder.approvals[robotIndex].digest = event.digest;
                activeOrder.approvals[robotIndex].address = event.approvalAddress;

                if (robotIndex == 1)
                    await updateRobotStatus(activeOrder.robots[0].id, 'Picking', true);
                if (robotIndex == 2)
                    await updateRobotStatus(activeOrder.robots[1].id, 'Packing', true);

                await updateRobotStatus(event.robotId!, robotType, false);
            }

            activeOrder.digests[activeOrder.digests.length - 1] = event.digest;
            if (activeOrder.digests.length < digestNames.length) activeOrder.digests.push('0');

            await updateOrder(activeOrder);
        });
    }, [events, activeOrder?.id]);

    const handleOrderProcessing = useCallback(
        async (processId: 0 | 1 | 2 | 3, timeout: number) => {
            if (!activeOrder) return;

            if (!webotsUrl) await new Promise((resolve) => setTimeout(resolve, timeout));

            const body = {
                orderId: activeOrder.id,
                processId: processId,
                productId: activeOrder.productId,
                robotId: processId > 0 ? activeOrder.robots[processId - 1].id : undefined,
            };

            if (webotsUrl && processId > 0) await sendWebotsCommand(webotsUrl, body);
            else {
                const response = await fetch('/api/robot', {
                    method: 'POST',
                    body: JSON.stringify(body),
                });

                if (response?.status != 200) throw new Error('Order Processing Error');
            }
        },
        [activeOrder, webotsUrl]
    );

    useEffect(() => {
        if (
            activeOrder?.status == 'processing' &&
            activeOrder?.digests.length == digestNames.length &&
            activeOrder.digests[activeOrder.digests.length - 1] != '0'
        ) {
            const completeOrder = async () => {
                await updateRobotStatus(activeOrder.robots[2].id, 'Delivery', true);
                const receipt = await uploadReceipt(activeOrder);
                await updateOrder({ ...activeOrder, receipt, status: 'completed' });
            };

            completeOrder();
        }
    }, [
        activeOrder?.status,
        activeOrder?.digests.length,
        activeOrder?.digests[activeOrder?.digests.length - 1],
    ]);

    useEffect(() => {
        if (!activeOrder) return;
        switch (activeOrder.digests.length) {
            case 2:
                handleOrderProcessing(0, 0);
                break;
            case 3:
                handleOrderProcessing(1, 45_000);
                break;
            case 6:
                handleOrderProcessing(2, 35_000);
                break;
            case 9:
                handleOrderProcessing(3, 42_000);
                break;
        }
    }, [activeOrder?.digests.length]);

    useEffect(() => {
        if ((orders.length && !activeOrder) || activeOrder?.status == 'cancelled')
            router.push('/home/store');
    }, [activeOrder]);

    return { activeOrder };
};

export default useOrderProcessing;
