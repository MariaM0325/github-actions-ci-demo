# syntax=docker/dockerfile:1

# Etapa 1: build (instala solo dependencias de produccion)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY app.js server.js ./

# Etapa 2: runtime minimo
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/app.js /app/server.js ./
USER node
EXPOSE 3000
CMD ["node", "server.js"]
