import Image from 'next/image';

export function sliceDigest(digest: string): string {
    return `${digest.slice(0, 5)}...${digest.slice(digest.length - 5)}`;
}

export function formatLog(order: Order, logName: string): React.ReactNode {
    const color = order.productId == 0 ? 'Green' : order.productId == 1 ? 'Purple' : 'Blue';
    const robotId = logName.includes('Picking')
        ? order.robots[0].id
        : logName.includes('Packing')
        ? order.robots[1].id
        : order.robots[2].id;

    const text = logName
        .replace('PRODUCT_COLOR', color)
        .replace('ROBOT_ID', robotId == undefined ? '' : robotId.toString());

    const hasImage = text.includes('PRODUCT');

    if (!hasImage) return <h4>{text}</h4>;

    return (
        <>
            <Image
                src={`/images/product/${order.productId}.png`}
                alt='product'
                width={24}
                height={24}
            />{' '}
            <h4>{text.replace('PRODUCT', '')}</h4>
        </>
    );
}
