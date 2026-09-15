# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci
# High/critical смотреть в логе; внутренний релиз из-за audit не блокируем.
RUN npm audit --omit=dev || true

COPY index.html tsconfig.json vite.config.ts server.ts ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache su-exec

COPY package.json package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY migrations ./migrations
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p /app/data/files && chown -R node:node /app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
CMD ["node", "dist/server.cjs"]
