import assert from "node:assert/strict";
import { test } from "node:test";
import { withAuthCors } from "../src/lib/server/auth-cors.ts";

const endpoint = "https://auth.bevsoft.com/api/auth/sign-out";

for (const origin of ["https://app.bevsoft.com", "https://nested.app.bevsoft.com", "http://localhost:5173"]) {
  test(`allows credentialed sign-out preflight from ${origin} before authentication`, async () => {
    const response = await withAuthCors(new Request(endpoint, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    }), async () => { throw new Error("Preflight must not require a session"); });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.equal(response.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
    assert.equal(response.headers.get("access-control-allow-headers"), "Content-Type, Authorization");
  });
}

for (const origin of [
  "https://bevsoft.com.evil.example",
  "https://evilbevsoft.com",
  "http://app.bevsoft.com",
  "https://app.bevsoft.com:8443",
  "https://app.bevsoft.com/path",
  "null",
]) {
  test(`rejects sign-out from ${origin} before changing the session`, async () => {
    for (const method of ["OPTIONS", "POST"]) {
      const response = await withAuthCors(new Request(endpoint, {
        method,
        headers: { origin },
      }), async () => { throw new Error("Disallowed origins must not reach auth"); });

      assert.equal(response.status, 403);
      assert.equal(await response.text(), "Origin not allowed");
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    }
  });
}

for (const status of [200, 401]) {
  test(`preserves the auth response and cookie deletion headers on status ${status}`, async () => {
    const cookies = [
      "session_token=; Domain=bevsoft.com; Max-Age=0; Path=/; HttpOnly; Secure",
      "session_data=; Domain=bevsoft.com; Max-Age=0; Path=/; HttpOnly; Secure",
    ];
    const headers = new Headers({ Vary: "Accept" });
    for (const cookie of cookies) headers.append("Set-Cookie", cookie);
    const response = await withAuthCors(new Request(endpoint, {
      method: "POST",
      headers: { origin: "https://app.bevsoft.com" },
    }), async () => Response.json({ status: status === 200 }, { status, headers }));

    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { status: status === 200 });
    assert.equal(response.headers.get("access-control-allow-origin"), "https://app.bevsoft.com");
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.equal(response.headers.get("vary"), "Accept, Origin");
    assert.deepEqual(response.headers.getSetCookie(), cookies);
  });
}

test("continues serving auth requests without an Origin header", async () => {
  const response = await withAuthCors(new Request(endpoint), async () => Response.json({ session: null }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { session: null });
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("vary"), "Origin");
});

test("leaves non-auth routes outside the CORS policy", async () => {
  const response = await withAuthCors(new Request("https://auth.bevsoft.com/health", {
    headers: { origin: "https://unrelated.example" },
  }), async () => new Response("healthy"));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "healthy");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});
