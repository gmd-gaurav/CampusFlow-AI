
# Production Dockerfile for CampusFlow AI
FROM node:24-alpine

# Application directory
WORKDIR /app

# Production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/campusflow.db

# Install native build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Create persistent storage directories
RUN mkdir -p /app/data /app/uploads

# Application port
EXPOSE 3000

# Container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/auth/departments || exit 1

# Start application
CMD ["npm", "start"]
