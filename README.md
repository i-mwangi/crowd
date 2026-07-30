# Crowd

**B2B middleware connecting industrial warehouse robotics to Hedera, with x402 pay-before-fulfillment.**

Crowd is a middleware-as-a-service hub that bridges the gap between industrial
warehouse robotics and Hedera. It gives disparate robotics systems a unified
interface, turning every robotic action into a transparent, traceable and
tamper-resistant record — while an **x402** payment layer settles the order
*before* fulfillment begins.

The result: physical warehouse operations become a verifiable digital audit
trail with payment built in, addressing data centralization, information
asymmetry, and supply chain security — and enabling machine-to-machine B2B
commerce with no human in the loop.

![Crowd architecture — warehouse robots, the Crowd hub, and the Hedera services
behind them](docs/architecture.png)

The left column is the physical layer, the centre is the hub, and the right is
what lands on Hedera. The band along the bottom is the part worth reading
twice: one order triggers **four** x402 payments, three of them from the
warehouse to a fleet operator it does not own.

---

## Live on Hedera testnet

Everything below is real and independently verifiable on HashScan — no mocks.

| Component | Entity | |
|---|---|---|
| Order registry contract | `0.0.9597513` | [HashScan](https://hashscan.io/testnet/contract/0.0.9597513) |
| Audit trail topic (HCS) | `0.0.9588605` | [HashScan](https://hashscan.io/testnet/topic/0.0.9588605) |
| Robot task bus (HCS) | `0.0.9709354` | [HashScan](https://hashscan.io/testnet/topic/0.0.9709354) |
| Fleet operator account | `0.0.9709330` | [HashScan](https://hashscan.io/testnet/account/0.0.9709330) |
| Settlement asset (USDC) | `0.0.5449` | [HashScan](https://hashscan.io/testnet/token/0.0.5449) |
| Green Cube (HTS) | `0.0.9589888` | [HashScan](https://hashscan.io/testnet/token/0.0.9589888) |
| Purple Cube (HTS) | `0.0.9589889` | [HashScan](https://hashscan.io/testnet/token/0.0.9589889) |
| Blue Cube (HTS) | `0.0.9589890` | [HashScan](https://hashscan.io/testnet/token/0.0.9589890) |
| Picking robot twins (NFT ×5) | `0.0.9589892` | [HashScan](https://hashscan.io/testnet/token/0.0.9589892) |
| Packing robot twins (NFT ×5) | `0.0.9589893` | [HashScan](https://hashscan.io/testnet/token/0.0.9589893) |
| Delivery robot twins (NFT ×5) | `0.0.9589894` | [HashScan](https://hashscan.io/testnet/token/0.0.9589894) |

## Verify it yourself

With the app running at `localhost:3000`:

| Page | What it proves |
|---|---|
| `/home/store` | Three products, each an HTS token — click through to HashScan |
| `/home/twins` | 15 robot digital twins as NFTs, with live busy/idle state |
| `/order?id=…` | Per-order: the 4 x402 payments, 11 HCS messages, and PRNG assignments, every one linking to HashScan |

### See the 402 without installing anything

Order placement is a paid resource. Ask for it without paying and the live
deployment answers with a real HTTP 402:

```bash
curl -i -X POST "https://crowd-sandy.vercel.app/api/orders?product=0&order=probe"
```

```
HTTP/1.1 402 Payment Required
Payment-Required: eyJ4NDAyVmVyc2lvbiI6MiwiZXJyb3IiOiJQYXltZW50IHJlcXVpcmVk...
```

That header is the payment challenge, base64-encoded. Decode it to see exactly
what is owed and to whom:

```bash
curl -sD- -o/dev/null -X POST "https://crowd-sandy.vercel.app/api/orders?product=0&order=probe" \
  | grep -i '^payment-required:' | cut -d' ' -f2 | tr -d '\r' | base64 -d
```

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "hedera:testnet",
    "amount": "10000",
    "asset": "0.0.5449",
    "payTo": "0.0.5792828",
    "extra": { "feePayer": "0.0.7162784" }
  }]
}
```

`10000` is $0.01 in USDC's 6 decimals. `0.0.5449` is USDC, `0.0.5792828` is the
warehouse, and `feePayer` is the facilitator — it covers the network fee and
holds no key of ours. Products `0`, `1` and `2` quote $0.01, $0.015 and $0.02.

A client that signs that challenge and retries the same request gets a `201` and
an order on-chain. That is the entire protocol: no side channel, no payment API,
just a status code and two headers.

Robot labour works identically, priced per kilogram, against the fleet operator's
own server once it is running locally:

```bash
curl -s http://localhost:4022/tariff
curl -i -X POST "http://localhost:4022/tasks/picking?order=probe&robot=1&product=0&weight=2"
```

Raise `weight` and the quote rises with it — a call-out fee plus a rate per
kilogram, because lifting 35 kg is not the same job as lifting 2 kg:

| Package | Quoted `amount` | |
|---|---|---|
| 2 kg | `700` | $0.0007 |
| 12 kg | `1700` | $0.0017 |
| 35 kg | `4000` | $0.0040 |

Note the `payTo` in that challenge is `0.0.9709330`, the fleet operator — not
the warehouse. The warehouse is the one paying here.

## The x402 payment layer

[x402](https://x402.org/) is an open payment standard built on the HTTP `402
Payment Required` status code — it lets software pay software directly, so
autonomous agents transact without a human in the loop. Hedera's fixed,
predictable fees are what make per-order settlement viable.

Everything settles in **USDC** (token `0.0.5449`, 6 decimals) — a stablecoin, so
a price quoted today means the same tomorrow, and six decimals are what make
sub-cent amounts expressible at all.

### One order, four payments

An order is not a single checkout. It is one customer payment plus three
business-to-business payments, and **only the first involves a human**:

| # | Payment | From → To | Signed by | Example |
|---|---|---|---|---|
| 1 | Goods | customer → warehouse | the customer's wallet (HashPack) | $0.01 |
| 2 | Picking labour | warehouse → fleet operator | the warehouse, server-side | $0.0007 |
| 3 | Packing labour | warehouse → fleet operator | the warehouse, server-side | $0.0009 |
| 4 | Delivery labour | warehouse → fleet operator | the warehouse, server-side | $0.00116 |

Payments 2–4 are the machine-to-machine part: no browser, no approval dialog,
no invoice. Amounts are for a 2 kg package; a 35 kg package costs about five
times more to pick.

### How a payment happens

`POST /api/orders` is a **paid resource**:

1. An unpaid request returns **`402`** with a `payment-required` challenge
   naming the amount, the token and the account to pay.
2. The x402 client builds a USDC transfer and signs it. In the browser that
   signature comes from the customer's **HashPack** wallet over WalletConnect,
   so the customer's key never leaves their device. Server-side flows sign with
   the agent key, which never reaches the browser.
3. The request is retried with the signed payload; the **facilitator** adds its
   fee-payer signature and submits it to Hedera testnet.
4. Only then does the warehouse accept the order and dispatch a robot.

The resource server holds **no Hedera key** — the facilitator is the fee payer.
The settlement transaction id becomes the order's first audit-trail entry, so
payment and fulfillment share one verifiable chain of custody.

### Robotics-as-a-Service: why there are three more payments

The warehouse does not own its robots. It **rents** them from a fleet operator
that runs its own x402 server, with its own price list, and it pays **per
task**.

Before any robot moves, the warehouse itself receives a 402 and pays it. The
tariff is a call-out fee plus a rate per kilogram, so heavier packages cost
more to handle:

| Phase | Base | Per kg | 2 kg | 35 kg |
|---|---|---|---|---|
| Picking | $0.0005 | $0.0001 | $0.0007 | $0.0040 |
| Packing | $0.0008 | $0.00005 | $0.0009 | $0.00255 |
| Delivery | $0.0010 | $0.00008 | $0.00116 | $0.0038 |

**Payment buys an unlock, not a promise.** The robot only works once the
settlement clears, and each unlock covers exactly one task.

**And the work is proven, not asserted.** Each of the 15 robots has its own
Hedera account and signs its own `TaskCompleted` message. The mirror node
records `payer_account_id` on every message, so anyone can check that the robot
which was assigned is the robot that signed. The warehouse holds none of those
keys, so it cannot fabricate a completion — we tested this by submitting a
forged completion from the operator account, and it earned nothing.

## Architecture

Four components, each independently verifiable — and deliberately separate
parties, not one program wearing hats.

```
frontend/     Next.js DApp — the warehouse hub and orchestration brain
contracts/    WarehouseRegistry.sol — the enforcement layer
robot-agent/  the fleet operator: its own x402 server, tariff, and 15 robots
robot-sim/    Webots fleet + Flask connectivity layer — the physical layer
```

`robot-agent/` is the counterparty, not a module of the warehouse. It sets its
own prices, holds the robot keys, and is paid by the warehouse over x402 — which
is what makes payments 2–4 genuine machine-to-machine commerce rather than an
internal function call.

### The trust model: enforced vs. recorded

This distinction is the core of the design.

- **The contract is the referee.** `WarehouseRegistry` *enforces* the
  pipeline: an order cannot be packed before it is picked, or shipped before
  it is delivered — invalid transitions **revert on-chain**. Robot assignment
  is drawn from Hedera's **PRNG system contract** (`0x169`), so the operator
  cannot choose which robot handles an order.
- **HCS is the court reporter.** Every action is written to a consensus topic
  as a readable, append-only record, cross-referenced by the contract
  transaction that authorized it.

A log alone proves *what was claimed*. The contract is what makes the log
*trustworthy*. Verify it yourself:

```bash
cd frontend
node scripts/verify-enforcement.mjs <orderId>
#   phase         : Picking (2)
#   attempting illegal jump Picking -> Delivery (should revert)...
#   ✓ enforced — contract reverted: CONTRACT_REVERT_EXECUTED
```

Every `SelectedRobot` message on the topic names its source, so anyone can
confirm the assignment was not hand-picked:

```json
{
  "type": "SelectedRobot",
  "robot_id": 2,
  "selected_by": "contract 0.0.9597513 (PRNG)",
  "contract_tx": "0.0.5792828@1784226095.406833770"
}
```

### Order lifecycle

Eleven steps, each one a real Hedera transaction:

```
x402 payment settles  →  order registered on-chain
   ↓
Picking robot  (PRNG-selected)  →  Shelf → Buffer Zone
   ↓
Packing robot  (PRNG-selected)  →  Buffer → Packout Zone
   ↓
Delivery robot (PRNG-selected)  →  Packout → Delivery Zone
   ↓
Shipped  →  lifecycle report pinned to IPFS
```

Inventory is tokenized with **HTS**: each order transfers one unit of the
product token from the shelf treasury to the buyer. The 15 robots are **NFT
digital twins**. On completion the full report is pinned to **IPFS** via Pinata.

## Running it

Requires Node 20+, pnpm, and a funded ECDSA Hedera testnet account
([portal.hedera.com](https://portal.hedera.com/faucet)).

```bash
cd frontend
pnpm install
cp .env.example .env                # then fill in the values below
```

### Start the services

The warehouse and the fleet operator are separate parties, so they run as
separate processes. **Start the fleet operator first** — if it is down when an
order runs, the three labour payments are skipped silently and the Robot Labour
panel stays empty.

```bash
# 1. fleet operator — sells robot labour over x402        :4022
cd robot-agent && node server.mjs

# 2. the robots — listen on the on-chain task bus, sign their own completions
cd robot-agent && node index.mjs

# 3. the DApp — the warehouse hub                          :3000
cd frontend && pnpm dev
```

Check all of it is up before ordering:

```bash
curl -s -o /dev/null -w "dapp  %{http_code}\n" http://localhost:3000/api/products
curl -s -o /dev/null -w "fleet %{http_code}\n" http://localhost:4022/tariff
```

Both should be `200`. The Webots simulation is optional — see
[`robot-sim/README.md`](robot-sim/README.md); without it the DApp drives the
pipeline on a timer and the on-chain result is identical.

### Configuration

Minimum configuration in `frontend/.env`:

| Variable | Purpose |
|---|---|
| `PAY_TO_ACCOUNT` | Warehouse account that receives order payments |
| `HEDERA_AGENT_ID` / `HEDERA_AGENT_KEY` | The buying agent that pays via x402 |
| `HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_KEY` | Signs HCS messages and contract calls |
| `NEXT_PUBLIC_USDC_TOKEN` | Settlement asset (testnet USDC, `0.0.5449`) |
| `NEXT_PUBLIC_REGISTRY_CONTRACT` | The registry contract id |
| `NEXT_PUBLIC_HCS_TOPIC` | The audit trail topic (auto-created if blank) |
| `FLEET_OPERATOR_ACCOUNT` | Account the robot labour payments are made to |
| `NEXT_PUBLIC_TASK_TOPIC` | The on-chain task bus robots subscribe to |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Enables HashPack; blank falls back to the server-side agent |

**Runs credential-free.** With no `.env`, the app falls back to simulated
settlement and a local audit log, so the full pipeline is demonstrable without
any account. Set `X402_MODE=live` (or just supply the accounts) for real
settlement.

### Deploying your own on-chain artifacts

All scripts read credentials from `frontend/.env`; none hardcodes a secret.

```bash
node scripts/mint-tokens.mjs       # 3 product tokens + 15 robot twin NFTs
node scripts/deploy-contract.mjs   # compile + deploy WarehouseRegistry
node scripts/provision-fleet.mjs   # fleet operator, 15 robot accounts, task topic
node scripts/associate-usdc.mjs    # opt the accounts in to the USDC token
```

Each prints the ids to paste into `.env`. Two helpers for running the demo:

```bash
node scripts/create-customer.mjs   # a funded wallet to import into HashPack
node scripts/recycle-usdc.mjs      # sweep circulated USDC back to the customer
node scripts/verify-enforcement.mjs <orderId>   # prove the contract reverts
```

## Deployment

Crowd is four components, and they don't all belong in the same place.

| Component | Where it runs | Why |
|---|---|---|
| Next.js app (`frontend/`) | Serverless — Vercel, root directory `frontend` | Stateless request/response |
| Fleet operator (`robot-agent/`) | A host that keeps a process alive | Holds an open HCS subscription to the task bus |
| Connectivity layer (`robot-sim/controllers/webots.py`) | Beside the robots | Writes to the filesystem the controllers poll |
| Webots | An operator's workstation | Needs a GPU and a display |

**On a serverless deployment, the Robot Labour panel is empty. That is expected,
not a fault.** Robot labour is bought from a *separate party* — the fleet
operator runs its own x402 resource server and subscribes to the task bus to
learn which jobs have been paid for. A subscription is a long-lived connection,
and serverless functions are torn down between requests, so `robot-agent/`
cannot live there. Without it, the customer→warehouse payment settles and the
three warehouse→fleet payments have nobody to quote them.

That separation is the architecture, not a limitation of it: a warehouse that
could run the fleet operator itself could also forge the robots' work, which is
the thing the design exists to prevent.

So a deployed instance demonstrates the storefront, the wallet connection and
the first x402 payment. The full four-payment cycle needs the fleet server and
Webots running locally — see [Start the services](#running-it) — and is shown
end to end in the demo video. Either way the on-chain result is the same, and
every transaction from a local run is public: the entities in
[Live on Hedera testnet](#live-on-hedera-testnet) are real, and the four
payments and eleven consensus messages behind them can be inspected on HashScan
without running anything at all.

If you deploy the frontend, remember to add the deployed origin to your
WalletConnect project's allowed domains — the relay rejects the handshake from
any origin that isn't listed, which surfaces as a connection failure in the
browser console.

## The physical layer

`robot-sim/` drives a Webots robot fleet — an AGV with a myCobot arm. It is
deliberately **chain-agnostic**: it only speaks
`{orderId, processId, productId, robotId}` JSON, so a warehouse can adopt the
hub without touching its existing robot code.

The loop closes: the DApp commands a robot through a Flask connectivity layer
(the IoT tier), and **when the robot physically finishes it calls back** — that
callback is what advances the order on-chain. In online mode a timer stands in
for the robot; the on-chain result is identical. See
[`robot-sim/README.md`](robot-sim/README.md).

## Why this matters

| Problem | How Crowd addresses it |
|---|---|
| **Data is not transparent** — fleets run in isolated silos | Every action lands on one public consensus topic |
| **Track-and-trace is hard** — no clear audit trail | Eleven verifiable transactions per order, plus an IPFS report |
| **Security** — mutable Web2 records invite tampering | Contract-enforced ordering; PRNG assignment nobody can rig |
| **Payment friction** — invoices, chargebacks, minimums | x402 settles per order in seconds, agent-to-agent |
