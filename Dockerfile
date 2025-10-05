# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_OPENWEATHER_API_KEY
ENV VITE_OPENWEATHER_API_KEY=$VITE_OPENWEATHER_API_KEY
RUN test -n "$VITE_OPENWEATHER_API_KEY" || (echo "VITE_OPENWEATHER_API_KEY build arg is required" >&2 && exit 1)
RUN npm run build

FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist ./
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
