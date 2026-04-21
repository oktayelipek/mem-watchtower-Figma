FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_ vars are baked in at build time — pass via Coolify Build Variables
ARG VITE_FIGMA_CLIENT_ID
ARG VITE_FIGMA_REDIRECT_URI
ARG VITE_FIGMA_TEAM_IDS

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
