# Production Dockerfile for CampusFlow AI
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/campusflow.db

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Create volume directories for SQLite DB and file uploads
RUN mkdir -p /app/data /app/uploads

# Expose HTTP port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/auth/departments || exit 1

# Start server
CMD ["node", "server.js"]
