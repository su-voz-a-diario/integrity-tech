# ============================================================================
# ETAPA 1: INSTALACIÓN DE DEPENDENCIAS (deps)
# ============================================================================
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias (incluyendo devDependencies para compilar)
RUN npm ci

# ============================================================================
# ETAPA 2: COMPILACIÓN DEL CÓDIGO (build)
# ============================================================================
FROM node:18-alpine AS build
WORKDIR /usr/src/app

COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

# Generar cliente de Prisma basado en el esquema DDL y compilar NestJS
RUN npx prisma generate
RUN npm run build

# Limpiar dependencias de desarrollo y dejar solo producción para reducir peso
RUN npm prune --production

# ============================================================================
# ETAPA 3: IMAGEN DE PRODUCCIÓN MINIFICADA (runner)
# ============================================================================
FROM node:18-alpine AS runner
WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copiar artefactos necesarios desde la etapa de compilación
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/prisma ./prisma

# Exponer el puerto para el contenedor de API (los workers ignorarán esto)
EXPOSE 3000

# Comando por defecto (sobrescribible en docker-compose / ECS)
CMD ["node", "dist/main"]
