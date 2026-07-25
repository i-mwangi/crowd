// Drives one order through the full pipeline exactly as the UI hook does, but
// headless — so a complete 3-phase run can be verified end to end. Reads the
// selected robot from the event log between phases to feed the next call.
//
// Run from frontend/:  node scripts/run-order.mjs <productId>

const BASE = 'http://localhost:3001';
const productId = Number(process.argv[2] ?? '1');
const orderId = `run${Date.now().toString(36).slice(-5)}`;

const post = (path, body) =>
    fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    }).then((r) => r.json());

const events = () => fetch(`${BASE}/api/events?orderId=${orderId}`).then((r) => r.json());

const robotOf = async (type) => {
    const { events: log } = await events();
    const e = [...log].reverse().find((x) => x.type === 'SelectedRobot' && x.robotType === type);
    return e?.robotId;
};

console.log(`order ${orderId}, product ${productId}\n`);

const goods = await post('/api/agent/order', { orderId, productId });
console.log(`customer paid ${goods.payment.amountUsdc} USDC for goods`);

// phase 0: pick — selects the picking robot
await post('/api/robot', { orderId, processId: 0, productId });
const pick = await robotOf('Picking');
console.log(`phase 0 picking  -> robot #${pick}`);

// phase 1: move to buffer + select packing robot
await post('/api/robot', { orderId, processId: 1, productId, robotId: pick });
const pack = await robotOf('Packing');
console.log(`phase 1 packing  -> robot #${pack}`);

// phase 2: move to packout + select delivery robot
await post('/api/robot', { orderId, processId: 2, productId, robotId: pack });
const deliver = await robotOf('Delivery');
console.log(`phase 2 delivery -> robot #${deliver}`);

// phase 3: move to delivery zone + ship
await post('/api/robot', { orderId, processId: 3, productId, robotId: deliver });
console.log(`phase 3 shipped`);

console.log(`\norderId=${orderId}`);
