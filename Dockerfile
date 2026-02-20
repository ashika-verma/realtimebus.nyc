FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and pre-built GTFS data
COPY . .

# Build the Vite frontend
RUN npm run build

EXPOSE 3001

CMD ["node", "server/index.js"]
