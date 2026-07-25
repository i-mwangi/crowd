'use client';

import Image from 'next/image';
import ProductCard from '@/components/product-card';
import RandomInput from '@/components/ui/random-input';
import SimulationMethod from '@/components/simulation-method-modal';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from '@/context/WalletProvider';
import useOrders from '@/hooks/use-orders';

import { createOrder } from '@/helpers/order';
import { placeOrder } from '@/helpers/contract-client';
import { USDC_TOKEN } from '@/constants';
import { cn } from '@/lib/utils';
import { generateOrderId } from '@/utils/generator';

interface Props {
    orderedProduct: Product | undefined;
    setOrderProduct: (product: Product | undefined) => void;
}

export default function OrderForm({ orderedProduct, setOrderProduct }: Props) {
    const { address } = useWallet();
    const { addOrder } = useOrders(address);

    const [activeOrderId, setActiveOrderId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [countdown, setCountdown] = useState(15);
    const [paymentError, setPaymentError] = useState<string>();

    const name = useRef('');
    const phone = useRef('');
    const deliveryAddress = useRef('');

    useEffect(() => {
        // Keep the form open while a payment error is being read.
        if (isProcessing || paymentError) return;
        if (countdown <= 0) setOrderProduct(undefined);
        if (!orderedProduct) setCountdown(15);
        else setTimeout(() => setCountdown(countdown - 1), 1_000);
    }, [countdown, orderedProduct]);

    const handleOrderCreation = useCallback(async () => {
        if (
            !name.current ||
            !phone.current ||
            !deliveryAddress.current ||
            !address ||
            !orderedProduct
        )
            return;
        try {
            setIsProcessing(true);
            const orderId = generateOrderId(address);

            // x402: the buying agent pays for the order (402 -> sign -> settle
            // on Hedera) before the warehouse accepts it. The settlement
            // transaction id becomes the first digest of the lifecycle.
            const { digest, payment } = await placeOrder(orderId, orderedProduct.id);

            const order = createOrder(
                orderId,
                orderedProduct.id,
                name.current,
                phone.current,
                deliveryAddress.current,
                address,
                digest,
                payment
            );

            setActiveOrderId(order.id);
            await addOrder(order);
        } catch (error) {
            // Surface the failure instead of silently closing: a wallet payment
            // can be rejected, time out, or fail the facilitator's balance and
            // token-association checks, and the buyer needs to know which.
            console.error('[order] payment failed:', error);
            setPaymentError(
                error instanceof Error ? error.message : 'Payment failed — order not placed'
            );
            setIsProcessing(false);
        }
    }, [orderedProduct, address]);

    const handleModalClose = useCallback(() => {
        setIsProcessing(false);
        setPaymentError(undefined);
        setOrderProduct(undefined);
        name.current = '';
        phone.current = '';
        deliveryAddress.current = '';
    }, []);

    if (activeOrderId) return <SimulationMethod orderId={activeOrderId} />;

    return (
        <div
            className={cn(
                'modal-background transition-all duration-700',
                !orderedProduct ? 'translate-y-[100dvh]' : 'translate-y-0'
            )}
        >
            <figure className='relative p-14 flex flex-col gap-y-10 bg-background rounded-lg'>
                <section className='flex items-center gap-x-3.5'>
                    <h1 className='text-4xl'>Order Form</h1>
                    <div className='px-5 py-2 flex items-center gap-x-3.5 bg-gray-background rounded-lg'>
                        <Image
                            src={'/images/icons/calendar.svg'}
                            alt='calendar'
                            width={25}
                            height={25}
                        />
                        <h6 className='text-xs'>
                            Congrats! This product is currently on-hold for you. Please proceed{' '}
                            <br />
                            with the order in 00:{countdown < 10 ? `0${countdown}` : countdown}{' '}
                            before it is release.
                        </h6>
                    </div>
                </section>
                <section className='flex gap-x-14'>
                    <ProductCard product={orderedProduct} />
                    <div className='w-full h-full flex flex-col gap-y-5'>
                        <RandomInput id='name' name='Name' ref={name} />
                        <RandomInput id='phone' name='Phone Number' ref={phone} />
                        <RandomInput
                            id='address'
                            name='Address'
                            ref={deliveryAddress}
                            isTextArea
                            className='h-full'
                        />
                        <button className='primary-button' onClick={handleOrderCreation}>
                            {isProcessing ? (
                                <div className='w-6 h-6 border-3 border-background border-l-transparent rounded-full animate-spin'></div>
                            ) : (
                                `Pay $${orderedProduct?.priceUsdc ?? ''} USDC via x402 & Place Order`
                            )}
                        </button>
                        {paymentError && (
                            <p className='text-xs text-red'>
                                {paymentError}
                                <br />
                                <span className='text-secondary'>
                                    Your wallet needs USDC ({USDC_TOKEN}) associated and funded on
                                    testnet to pay for an order.
                                </span>
                            </p>
                        )}
                    </div>
                </section>
                <Image
                    className='absolute right-6 top-6 cursor-pointer'
                    src={'/images/icons/cross.svg'}
                    alt='cross'
                    width={18}
                    height={18}
                    onClick={handleModalClose}
                />
            </figure>
        </div>
    );
}
