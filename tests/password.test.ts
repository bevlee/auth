import assert from "node:assert/strict";
import { test } from "node:test";
import { hash as bcryptHash } from "bcryptjs";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { verifyPassword } from "better-auth/crypto";
import Database from "better-sqlite3";
import { passwordOptions } from "../src/lib/server/password.ts";

const password = "PocketBase-password-123";

for (const prefix of ["$2a$", "$2b$"]) {
  test(`accepts PocketBase bcrypt ${prefix} and rejects incorrect passwords`, async () => {
    const hash = (await bcryptHash(password, 4)).replace(/^\$2b\$/, prefix);
    assert.equal(await passwordOptions.verify({ hash, password }), true);
    assert.equal(await passwordOptions.verify({ hash, password: "incorrect-password" }), false);
  });
}

test("continues creating and verifying Better Auth scrypt passwords", async () => {
  const hash = await passwordOptions.hash(password);
  assert.equal(hash.startsWith("$2"), false);
  assert.equal(await verifyPassword({ hash, password }), true);
  assert.equal(await passwordOptions.verify({ hash, password }), true);
  assert.equal(await passwordOptions.verify({ hash, password: "incorrect-password" }), false);
});

test("rejects malformed stored hashes without throwing", async () => {
  for (const hash of ["", "not-a-hash", "$2a$12$broken", "$2b$99$" + "a".repeat(53)]) {
    assert.equal(await passwordOptions.verify({ hash, password }), false);
  }
});

test("Better Auth signs in both account types and changes an imported password to scrypt", async () => {
  const database = new Database(":memory:");
  try {
    const options = {
      database,
      baseURL: "http://localhost:3000",
      secret: "password-test-secret-at-least-32-characters",
      emailAndPassword: { enabled: true, password: passwordOptions },
    };
    const { runMigrations } = await getMigrations(options);
    await runMigrations();
    const auth = betterAuth(options);
    for (const [id, hash] of [
      ["imported", (await bcryptHash(password, 4)).replace(/^\$2b\$/, "$2a$")],
      ["existing", await passwordOptions.hash(password)],
    ]) {
      database.prepare(`INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
        VALUES (?, ?, ?, 1, ?, ?)`).run(id, id, `${id}@example.com`, Date.now(), Date.now());
      database.prepare(`INSERT INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt)
        VALUES (?, ?, 'credential', ?, ?, ?, ?)`).run(id, id, id, hash, Date.now(), Date.now());
    }
    async function request(path: string, body: object, cookie = "") {
      return auth.handler(new Request(`http://localhost:3000/api/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000", cookie },
        body: JSON.stringify(body),
      }));
    }
    for (const id of ["imported", "existing"]) {
      const response = await request("sign-in/email", { email: `${id}@example.com`, password });
      assert.equal(response.status, 200);
      const wrong = await request("sign-in/email", { email: `${id}@example.com`, password: "incorrect-password" });
      assert.equal(wrong.status, 401);
      if (id === "imported") {
        const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
        const newPassword = "replacement-password-456";
        const changed = await request("change-password", { currentPassword: password, newPassword }, cookie);
        assert.equal(changed.status, 200);
        const account = database.prepare("SELECT password FROM account WHERE id = ?").get(id);
        assert.ok(account && typeof account === "object" && "password" in account && typeof account.password === "string");
        assert.equal(await verifyPassword({ hash: account.password, password: newPassword }), true);
        assert.equal((await request("sign-in/email", { email: `${id}@example.com`, password: newPassword })).status, 200);
        assert.equal((await request("sign-in/email", { email: `${id}@example.com`, password })).status, 401);
      }
    }
  } finally {
    database.close();
  }
});
