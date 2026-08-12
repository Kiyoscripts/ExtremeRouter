FROM node:22-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application
COPY . .

# Build
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0
ENV DATA_DIR=/app/data
ENV NEXT_TELEMETRY_DISABLED=1

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 20128

# Start the app
CMD ["node", "custom-server.js"]
