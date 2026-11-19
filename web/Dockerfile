# Panel web servido por Caddy interno; HTTPS lo termina el Caddy compartido.
FROM node:20-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /web/dist /srv/web
COPY Caddyfile /etc/caddy/Caddyfile
