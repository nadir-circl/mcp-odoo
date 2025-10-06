FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# 1) Install deps (dev deps included so we can build). If there's no lockfile, fall back to npm install.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 2) Copy source and build TS -> dist
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 3) Drop dev deps for a slimmer runtime image
RUN npm prune --omit=dev

EXPOSE 3000
CMD ["node", "dist/server.js"]
