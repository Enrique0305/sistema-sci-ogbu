# Imagen del backend (API REST + script de sincronizacion Oracle SUM).
# Usa Debian "bookworm" (no "trixie") a proposito: ahi el paquete
# libaio1 todavia existe con ese nombre exacto, que es lo que necesita
# el Oracle Instant Client (modo Thick) para funcionar en Linux.
FROM node:18-bookworm-slim

WORKDIR /app

# --- Oracle Instant Client (modo Thick) ---
# Necesario porque el ewallet.pem del Wallet institucional viene cifrado
# y no se cuenta con esa contraseña; cwallet.sso (auto-login, sin
# password) solo lo pueden leer las librerias nativas de Oracle, no el
# modo Thin puro-JS. Ver README, seccion "Integracion con Oracle SUM".
RUN apt-get update \
    && apt-get install -y --no-install-recommends libaio1 unzip curl \
    && rm -rf /var/lib/apt/lists/*

ARG ORACLE_INSTANTCLIENT_URL=https://download.oracle.com/otn_software/linux/instantclient/2326300/instantclient-basic-linux.x64-23.26.3.0.0.zip
RUN curl -sL -o /tmp/instantclient.zip "$ORACLE_INSTANTCLIENT_URL" \
    && mkdir -p /opt/oracle \
    && unzip -q /tmp/instantclient.zip -d /opt/oracle \
    && mv /opt/oracle/instantclient_* /opt/oracle/instantclient \
    && rm /tmp/instantclient.zip

# Se sobreescribe en docker-compose.yml de todas formas (la ruta del host
# en backend/.env no aplica dentro del contenedor); se deja aqui como
# valor por defecto sensato si la imagen se corre suelta.
ENV ORACLE_INSTANT_CLIENT_DIR=/opt/oracle/instantclient

# --- Dependencias Node ---
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000
CMD ["node", "src/server.js"]
