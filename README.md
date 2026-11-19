# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project
npx sv create my-app
```

To recreate this project with the same configuration:

```sh
# recreate this project
pnpm dlx sv@0.17.0 create --template minimal --types ts --install pnpm auth
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

## Tests

Install Chromium once with `pnpm exec playwright install chromium`, then run
`pnpm test`. The browser suite starts an isolated PostgreSQL container and
removes it when the run ends. Keep Docker running. Auth API responses are
mocked, so the tests do not create accounts or send email.

## Password compatibility

Password verification accepts imported PocketBase bcrypt hashes (`$2a$` and `$2b$`)
and existing Better Auth scrypt hashes. New passwords, including password changes
and resets, continue to use Better Auth's scrypt implementation. Signing in does
not rewrite an imported hash. Store imported hashes unchanged in the credential
account's `password` field; do not pass them through the signup endpoint.

Run `pnpm test:password` for verifier and Better Auth API regression tests using
an isolated in-memory SQLite database. No external database or email is needed.
These also run before the browser suite in `pnpm test`.

## Deployment

Runs on Kubernetes as an `adapter-node` server image, deployed from a laptop with Skaffold + Kustomize.

| | Prod | Dev (`skaffold dev`) |
|---|---|---|
| URL | https://auth.bevsoft.com | https://auth-dev.bevsoft.com |
| Namespace | `auth` | `auth-dev` |
| Image | `docker.io/bevdev1/auth:<git describe --tags>` | `docker.io/bevdev1/auth:dev` |
| Manifests | `k8s/` | `k8s-dev/` |
| Postgres | `auth` db, Secret `auth/auth-db` | `auth_dev` db, Secret `auth-dev/auth-dev-db` |

The app receives PostgreSQL connection settings separately. The host, port,
and database are set in each Deployment; the database Secret must contain
`username` and `password` keys. For prod these are in `auth/auth-db`; for dev
they are in `auth-dev/auth-dev-db`. The other app secrets live in an `auth-env`
Secret in each namespace, created once by hand:

```sh
kubectl -n auth create secret generic auth-env \
  --from-literal=BETTER_AUTH_SECRET=... \
  --from-literal=GOOGLE_CLIENT_ID=... \
  --from-literal=GOOGLE_CLIENT_SECRET=... \
  --from-literal=RESEND_KEY=... \
  --from-literal=AUTH_EMAIL=...
# and the same in -n auth-dev
```

For local development, set `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and
`PGPASSWORD` in the ignored `.env` file to connect to the Compose database
(`localhost`, `5433`, `auth`, `auth`, `auth`; host port `5433` maps to
Postgres port `5432` in the container). Start it with
`docker compose up -d`. To use the cluster database from your laptop, open a
tunnel in one terminal:

```sh
kubectl -n postgres port-forward svc/db 5433:5432
```

Then start the app in another terminal. These shell variables override the
local `.env` values; the credentials are read from the Kubernetes Secret:

```sh
PGHOST=127.0.0.1 PGPORT=5433 PGDATABASE=auth \
PGUSER="$(kubectl -n auth get secret auth-db -o jsonpath='{.data.username}' | base64 -d)" \
PGPASSWORD="$(kubectl -n auth get secret auth-db -o jsonpath='{.data.password}' | base64 -d)" \
pnpm dev
```

Use `-n auth-dev`, `auth-dev-db`, and `auth_dev` in that command to connect to
the dev cluster database instead. Stop the tunnel and run `pnpm dev` normally
to return to local Postgres.

`BETTER_AUTH_URL`, `ORIGIN` and (prod only) `COOKIE_DOMAIN=bevsoft.com` are set
in the Deployment. Add both hosts' `/api/auth/callback/google` to the Google
OAuth client's redirect URIs.

Release by tagging and running Skaffold:

```sh
git tag -a v0.1.0 -m v0.1.0 && git push origin v0.1.0
skaffold run
kubectl -n auth rollout status deployment/auth
```

Rollback: `git checkout <previous tag> && skaffold run`, or
`kubectl -n auth rollout undo deployment/auth`.

Dev environment with hot reload: `skaffold dev`.

Import existing Supabase accounts: [migration steps](MIGRATE-SUPABASE.md).
