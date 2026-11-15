# Import Supabase accounts into Better Auth

The importer copies user IDs, emails, verification status, profile fields and bcrypt password hashes. Existing Supabase passwords remain valid, including passwords shorter than eight characters. New passwords still require eight characters.

Matching destination users are replaced when you pass `--overwrite`. Unrelated destination users remain. A matching email takes the Supabase user ID; the report records any replaced destination IDs. Check applications that store those old IDs outside this database before proceeding. The importer stops if other database tables reference users whose IDs would be removed, or reference accounts that would be replaced.

Affected Better Auth sessions and reset tokens are revoked. Users must sign in again. Supabase sessions, reset links, MFA and application data are not migrated. The current app supports email/password and Google identities; the importer refuses unsupported providers and MFA accounts.

## 1. Prepare the release and source

Deploy this version first. It includes bcrypt verification and allows short passwords on the login form. Keep the existing Better Auth database schema; the importer requires its `user`, `account`, `session` and `verification` tables.

Pause account creation, password changes and resets in the old Supabase app before the final export. If users have changed since this backup, take a fresh backup before importing:

```sh
.backups/supabase/investments-20261021T221935+1100
```

This backup contains six users with password hashes and two email identities. The importer creates six credential accounts, using hashes from the users table. Password lengths cannot be recovered from hashes.

Install dependencies with `pnpm install`. Docker must be running with the `postgres:17-alpine` image available. Install PostgreSQL 17 client tools (`pg_dump`, `pg_restore`), or a version compatible with the destination server. Source SQL is restored only into an isolated temporary Docker database, which is removed afterward. Checksums are checked against `manifest.json`.

## 2. Connect to the destination

Confirm your Kubernetes context selects the intended production cluster:

```sh
kubectl config current-context
kubectl -n db get svc postgres
```

In a separate terminal, keep the database tunnel running:

```sh
kubectl -n db port-forward svc/postgres 5434:5432
```

In the project terminal, set explicit destination credentials. These commands read the existing Kubernetes Secret without displaying the values. The importer does not load or edit `.env`.

```sh
export PGHOST=127.0.0.1
export PGPORT=5434
export PGDATABASE=auth
export PGUSER="$(kubectl -n auth get secret auth-db -o jsonpath='{.data.username}' | base64 -d)"
export PGPASSWORD="$(kubectl -n auth get secret auth-db -o jsonpath='{.data.password}' | base64 -d)"
```

## 3. Preview the import

```sh
pnpm migrate:supabase --backup .backups/supabase/investments-20261021T221935+1100
```

The default is a dry run. Expect `users: 6`, `credentials: 6`, `google: 0`, and `applied: false` for this backup. Review the destination host, port and database, matching user count and replaced IDs. The preview uses a brief table lock but writes no rows.

## 4. Apply during a short maintenance window

Pause the destination app so account requests cannot race the cutover. The manifest currently has one replica; record the current count if you have changed it.

```sh
kubectl -n auth scale deployment/auth --replicas=0
kubectl -n auth wait --for=delete pod -l app=auth --timeout=120s
pnpm migrate:supabase --backup .backups/supabase/investments-20261021T221935+1100 --apply --overwrite
```

Before changing rows, the command saves a full destination dump to `.backups/pre-supabase-import-<timestamp>/destination.dump`. It aborts if that backup fails. The import runs in one transaction, and a successful run writes `report.json` alongside the dump. Both files are private and ignored by Git.

Check for `applied: true`, then resume the app:

```sh
kubectl -n auth scale deployment/auth --replicas=1
kubectl -n auth rollout status deployment/auth
unset PGPASSWORD PGUSER PGHOST PGPORT PGDATABASE
```

Sign in with one old account and verify its profile. Test a password reset on an address you control if needed. These tests do not need users' passwords sent to anyone.

Do not rerun the old snapshot after users resume changing passwords: it would restore their old hashes. Reapplying before cutover creates no duplicate users or accounts.

## If the import fails

An error before commit rolls back database changes. Inspect the printed status before resuming the app. A failure writing the report can occur after commit; run a dry run and inspect destination rows before assuming nothing changed.

To undo a completed import, keep the app paused and restore the **destination** dump created immediately before that import. With the same destination PG variables set:

```sh
pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error \
  --dbname="$PGDATABASE" .backups/pre-supabase-import-<timestamp>/destination.dump
```

This restores the destination database to its pre-import contents, discarding later changes. Resume the app only after a successful restore.

## Local verification

```sh
pnpm test:import
pnpm test
pnpm check
```

Tests use temporary Docker databases. The six-account backup was also rehearsed locally: all six hashes were copied exactly, dry run left the destination empty, and a second application created no duplicates. The private result is saved beside the backup in `better-auth-import-rehearsal.json`. Production was not changed by that rehearsal.
