import { NextResponse } from 'next/server';

import { productPricesHbar } from '@/constants';
import { getStock } from '@/helpers/contract-server';

export async function GET() {
    return NextResponse.json({
        stock: await getStock(),
        pricesHbar: productPricesHbar,
    });
}
