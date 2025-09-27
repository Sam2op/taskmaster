# Use Node.js 18 Alpine as base image for smaller size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Add metadata
LABEL maintainer="your-email@example.com"
LABEL description="TaskMaster - Modern To-Do List Application"
LABEL version="1.0.0"

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S taskmaster -u 1001

# Copy application files
COPY . .
RUN chown -R taskmaster:nodejs /app
USER taskmaster

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["npm", "start"]
