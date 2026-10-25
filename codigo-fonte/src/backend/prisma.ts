import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Garantir que DATABASE_URL esteja sempre definida para a pasta correta de dados
if (!process.env.DATABASE_URL) {
  const dataDir = process.env.AXIS_DATA_DIR || process.env.DER_DATA_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'AXIS-RDO');
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
  const dbFile = path.join(dataDir, 'axis_rdo.db').replace(/\\/g, '/');
  process.env.DATABASE_URL = `file:${dbFile.startsWith('/') ? '' : '/'}${dbFile}`;
}

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "plano" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "limiteUsuarios" INTEGER NOT NULL DEFAULT 1,
    "limiteObras" INTEGER NOT NULL DEFAULT 3,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "cargo" TEXT NOT NULL DEFAULT 'Engenheiro',
    "role" TEXT NOT NULL DEFAULT 'GESTOR',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Obra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "contrato" TEXT,
    "rodoviaPadrao" TEXT,
    "trechoPadrao" TEXT,
    "empresaExecutora" TEXT,
    "superintendencia" TEXT,
    "orgaoPrincipal" TEXT DEFAULT 'AXIS CONSULTORIA E PLANEJAMENTO',
    "headerBannerUrl" TEXT,
    "photosPerPage" INTEGER NOT NULL DEFAULT 4,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Obra_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "RdoRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obraId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "weather" TEXT NOT NULL DEFAULT 'BOM',
    "professionals" INTEGER,
    "sufficient" TEXT NOT NULL DEFAULT 'SIM',
    "present" TEXT NOT NULL DEFAULT 'SIM',
    "contractorNotes" TEXT NOT NULL DEFAULT '',
    "supervisorNotes" TEXT NOT NULL DEFAULT '',
    "inspectorNotes" TEXT NOT NULL DEFAULT '',
    "finalSignature" TEXT,
    "finalizedAt" DATETIME,
    "reopenedReason" TEXT,
    "folderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RdoRecord_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "PhotoRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obraId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "thumbPath" TEXT,
    "data" TEXT NOT NULL,
    "hora" TEXT,
    "servico" TEXT NOT NULL,
    "rodovia" TEXT,
    "trecho" TEXT,
    "estaca" TEXT,
    "lado" TEXT,
    "categoria" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "elevacao" TEXT,
    "manualOrder" INTEGER,
    "includedInReport" BOOLEAN NOT NULL DEFAULT true,
    "timestamp" BIGINT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhotoRecord_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "EquipeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obraId" TEXT NOT NULL,
    "matricula" TEXT,
    "nome" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipeRecord_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "CatalogoItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "obraId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    CONSTRAINT "CatalogoItem_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_slug_key" ON "Tenant"("slug")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE INDEX IF NOT EXISTS "User_tenantId_idx" ON "User"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "Obra_tenantId_idx" ON "Obra"("tenantId")`,
  `CREATE INDEX IF NOT EXISTS "RdoRecord_obraId_idx" ON "RdoRecord"("obraId")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RdoRecord_obraId_date_key" ON "RdoRecord"("obraId", "date")`,
  `CREATE INDEX IF NOT EXISTS "PhotoRecord_obraId_idx" ON "PhotoRecord"("obraId")`,
  `CREATE INDEX IF NOT EXISTS "PhotoRecord_obraId_folderId_idx" ON "PhotoRecord"("obraId", "folderId")`,
  `CREATE INDEX IF NOT EXISTS "EquipeRecord_obraId_idx" ON "EquipeRecord"("obraId")`,
  `CREATE INDEX IF NOT EXISTS "CatalogoItem_obraId_tipo_idx" ON "CatalogoItem"("obraId", "tipo")`
];

export async function initDatabase() {
  try {
    console.log('[Database] Garantindo schema e tabelas no SQLite...');
    for (const sql of DDL_STATEMENTS) {
      await prisma.$executeRawUnsafe(sql);
    }
    console.log('[Database] Tabelas prontas e sincronizadas.');
    await seedMasterUser();
  } catch (err: any) {
    console.warn('[Database] Aviso ao inicializar schema do banco:', err?.message || err);
  }
}

async function seedMasterUser() {
  try {
    const { hashPassword } = await import('./auth');

    // 1. Garantir Tenant Master da Axis
    let axisTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: 'axis-master' },
          { nome: { contains: 'Axis' } }
        ]
      }
    });

    if (!axisTenant) {
      axisTenant = await prisma.tenant.create({
        data: {
          nome: 'Axis Consultoria e Planejamento',
          slug: 'axis-master',
          plano: 'CORPORATIVO',
          limiteUsuarios: 9999,
          limiteObras: 9999,
          ativo: true,
        }
      });
      console.log('[Seed] Tenant Master Axis criado com sucesso.');
    }

    // 2. Garantir Usuário Gestor Master
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Axis@2026';
    const senhaHash = await hashPassword(defaultPassword);
    const masterEmails = ['admin@axisconsplan.com.br', 'admin@axisconsultoria.com.br'];

    for (const email of masterEmails) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        await prisma.user.create({
          data: {
            tenantId: axisTenant.id,
            nome: 'Gestão Master Axis',
            email,
            senhaHash,
            cargo: 'Diretor Geral',
            role: 'SUPERADMIN',
            isSuperAdmin: true,
            ativo: true,
          }
        });
        console.log(`[Seed] Usuário Master criado: ${email}`);
      } else {
        if (!existing.isSuperAdmin || existing.role !== 'SUPERADMIN') {
          await prisma.user.update({
            where: { id: existing.id },
            data: { isSuperAdmin: true, role: 'SUPERADMIN' }
          });
        }
      }
    }
  } catch (err: any) {
    console.warn('[Seed] Aviso ao verificar/criar usuário master:', err?.message || err);
  }
}
