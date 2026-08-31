# Imagen del backend (API REST + script de sincronizacion Oracle SUM).
# Usa Debian "bookworm" (no "trixie") a proposito: ahi el paquete
# libaio1 todavia existe con ese nombre exacto, que es lo que necesita
# el Oracle Instant Client (modo Thick) para funcionar en Linux.
FROM node:18-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

# ca-certificates es imprescindible para que curl valide el TLS de la
# descarga del Instant Client; sin el, el build falla con "curl exit 77".
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libaio1 unzip curl \
    && rm -rf /var/lib/apt/lists/*

# --- Oracle Instant Client (modo Thick) - OPCIONAL ---
# Solo lo necesita "npm run sync:alumnos" (el ewallet.pem del Wallet viene
# cifrado y cwallet.sso solo lo leen las librerias nativas de Oracle). El
# servidor HTTP NUNCA carga Oracle, asi que si la descarga falla el build
# continua igual y la API funciona con normalidad.
ARG ORACLE_INSTANTCLIENT_URL=https://download.oracle.com/otn_software/linux/instantclient/2326300/instantclient-basic-linux.x64-23.26.3.0.0.zip
RUN if curl -fsSL -o /tmp/instantclient.zip "$ORACLE_INSTANTCLIENT_URL"; then \
      mkdir -p /opt/oracle \
      && unzip -q /tmp/instantclient.zip -d /opt/oracle \
      && mv /opt/oracle/instantclient_* /opt/oracle/instantclient \
      && rm /tmp/instantclient.zip \
      && echo /opt/oracle/instantclient > /etc/ld.so.conf.d/oracle-instantclient.conf \
      && ldconfig \
      && echo "Oracle Instant Client instalado en /opt/oracle/instantclient"; \
    else \
      echo "AVISO: no se pudo descargar el Oracle Instant Client desde $ORACLE_INSTANTCLIENT_URL."; \
      echo "       El servidor HTTP funciona igual. Para 'npm run sync:alumnos'"; \
      echo "       monta un Instant Client en /opt/oracle/instantclient (volumen)."; \
    fi
ENV ORACLE_INSTANT_CLIENT_DIR=/opt/oracle/instantclient

# --- Dependencias Node ---
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000

# Healthcheck contra el propio endpoint /api/health.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
