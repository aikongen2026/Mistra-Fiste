# Mistra Fiske: Docker deployment for the existing Render web service.
# No API keys or local .env files are copied into the image.
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    && npm cache clean --force

FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production \
    PORT=10000 \
    CACHE_DIR=/app/.cache
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json server.js ./
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts
# Catch incomplete uploads and missing map assets during the build.
RUN npm run verify \
    && node scripts/verify-vendor.js \
    && mkdir -p /app/.cache \
    && chown node:node /app/.cache
USER node
EXPOSE 10000
# Direct Node process receives stop signals; the app reads Render's PORT.
CMD ["node", "server.js"]
