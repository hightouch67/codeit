# CodeIt Server Dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better layer caching
COPY server/package.json server/package-lock.json* ./server/
COPY shared/ ./shared/

WORKDIR /app/server
RUN npm install

# Copy server source
COPY server/ .

# Build TypeScript
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
