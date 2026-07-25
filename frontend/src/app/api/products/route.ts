import { NextResponse } from 'next/server';

import { productPricesUsdc, productWeightsKg } from '@/constants';
import { getStock } from '@/helpers/contract-server';

export async function GET() {
    return NextResponse.json({
        stock: await getStock(),
        pricesUsdc: productPricesUsdc,
        weightsKg: productWeightsKg,
    });
}
