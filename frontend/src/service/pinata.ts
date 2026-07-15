'use server';

import { PinataSDK } from 'pinata';

// Uploads the completed order lifecycle report to IPFS via Pinata.
// Returns a deterministic mock CID when no JWT is set so the
// credential-free demo still completes orders.
export const uploadReceipt = async (order: Order): Promise<string> => {
    if (!process.env.PINATA_JWT) {
        return `mock-cid-${order.id}`;
    }

    const pinata = new PinataSDK({
        pinataJwt: process.env.PINATA_JWT,
        pinataGateway: process.env.NEXT_PUBLIC_GATEWAY,
    });

    const response = await pinata.upload.public.json(order);
    return response.cid;
};
