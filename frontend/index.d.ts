export {};

declare global {
    interface Product {
        id: number;
        stock: number;
        priceUsdc: number;
        weightKg: number;
    }

    type RobotType = 'Picking' | 'Packing' | 'Delivery';

    interface TwinsRobot {
        id: string;
        type: RobotType;
        isActive: boolean;
    }

    type SimulatorStatus = 'processing' | 'picking' | 'packing' | 'delivery' | 'completed';

    interface RobotReceipt {
        id: number;
        digest?: string;
    }

    interface ApprovalReceipt {
        digest: string;
        address?: string;
    }

    interface Order {
        id: string;
        status: 'processing' | 'completed' | 'cancelled';

        productId: number;

        mailingInfo: {
            name: string;
            phone: string;
            address: string;
        };
        wallet: string;

        // Hedera transaction ids — digests[0] is the x402 payment settlement
        digests: string[];
        approvals: ApprovalReceipt[];
        robots: RobotReceipt[];

        payment?: {
            amountUsdc: number;
            transactionId: string;
            mode: 'live' | 'mock';
        };

        timestamp: number;

        receipt?: string;
    }

    // HCS-backed warehouse event
    interface WarehouseEvent {
        type: 'SelectedRobot' | 'MoveProduct' | 'OrderReceived' | 'ShipOrder';
        orderId: string;
        digest: string;
        robotType?: RobotType;
        robotId?: number;
        approvalAddress?: string;
        timestamp: number;
    }
}
