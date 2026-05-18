# Stage 1: Build the TypeScript application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies (including devDependencies for building)
RUN npm ci

# Copy Prisma schema and generate Client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code and config
COPY . .

# Build application
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy dependency files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy Prisma files and generate client inside production modules
COPY prisma ./prisma
RUN npx prisma generate

# Copy compiled JavaScript, static files and uploads
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Expose port (default is 3001)
EXPOSE 3001
ENV PORT=3001

# Command to run database pushes and then start the Express server
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
