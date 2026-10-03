# Panel web (admin, mini-sistemas de empresas, /sitio y /activar) servido por Caddy,
# que además hace de proxy hacia el backend y saca el certificado HTTPS solo.
FROM node:20-alpine AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY --from=build /web/dist /srv/web
COPY Caddyfile /etc/caddy/Caddyfile
