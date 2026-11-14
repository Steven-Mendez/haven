// T01 backend · HTTP helpers for route handlers: open CORS (`*`) so the phone's web build can call the API.

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Haven-Actor',
  'Access-Control-Max-Age': '86400',
} as const;

/** JSON response with CORS and no caching. */
export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
  });
}

export function error(status: number, message: string, details?: string[]): Response {
  return json(details ? { error: message, details } : { error: message }, status);
}

/** CORS preflight answer for every route. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Parses the JSON body; `undefined` if it is not valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** Wraps a handler: database failures become 503 instead of an HTML error page. */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (e) {
    console.error('[earth api]', e);
    return error(503, 'Database unavailable', [(e as Error).message]);
  }
}
