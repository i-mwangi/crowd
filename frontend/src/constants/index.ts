// Network configuration and on-chain entity registry.
// Hedera mirror-node REST endpoints serve read queries; on-chain entities
// are Hedera ids (tokens, topics, accounts).

export const networks = {
    testnet: {
        mirrorUrl: 'https://testnet.mirrornode.hedera.com',
        explorerUrl: 'https://hashscan.io/testnet',
    },
    mainnet: {
        mirrorUrl: 'https://mainnet.mirrornode.hedera.com',
        explorerUrl: 'https://hashscan.io/mainnet',
    },
};

export const activeNetwork =
    (process.env.NEXT_PUBLIC_NETWORK as 'testnet' | 'mainnet') ?? 'testnet';

export const explorerUrl =
    process.env.NEXT_PUBLIC_EXPLORER ?? networks[activeNetwork].explorerUrl;

// The 11-step fulfillment lifecycle —
// each entry maps to one Hedera transaction (digest).
export const digestNames = [
    'Warehouse received order',
    'Picking in progress',
    'PRODUCT from PRODUCT_COLOR Shelf to Picking Robot ROBOT_ID',
    'PRODUCT from Picking Robot ROBOT_ID to Order Buffer Zone',
    'Packing in progress',
    'PRODUCT from Order Buffer Zone to Packing Robot ROBOT_ID',
    'PRODUCT from Packing Robot ROBOT_ID to Packout Zone',
    'Delivery in progress',
    'PRODUCT from Packout Zone to Delivery Robot ROBOT_ID',
    'PRODUCT from Delivery Robot ROBOT_ID to Delivery Zone',
    'Shipping in progress',
];

// Hedera entity registry:
//  - products: HTS token ids representing tokenized inventory
//  - hcsTopic: the consensus topic carrying the warehouse audit trail
//  - shelves / robots / zones: logical kiosk labels; each maps to a slot in
//    the on-chain trail (message payloads reference these labels)
export const addresses = {
    owner: process.env.NEXT_PUBLIC_OWNER_ACCOUNT ?? '0.0.0',
    hcsTopic: process.env.NEXT_PUBLIC_HCS_TOPIC ?? '',
    products: [
        process.env.NEXT_PUBLIC_TOKEN_GREEN ?? '0.0.0',
        process.env.NEXT_PUBLIC_TOKEN_PURPLE ?? '0.0.0',
        process.env.NEXT_PUBLIC_TOKEN_BLUE ?? '0.0.0',
    ],
    kiosks: {
        shelfs: {
            green: 'SHELF-GREEN',
            purple: 'SHELF-PURPLE',
            blue: 'SHELF-BLUE',
        },
        pickingRobots: ['PICK-0', 'PICK-1', 'PICK-2', 'PICK-3', 'PICK-4'],
        packingRobots: ['PACK-0', 'PACK-1', 'PACK-2', 'PACK-3', 'PACK-4'],
        deliveringRobots: ['DELIVER-0', 'DELIVER-1', 'DELIVER-2', 'DELIVER-3', 'DELIVER-4'],
        zones: {
            buffer: 'ZONE-BUFFER',
            packing: 'ZONE-PACKOUT',
            delivery: 'ZONE-DELIVERY',
        },
    },
};

// x402 order pricing (HBAR per product id)
export const productPricesHbar = [0.5, 0.75, 1];

export const hashscanTx = (digest: string): string =>
    digest.startsWith('mock-')
        ? '#'
        : `${explorerUrl}/transaction/${encodeURIComponent(digest)}`;

export const hashscanEntity = (id: string): string =>
    id === '0.0.0' || !id ? '#' : `${explorerUrl}/token/${id}`;
