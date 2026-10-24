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

export async function initDatabase() {
  try {
    const { execSync } = await import('node:child_process');
    console.log('[Prisma] Sincronizando schema do banco SQLite...');
    execSync('npx prisma db push --skip-generate', {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: { ...process.env }
    });
    console.log('[Prisma] Banco de dados pronto e sincronizado.');
  } catch (err: any) {
    console.warn('[Prisma] Aviso ao executar prisma db push:', err?.message || err);
  }
}
