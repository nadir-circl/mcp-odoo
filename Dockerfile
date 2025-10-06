FROM node:20-slim

WORKDIR /app
# Don't set NODE_ENV yet — we need dev deps to build
ENV PORT=3000

# 1) Install deps (dev deps included). If no lockfile, fall back to npm install.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 2) Copy source and build TS -> dist
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# 3) Drop dev deps and switch to production
RUN npm prune --omit=dev
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", "dist/server.js"]
