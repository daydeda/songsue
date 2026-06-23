# Base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache and uploads.
# .uploads-private holds PDPA form docs + payment slips when running without
# Supabase Storage; it must exist and be writable by the nextjs user, and is
# bind-mounted to the host in docker-compose.yml so the data persists.
RUN mkdir -p public/uploads .uploads-private && chown -R nextjs:nodejs public/uploads .uploads-private

# Copy built code and configuration
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/.next.nosync ./.next.nosync

# Source + maintenance scripts needed to run migrations/seed/elevate/file-import
# from the Portainer web console (there is no host shell on the swarm). These read
# DATABASE_URL straight from the container env — no .env file required. tsx is
# present because the `deps` stage runs `npm ci` (installs devDependencies too).
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/elevate-admin.ts ./elevate-admin.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "start"]
