// The fleet operator's price list for robot labour, denominated in USDC.
//
// Owned by the FLEET OPERATOR, not the warehouse — the warehouse discovers
// these prices in the 402 challenge rather than assuming them.
//
// Prices are stablecoin-denominated, so a job costs the same tomorrow as it
// does today. Each phase has a call-out fee plus a rate per kilogram, because
// lifting 35 kg is not the same job as lifting 2 kg. USDC's 6 decimals are
// what make these sub-cent amounts expressible at all: a 2 kg pick costs
// $0.0007, which no card network could settle profitably.

export const USDC_TOKEN = process.env.USDC_TOKEN ?? '0.0.5449';
export const USDC_DECIMALS = 6;

export const TARIFF = {
    picking: { baseUsdc: 0.0005, perKgUsdc: 0.0001 }, // lifting off the shelf
    packing: { baseUsdc: 0.0008, perKgUsdc: 0.00005 }, // wrapping scales least
    delivery: { baseUsdc: 0.001, perKgUsdc: 0.00008 }, // hauling to the dock
};

export const PHASES = Object.keys(TARIFF);

/** Fee to unlock one robot task, in USDC. */
export const feeFor = (phase, weightKg) => {
    const rate = TARIFF[phase];
    if (!rate) throw new Error(`unknown phase: ${phase}`);
    const weight = Number(weightKg);
    if (!Number.isFinite(weight) || weight < 0) throw new Error(`bad weight: ${weightKg}`);
    // Round to the smallest unit USDC can express.
    return Number((rate.baseUsdc + rate.perKgUsdc * weight).toFixed(USDC_DECIMALS));
};

export const toAtomic = (usdc) =>
    BigInt(Math.round(usdc * 10 ** USDC_DECIMALS)).toString();
