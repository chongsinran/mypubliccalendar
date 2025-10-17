FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=5001

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY public ./public

EXPOSE 5001

CMD [ "node", "src/index.js" ]
