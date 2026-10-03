FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# App code (lib/, api/, demo/, scripts/, server.js). Secrets are injected at
# runtime via env_file, never baked into the image.
COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
