export const createOrder = (
    orderId: string,
    productId: number,
    name: string,
    phone: string,
    address: string,
    wallet: string,
    digest: string,
    payment?: Order['payment']
): Order => {
    const newOrder: Order = {
        id: orderId,
        status: 'processing',

        productId,

        mailingInfo: {
            name,
            phone,
            address,
        },
        wallet,

        digests: [digest, '0'],
        approvals: [{ digest: '0' }, { digest: '0' }, { digest: '0' }],
        robots: [{ id: -1 }, { id: -1 }, { id: -1 }],

        payment,

        timestamp: Date.now(),
    };

    return newOrder;
};
