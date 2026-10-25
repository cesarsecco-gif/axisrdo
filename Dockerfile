# =============================================================
# AXIS RDO — Dockerfile (Root Context para Coolify e VPS)
# Axis Consultoria e Planejamento
# =============================================================

FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

# Copiar manifestos e dependências
COPY codigo-fonte/package*.json ./
COPY codigo-fonte/prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# Copiar todo o código-fonte da aplicação
COPY codigo-fonte/ .

# Compilar frontend e backend
RUN npm run build

# =============================================================
# Imagem de Execução (Production Runner)
# =============================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV ALLOW_NETWORK=true
ENV AXIS_DATA_DIR=/app/data

RUN addgroup --system --gid 1001 axisgroup && \
    adduser --system --uid 1001 axisuser

RUN apk add --no-cache openssl curl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/data && chown -R axisuser:axisgroup /app

USER axisuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.cjs"]
