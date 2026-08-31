# Imagen del frontend para servir en la red institucional (LAN).
#
# A diferencia de "npm run dev", aqui se hace un build estatico de la SPA y se
# sirve con nginx, que ademas hace de proxy inverso de /api hacia el backend.
# Esto permite que el sistema se abra desde CUALQUIER equipo de la red por la
# IP del servidor (la API se resuelve como ruta relativa /api, no como
# "localhost", que solo funcionaria en la propia CPU servidor).

# --- Etapa 1: build de la SPA (React + Vite) ---
FROM node:18-bookworm-slim AS build

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# La API se consume como ruta relativa; nginx (etapa 2) la enruta al backend.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Etapa 2: servidor estatico + proxy ---
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
