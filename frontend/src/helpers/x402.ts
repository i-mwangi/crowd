// x402 payment gate (server-side).
// Order placement is a paid resource: unpaid requests get HTTP 402 with a
// `payment-required` challenge; payment settles on Hedera testnet through the
// facilitator BEFORE fulfillment begins. Mock mode skips the gate.

import {
    HTTPFacilitatorClient,
    x402HTTPResourceServer,
    x402ResourceServer,
    type HTTPRequestContext,
    type RoutesConfig,
} from '@x402/core/server';
import type { Network } from '@x402/core/types';
import { ExactHederaScheme } from '@x402/hedera/exact/server';

import { productPricesHbar } from '@/constants';

const HBAR_DECIMALS = 8;
export const hbarToTinybar = (hbar: number): string =>
    BigInt(Math.round(hbar * 10 ** HBAR_DECIMALS)).toString();

export const isLivePayments = (): boolean =>
    process.env.X402_MODE !== 'mock' &&
    Boolean(process.env.PAY_TO_ACCOUNT && process.env.HEDERA_AGENT_ID && process.env.HEDERA_AGENT_KEY);

export interface SettledPayment {
    settled: boolean;
    transactionId?: string;
    payer?: string;
    mode: 'live' | 'mock';
}

export type GateResult =
    | { kind: 'response'; response: Response }
    | { kind: 'paid'; payment: SettledPayment };

const requestAdapter = (request: Request) => {
    const url = new URL(request.url);
    return {
        getHeader: (name: string) => request.headers.get(name) ?? undefined,
        getMethod: () => request.method,
        getPath: () => url.pathname,
        getUrl: () => request.url,
        getAcceptHeader: () => request.headers.get('accept') ?? 'application/json',
        getUserAgent: () => request.headers.get('user-agent') ?? '',
        getQueryParams: () => Object.fromEntries(url.searchParams.entries()),
        getQueryParam: (name: string) => url.searchParams.get(name) ?? undefined,
    };
};

const globalX402 = globalThis as unknown as { __crowdX402?: Promise<x402HTTPResourceServer> };

const buildServer = async (): Promise<x402HTTPResourceServer> => {
    const core = new x402ResourceServer(
        new HTTPFacilitatorClient({
            url: process.env.FACILITATOR_URL ?? 'https://api.testnet.blocky402.com',
        })
    ).register('hedera:*', new ExactHederaScheme());

    const routes: RoutesConfig = {
        'POST /api/orders': {
            description:
                'Place a warehouse fulfillment order — x402 payment settles on Hedera before robots start',
            accepts: {
                scheme: 'exact',
                network: (process.env.HEDERA_NETWORK ?? 'hedera:testnet') as Network,
                payTo: process.env.PAY_TO_ACCOUNT as string,
                maxTimeoutSeconds: 180,
                price: (ctx: HTTPRequestContext) => {
                    const productId = Number(ctx.adapter.getQueryParam?.('product'));
                    const price = productPricesHbar[productId];
                    if (price == undefined)
                        throw new Error(`Unknown product for pricing: ${productId}`);
                    return { asset: '0.0.0', amount: hbarToTinybar(price) };
                },
            },
        },
    };

    const server = new x402HTTPResourceServer(core, routes);
    await server.initialize();
    return server;
};

const getServer = (): Promise<x402HTTPResourceServer> =>
    (globalX402.__crowdX402 ??= buildServer());

export async function gateOrderPayment(request: Request): Promise<GateResult> {
    if (!isLivePayments()) {
        return {
            kind: 'paid',
            payment: {
                settled: true,
                transactionId: `mock-${Date.now()}@simulated`,
                payer: '0.0.MOCK',
                mode: 'mock',
            },
        };
    }

    const server = await getServer();
    const context: HTTPRequestContext = {
        adapter: requestAdapter(request),
        path: new URL(request.url).pathname,
        method: request.method,
        paymentHeader:
            request.headers.get('payment-signature') ??
            request.headers.get('x-payment') ??
            undefined,
    };

    const result = await server.processHTTPRequest(context);

    if (result.type === 'payment-error') {
        const { status, headers, body, isHtml } = result.response;
        return {
            kind: 'response',
            response: isHtml
                ? new Response(String(body ?? ''), {
                      status,
                      headers: { ...headers, 'content-type': 'text/html' },
                  })
                : Response.json(body ?? {}, { status, headers }),
        };
    }

    if (result.type === 'no-payment-required') {
        return { kind: 'paid', payment: { settled: false, mode: 'live' } };
    }

    const settlement = await server.processSettlement(
        result.paymentPayload,
        result.paymentRequirements,
        result.declaredExtensions
    );

    if (!settlement.success) {
        return {
            kind: 'response',
            response: Response.json(
                { error: 'Payment settlement failed', reason: settlement.errorReason },
                { status: 402 }
            ),
        };
    }

    return {
        kind: 'paid',
        payment: {
            settled: true,
            transactionId: settlement.transaction,
            payer: settlement.payer,
            mode: 'live',
        },
    };
}
