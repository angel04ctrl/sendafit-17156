const localOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function configuredOrigins() {
  return (Deno.env.get("ALLOWED_ORIGINS") || Deno.env.get("APP_ORIGIN") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getCorsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigins = [...configuredOrigins(), ...localOrigins];
  const isAllowed = !origin || allowedOrigins.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed && origin ? origin : "null",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function isAllowedRequestOrigin(req: Request): boolean {
  const origin = req.headers.get("Origin");
  if (!origin) return true;
  return [...configuredOrigins(), ...localOrigins].includes(origin);
}

export function handleCors(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  if (!isAllowedRequestOrigin(req)) {
    return new Response(null, { status: 403, headers: getCorsHeaders(req) });
  }
  return new Response(null, { headers: getCorsHeaders(req) });
}

export function jsonResponse(req: Request, body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), ...extraHeaders, "Content-Type": "application/json" },
  });
}
