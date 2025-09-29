# Stage 1: Build frontend
FROM node:24-alpine AS build

WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy all frontend files
COPY frontend/ ./

# Build the frontend (creates build/ folder)
RUN npm run build

# Stage 2: Serve frontend with Node
FROM node:24-alpine

WORKDIR /app

# Copy built frontend from previous stage
COPY --from=build /app/frontend/build ./frontend/build

# Install a lightweight server to serve static files
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Serve the static build
CMD ["serve", "-s", "frontend/build", "-l", "3000"]
