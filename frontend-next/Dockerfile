FROM node:20-alpine AS build
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Clean install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Ensure public directory exists
RUN mkdir -p public

# Build the application
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy package.json and install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application
COPY --from=build /app/.next ./.next

# Copy public directory
COPY --from=build /app/public ./public

# Copy next config
COPY --from=build /app/next.config.js ./

EXPOSE 3000
CMD ["npm", "run", "start"]


