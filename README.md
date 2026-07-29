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

---

## Live on Hedera testnet

Everything below is real and independently verifiable on HashScan — no mocks.

| Component | Entity | |
|---|---|---|
| Order registry contract | `0.0.9597513` | [HashScan](https://hashscan.io/testnet/contract/0.0.9597513) |
| Audit trail topic (HCS) | `0.0.9588605` | [HashScan](https://hashscan.io/testnet/topic/0.0.9588605) |
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

## The x402 payment layer

[x402](https://x402.org/) is an open payment standard built on the HTTP `402
Payment Required` status code — it lets software pay software directly, so
autonomous agents transact without a human in the loop. Hedera's fixed,
predictable fees are what make per-order settlement viable.

Placing an order is a **paid resource**. `POST /api/orders` is gated:

1. An unpaid request returns **`402`** with a `payment-required` challenge.
2. The buying agent signs a payment with its Hedera key — server-side only, so
   the key never reaches the browser or an LLM's context.
3. The request is retried; the facilitator **settles the HBAR transfer on
   Hedera testnet**.
4. Only then does the warehouse accept the order and dispatch a robot.

The settlement transaction id becomes the order's first audit-trail entry, so
payment and fulfillment share one verifiable chain of custody. The resource
server holds **no Hedera key** — the facilitator is the fee payer.

## Architecture

Three layers, each independently verifiable.

```
frontend/     Next.js DApp — the hub and orchestration brain
contracts/    WarehouseRegistry.sol — the enforcement layer
robot-sim/    Webots fleet + Flask connectivity layer — the physical layer
```

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
pnpm dev                            # http://localhost:3000
```

Minimum configuration in `frontend/.env`:

| Variable | Purpose |
|---|---|
| `PAY_TO_ACCOUNT` | Warehouse account that receives order payments |
| `HEDERA_AGENT_ID` / `HEDERA_AGENT_KEY` | The buying agent that pays via x402 |
| `HEDERA_OPERATOR_ID` / `HEDERA_OPERATOR_KEY` | Signs HCS messages and contract calls |
| `NEXT_PUBLIC_REGISTRY_CONTRACT` | The registry contract id |
| `NEXT_PUBLIC_HCS_TOPIC` | The audit trail topic (auto-created if blank) |

**Runs credential-free.** With no `.env`, the app falls back to simulated
settlement and a local audit log, so the full pipeline is demonstrable without
any account. Set `X402_MODE=live` (or just supply the accounts) for real
settlement.

### Deploying your own on-chain artifacts

```bash
node scripts/mint-tokens.mjs      # 3 product tokens + 15 robot twin NFTs
node scripts/deploy-contract.mjs  # compile + deploy WarehouseRegistry
```

Both print the ids to paste into `.env`. Neither hardcodes a credential.

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
