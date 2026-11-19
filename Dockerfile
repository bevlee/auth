# --- build stage ---
FROM docker.io/node:22-bookworm-slim AS builder
WORKDIR /app
RUN npm install -g pnpm@10.17.1

# Manifests before source: pnpm install re-runs only when dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
# SvelteKit imports server modules while analysing the build, and Resend and
# Better Auth throw without these; the real values come from the auth-env
# Secret at runtime.
RUN RESEND_KEY=build-placeholder BETTER_AUTH_SECRET=build-placeholder-build-placeholder \
    pnpm run build && pnpm prune --prod

# --- run stage ---
# adapter-node server as the unprivileged node user (uid 1000) on port 3000.
FROM docker.io/node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build

USER node
EXPOSE 3000
CMD ["node", "build"]
