# Imagen del frontend en modo desarrollo (servidor Vite), para paridad
# con "npm run dev" fuera de Docker. No es una imagen de produccion
# (no hay build estatico + nginx); ver README si se necesita eso despues.
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# --host expone el servidor de Vite en 0.0.0.0 dentro del contenedor;
# sin esto Vite solo escucha en localhost y no seria alcanzable desde
# fuera del contenedor.
CMD ["npm", "run", "dev", "--", "--host"]
