FROM node:22-alpine AS base
WORKDIR /app

FROM base AS builder

RUN apk add --no-cache python3 make g++

COPY package.json ./
RUN npm install

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/app/data
ENV NEXT_TELEMETRY_DISABLED=1

# Copy the entire standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create data directory
RUN mkdir -p /app/data

USER node

EXPOSE 20128

# IMPORTANT: Use server.js from standalone, NOT custom-server.js
CMD ["node", "server.js"]
