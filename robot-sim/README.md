# robot-sim: the physical layer

Drives a simulated warehouse robot fleet from the Crowd hub. This layer is
chain-agnostic: it only ever speaks `{orderId, processId, productId, robotId}`
JSON, so nothing here knows about Hedera.

## Layout

Webots resolves paths relative to the world file and requires each controller
to live in a directory matching its filename. This structure is load-bearing,
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

Verify before ordering. `curl http://localhost:5000/` reports readiness:

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
   its `processId`, and **that callback is what advances the order on-chain**

In online mode the DApp fakes step 2–4 with a timer. In local mode real robot
work replaces the timer; the on-chain result is identical.

## Launching

Start the simulation with the bundled launcher rather than the desktop
shortcut:

```powershell
cd robot-sim
.\launch-webots.ps1
```

Webots ships its own `libcrypto-3-x64.dll` but **not** `libssl-3-x64.dll`, so
Windows searches `PATH` for it and can load an unrelated OpenSSL build. When
that happens Webots fails at startup with:

```
The procedure entry point OPENSSL_LH_set_thunks could not be located in
...\scoop\apps\postgresql\current\bin\libssl-3-x64.DLL
```

The launcher drops the conflicting entries from `PATH` for that process only
and opens `worlds/factory.wbt` directly. Nothing is uninstalled and other
tools keep working. Extra arguments are forwarded, so
`.\launch-webots.ps1 --mode=fast` works too.

## Installing Webots

The world is pinned to **Webots R2023b** (`#VRML_SIM R2023b` header, and the
`EXTERNPROTO` entries point at that release). Download it from
[cyberbotics.com](https://cyberbotics.com/). A newer release will usually
open the world but may warn about proto versions.

Asset references have been validated:

- 15 local meshes under `stls/`, all resolving from `worlds/factory.wbt`
- the Robotiq 2F-140 gripper meshes and background protos are fetched from
  GitHub on first open, so the **first launch needs internet**

## Known limitations

- **Drift over repeated runs.** Movement is dead-reckoned from wheel encoders
  with hardcoded distances, so position error accumulates across many orders.
  Restart the simulation if the robots stop lining up with the shelves.
- **`stls/arm/link 5 part 3.STL` and `wheel.STL` were removed**. The world
  file references neither.
