# =============================================================
# AXIS RDO — Dockerfile Multi-stage para VPS Hostinger
# Axis Consultoria e Planejamento
# =============================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependências necessárias para compilação nativa
RUN apk add --no-cache python3 make g++

# Copiar manifesto de dependências
COPY package*.json ./
COPY prisma ./prisma/

# Instalar dependências completas
RUN npm ci

# Gerar tipos e engine do Prisma Client
RUN npx prisma generate

# Copiar o restante do código fonte
COPY . .

# Construir frontend (Vite) e backend bundle (esbuild)
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

# Criar usuário não-root por segurança
RUN addgroup --system --gid 1001 axisgroup && \
    adduser --system --uid 1001 axisuser

# Instalar OpenSSL para o Prisma Client
RUN apk add --no-cache openssl curl

# Copiar arquivos construídos e dependências de produção
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Criar pasta persistente de dados e uploads com permissões corretas
RUN mkdir -p /app/data && chown -R axisuser:axisgroup /app

USER axisuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.cjs"]
