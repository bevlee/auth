const domain = "bevsoft.com";
// Apps on this machine (e.g. EK on 127.0.0.1), only trusted outside production.
// The Docker image sets NODE_ENV=production.
const localOrigins = process.env.NODE_ENV === "production"
  ? []
  : [5173, 5174, 5175].flatMap((port) => [
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
    ]);

export const trustedOrigins = [`https://*.${domain}`, ...localOrigins];

function isAllowedOrigin(origin: string): boolean {
  if (localOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    return origin === url.origin && url.protocol === "https:" &&
      url.port === "" && url.hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

export async function withAuthCors(
  request: Request,
  next: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== "/api/auth" && !url.pathname.startsWith("/api/auth/")) {
    return next();
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin && !isAllowedOrigin(origin)) {
    return new Response("Origin not allowed", {
      status: 403,
      headers: { Vary: "Origin" },
    });
  }

  if (origin && request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "600",
        Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
      },
    });
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.append("Vary", "Origin");
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
