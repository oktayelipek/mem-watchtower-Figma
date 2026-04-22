# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

ARG VITE_FIGMA_TEAM_IDS=""
RUN npm run build

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine

ENV NODE_ENV=production

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["npm", "start"]
