FROM mcr.microsoft.com/playwright:v1.62.0-noble

WORKDIR /app

COPY services/supplier-portal-worker/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate --schema=./prisma/schema.prisma

COPY services/supplier-portal-worker/crypto.mjs ./crypto.mjs
COPY services/supplier-portal-worker/server.mjs ./server.mjs

ENV NODE_ENV=production

CMD ["node", "server.mjs"]
