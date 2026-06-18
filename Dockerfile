# Base stage: Node.js runtime with system dependencies
FROM node:20-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*

# Dependencies stage: Install npm packages
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY scripts/ensure-native-deps.mjs ./scripts/
RUN npm install --include=optional
RUN node ./scripts/ensure-native-deps.mjs || echo "Warning: Native deps script failed"

# Builder stage: Build the Next.js application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner stage: Production image with minimal footprint
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nextjs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

RUN mkdir -p data rag/uploads && chown -R nextjs:nextjs data rag

USER nextjs
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"
CMD ["node", "server.js"]
