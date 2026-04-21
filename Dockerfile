FROM node:20-alpine

# Required for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_ vars are baked in at build time — pass via Coolify Build Variables
ARG VITE_FIGMA_TEAM_IDS

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
