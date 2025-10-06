# Use an official Node image
FROM node:20-slim

WORKDIR /app
ENV NODE_ENV=production

# install deps first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# copy source
COPY tsconfig.json ./
COPY src ./src

# build
RUN npx tsc

# runtime
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/server.js"]
