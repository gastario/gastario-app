FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    xauth \
    ca-certificates \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.mjs ./
COPY auth.mjs ./
COPY crypto-vault.mjs ./
COPY login-ticket-store.mjs ./
COPY browser-runtime.mjs ./
COPY provider-registry.mjs ./
COPY session-store.mjs ./
COPY providers ./providers

ENV NODE_ENV=production
ENV SUPPLIER_HUB_SESSION_DIR=/data/supplier-sessions
ENV SUPPLIER_HUB_CHROMIUM_PATH=/usr/bin/chromium
ENV SUPPLIER_HUB_BROWSER_HEADLESS=0

RUN mkdir -p /data/supplier-sessions \
  && chmod 700 /data/supplier-sessions


EXPOSE 8080

CMD ["sh", "-c", "xvfb-run -a -s '-screen 0 1280x800x24' node server.mjs"]
