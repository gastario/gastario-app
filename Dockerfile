FROM node:22-slim

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
