'use client';

// Self-contained fallback for the Robot Simulator panel: an animated view of
// the fleet member hauling the tokenized product between warehouse zones,
// driven by the order's current phase. Used when no recorded Webots footage
// is available, so the panel is never blank.

const PRODUCT_NAMES = ['Green', 'Purple', 'Blue'];
const PRODUCT_COLORS = ['#22c55e', '#a855f7', '#3b82f6'];

interface Props {
    status: 'picking' | 'packing' | 'delivery';
    productId: number;
}

export default function SimulationScene({ status, productId }: Props) {
    const color = PRODUCT_COLORS[productId] ?? PRODUCT_COLORS[0];

    const route = {
        picking: {
            from: `${PRODUCT_NAMES[productId] ?? 'Product'} Shelf`,
            to: 'Order Buffer Zone',
            robot: 'Picking Robot',
        },
        packing: { from: 'Order Buffer Zone', to: 'Packout Zone', robot: 'Packing Robot' },
        delivery: { from: 'Packout Zone', to: 'Delivery Zone', robot: 'Delivery Robot' },
    }[status];

    return (
        <div className='w-full h-full flex flex-col items-center justify-center gap-y-6 px-8'>
            <svg viewBox='0 0 420 200' className='w-full max-w-[460px]' role='img'>
                <title>{`${route.robot} moving product from ${route.from} to ${route.to}`}</title>

                {/* floor */}
                <line x1='0' y1='170' x2='420' y2='170' stroke='var(--tetriary)' strokeWidth='1' />
                <g stroke='var(--tetriary)' strokeWidth='1' opacity='0.5'>
                    {Array.from({ length: 14 }, (_, i) => (
                        <line
                            key={i}
                            x1={i * 30}
                            y1='170'
                            x2={i * 30 - 12}
                            y2='182'
                            className='crowd-floor'
                            style={{ animationDelay: `${(i % 4) * -0.25}s` }}
                        />
                    ))}
                </g>

                {/* source / destination platforms */}
                <rect x='6' y='150' width='96' height='20' rx='3' fill='var(--gray-background)' stroke='var(--tetriary)' />
                <rect x='318' y='150' width='96' height='20' rx='3' fill='var(--gray-background)' stroke='var(--tetriary)' />

                {/* travelling robot */}
                <g className='crowd-haul'>
                    <g className='crowd-bob'>
                        {/* the product, held in the gripper */}
                        <rect x='38' y='84' width='18' height='18' rx='2' fill={color} />
                        {/* arm */}
                        <path
                            d='M47 104 L47 118 M36 118 L58 118'
                            stroke='var(--secondary)'
                            strokeWidth='3'
                            strokeLinecap='round'
                        />
                        <path
                            d='M47 118 L47 132'
                            stroke='var(--foreground)'
                            strokeWidth='4'
                            strokeLinecap='round'
                        />
                        {/* body */}
                        <rect x='22' y='130' width='50' height='24' rx='4' fill='var(--foreground)' />
                        {/* wheels */}
                        <circle cx='34' cy='158' r='7' fill='var(--secondary)' />
                        <circle cx='60' cy='158' r='7' fill='var(--secondary)' />
                    </g>
                </g>

                {/* zone labels */}
                <text x='54' y='196' textAnchor='middle' fontSize='10' fill='var(--secondary)'>
                    {route.from}
                </text>
                <text x='366' y='196' textAnchor='middle' fontSize='10' fill='var(--secondary)'>
                    {route.to}
                </text>
            </svg>

            <div className='flex items-center gap-x-2.5'>
                <div className='spinner' />
                <h4>
                    {route.robot} in transit — {route.from} → {route.to}
                </h4>
            </div>
        </div>
    );
}
