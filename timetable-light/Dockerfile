# Stage 1: Build Next.js application
FROM node:20-alpine AS builder

WORKDIR /app

# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Copy dependency files
COPY package*.json ./

# Install all dependencies (including devDependencies for tailwind compilation)
RUN npm ci

# Copy source code and static files
COPY . .

# Build application
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy dependency files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled Next.js output and public assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next

# Expose port (default Next.js production port)
EXPOSE 3000

# Start Next.js server
CMD ["npm", "run", "start"]
