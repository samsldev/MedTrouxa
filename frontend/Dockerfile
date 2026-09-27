FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL=/api
ARG VITE_LEGAL_NAME=
ARG VITE_CNPJ=
ARG VITE_CONTACT_EMAIL=
ARG VITE_WHATSAPP=
ARG VITE_INSTAGRAM=
ENV VITE_API_URL=$VITE_API_URL VITE_LEGAL_NAME=$VITE_LEGAL_NAME VITE_CNPJ=$VITE_CNPJ \
    VITE_CONTACT_EMAIL=$VITE_CONTACT_EMAIL VITE_WHATSAPP=$VITE_WHATSAPP VITE_INSTAGRAM=$VITE_INSTAGRAM
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# nginx sem root, porta 8080
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY proxy.inc /etc/nginx/conf.d/proxy.inc
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
