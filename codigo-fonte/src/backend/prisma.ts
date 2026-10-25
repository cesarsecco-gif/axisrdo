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
    await seedMasterUser();
  } catch (err: any) {
    console.warn('[Prisma] Aviso ao executar prisma db push:', err?.message || err);
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
