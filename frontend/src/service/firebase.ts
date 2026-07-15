// Firestore-backed order and robot state. When firebase.json is
// unconfigured the class transparently falls back to localStorage so the
// demo runs credential-free.

import { initializeApp } from 'firebase/app';
import {
    collection,
    doc,
    Firestore,
    getDoc,
    getDocs,
    getFirestore,
    setDoc,
    updateDoc,
} from 'firebase/firestore';

import config from '@/config/firebase.json';

const isConfigured = Boolean(config.apiKey && config.projectId);

const seedRobots = (): TwinsRobot[] =>
    (['Picking', 'Packing', 'Delivery'] as RobotType[]).flatMap((type) =>
        Array.from({ length: 5 }, (_, id) => ({
            id: id.toString(),
            type,
            isActive: true,
        }))
    );

class LocalStore {
    private read<T>(key: string, fallback: T): T {
        if (typeof window === 'undefined') return fallback;
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    }

    private write(key: string, value: unknown) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(key, JSON.stringify(value));
    }

    fetchRobots(): TwinsRobot[] {
        const robots = this.read<TwinsRobot[]>('hedera:robots', seedRobots());
        this.write('hedera:robots', robots);
        return robots;
    }

    updateRobotStatus(id: number, type: RobotType, isActive: boolean) {
        const robots = this.fetchRobots().map((robot) =>
            robot.id == id.toString() && robot.type == type ? { ...robot, isActive } : robot
        );
        this.write('hedera:robots', robots);
    }

    fetchOrders(wallet: string): Order[] {
        return this.read<Order[]>(`hedera:orders:${wallet}`, []);
    }

    addOrUpdateOrder(wallet: string, order: Order) {
        const orders = this.fetchOrders(wallet);
        const index = orders.findIndex((o) => o.id == order.id);
        if (index >= 0) orders[index] = order;
        else orders.unshift(order);
        this.write(`hedera:orders:${wallet}`, orders);
    }
}

export default class Database {
    isAuth = false;
    db: Firestore | null = null;
    local = new LocalStore();

    constructor() {
        if (isConfigured) {
            const app = initializeApp(config);
            this.db = getFirestore(app);
        }
    }

    async authenticate() {
        if (this.isAuth) return;
        // todo auth
        this.isAuth = true;
    }

    async fetchRobots(): Promise<TwinsRobot[]> {
        if (!this.db) return this.local.fetchRobots();

        const picking = await getDocs(collection(this.db, 'hedera', 'robot', 'picking'));
        const packing = await getDocs(collection(this.db, 'hedera', 'robot', 'packing'));
        const delivery = await getDocs(collection(this.db, 'hedera', 'robot', 'delivery'));

        const robots: TwinsRobot[] = [];
        picking.docs.map((robot) => robots.push({ ...(robot.data() as TwinsRobot), type: 'Picking' }));
        packing.docs.map((robot) => robots.push({ ...(robot.data() as TwinsRobot), type: 'Packing' }));
        delivery.docs.map((robot) => robots.push({ ...(robot.data() as TwinsRobot), type: 'Delivery' }));

        return robots;
    }

    async updateRobotStatus(id: number, type: RobotType, isActive: boolean) {
        if (!this.db) return this.local.updateRobotStatus(id, type, isActive);

        await this.authenticate();
        await updateDoc(doc(this.db, 'hedera', 'robot', type.toLowerCase(), id.toString()), {
            id,
            isActive,
        });
    }

    async fetchOrders(wallet: string): Promise<Order[]> {
        if (!this.db) return this.local.fetchOrders(wallet);

        const snapshot = await getDocs(collection(this.db, 'hedera', 'users', wallet));
        if (snapshot.empty) return [];
        return snapshot.docs.map((order) => order.data()) as Order[];
    }

    async addOrUpdateOrder(wallet: string, order: Order) {
        if (!this.db) return this.local.addOrUpdateOrder(wallet, order);

        await this.authenticate();
        const ref = doc(this.db, 'hedera', 'users', wallet, order.id);

        const snapshot = await getDoc(ref);
        if (snapshot.exists()) await updateDoc(ref, { ...order });
        else await setDoc(ref, { ...order });
    }
}
