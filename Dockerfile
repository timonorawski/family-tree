# --- Static readonly build (default) ---
FROM node:22-alpine AS build-static
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ ./packages/
RUN npm ci
COPY . .
RUN npm run prepare && VITE_STATIC=true npm run build

FROM nginx:alpine AS static
COPY --from=build-static /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# --- Encrypted static build ---
FROM node:22-alpine AS build-encrypted
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ ./packages/
RUN npm ci
COPY . .
ARG STATIC_CRYPT_SECRET
ARG STATIC_CRYPT_TIERS=family
ENV STATIC_CRYPT_SECRET=${STATIC_CRYPT_SECRET}
ENV STATIC_CRYPT_TIERS=${STATIC_CRYPT_TIERS}
RUN npm run prepare && npm run build:encrypted

FROM nginx:alpine AS encrypted
COPY --from=build-encrypted /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

# --- Editable Node server build ---
FROM node:22-alpine AS build-node
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ ./packages/
RUN npm ci
COPY . .
RUN npm run prepare && NODE_ADAPTER=true npm run build
RUN npm prune --production

FROM node:22-alpine AS editable
WORKDIR /app
COPY --from=build-node /app/build ./build
COPY --from=build-node /app/node_modules ./node_modules
COPY --from=build-node /app/package.json ./
COPY --from=build-node /app/data ./data
ENV PORT=3000
EXPOSE 3000
CMD ["node", "build"]
