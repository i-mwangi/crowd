# robot-sim — the physical layer

Drives a simulated warehouse robot fleet from the Crowd hub. This layer is
chain-agnostic: it only ever speaks `{orderId, processId, productId, robotId}`
JSON, so nothing here knows about Hedera.

## Layout

Webots resolves paths relative to the world file and requires each controller
to live in a directory matching its filename — this structure is load-bearing,
don't flatten it.

```
robot-sim/
├── worlds/factory.wbt              # the warehouse scene (loads ../stls/*)
├── stls/                           # robot meshes: AGV body + myCobot arm
│   └── arm/
├── controllers/                    # ← run the Flask server from HERE
│   ├── webots.py                   # connectivity layer (Flask)
│   ├── color.txt                   # 13=green 15=purple 14=blue
│   ├── order.txt                   # current order id
│   ├── robot.txt                   # assigned fleet member
│   └── robot_N_controller/
│       ├── robot_N_controller.py   # 1=picking 2=packing 3=delivery
│       └── state.txt               # 0=finished 1=ready 2=command pending
└── requirements.txt
```

`webots.py` writes `robot_N_controller/state.txt` and `color.txt` relative to
its own working directory, while controllers read `../color.txt`. That only
lines up if Flask runs from `controllers/`.

## Run it

Requires [Webots](https://cyberbotics.com/) **R2023b** (the world's
`EXTERNPROTO` entries pin that release) and Python 3.

```bash
pip install -r requirements.txt

# 1. Expose the DApp so robots can report completion back to it.
#    In a separate terminal:  ngrok http 3001
export CROWD_API_URL=https://<your-dapp>.ngrok-free.app

# 2. Start the connectivity layer FROM the controllers directory.
cd controllers
python -m flask --app webots run --port 5000

# 3. Expose the connectivity layer so the DApp can command it:
#    ngrok http 5000   -> paste that URL into the DApp's simulation modal

# 4. Open worlds/factory.wbt in Webots and press play.
```

Verify before ordering — `curl http://localhost:5000/` reports readiness:

```json
{ "robots": { "robot_1": "ready", "robot_2": "ready", "robot_3": "ready" } }
```

`"unknown (Webots not running?)"` or `"finished"` means the controllers
haven't booted; Flask will reject commands with `{"error": "Webots down"}`
until a robot reports `ready`.

## The loop

1. DApp → `POST /api/scenario{1,2,3}` on this server (via ngrok)
2. Flask checks the robot is `ready`, writes the command to disk, sets `state=2`
3. The Webots controller polls `state.txt`, sees `2`, and runs the task
4. When the robot physically finishes it calls `CROWD_API_URL/api/robot` with
   its `processId` — **that callback is what advances the order on-chain**

In online mode the DApp fakes step 2–4 with a timer. In local mode real robot
work replaces the timer; the on-chain result is identical.

## Known limitations (inherited from the original)

- **One order per run.** Each controller `break`s out of its loop after a
  single task, so restart the simulation between orders. Fixing this means
  reworking the hardcoded movement sequences, which assume a fixed start pose.
- **`stls/arm/link 5 part 3.STL` and `wheel.STL` are unreferenced** by the
  world file; kept for completeness.
