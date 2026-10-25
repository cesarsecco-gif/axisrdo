import { Router, Response } from 'express';
import { prisma } from './prisma';
import { authenticate, requireSuperAdmin, AuthRequest, hashPassword } from './auth';

export const adminRouter = Router();

// Todas as rotas deste router exigem autenticação e privilégio SUPERADMIN
adminRouter.use(authenticate);
adminRouter.use(requireSuperAdmin);

// -------------------------------------------------------------
// 1. MÉTRICAS GLOBAIS DA PLATAFORMA (DASHBOARD EXECUTIVO)
// -------------------------------------------------------------
adminRouter.get('/metrics', async (_req: AuthRequest, res: Response) => {
  try {
    const [totalTenants, totalUsers, totalObras, totalPhotos, indCount, corpCount] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.obra.count(),
      prisma.photoRecord.count(),
      prisma.tenant.count({ where: { plano: 'INDIVIDUAL', ativo: true } }),
      prisma.tenant.count({ where: { plano: 'CORPORATIVO', ativo: true } }),
    ]);

    // Cálculo do Faturamento Recorrente Mensal Estimado (MRR)
    const mrrEstimado = (indCount * 149.0) + (corpCount * 489.0);
    const storageEstimadoMb = totalPhotos * 1.5; // Média estimada de 1.5MB por foto

    return res.json({
      totalTenants,
      totalUsers,
      totalObras,
      totalPhotos,
      indCount,
      corpCount,
      mrrEstimado,
      storageEstimadoMb,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao carregar métricas globais.' });
  }
});

// -------------------------------------------------------------
// 2. LISTAR TODAS AS EMPRESAS CLIENTES (TENANTS)
// -------------------------------------------------------------
adminRouter.get('/tenants', async (_req: AuthRequest, res: Response) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true, obras: true },
        },
        users: {
          take: 3,
          select: { id: true, nome: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const lista = tenants.map((t) => ({
      id: t.id,
      nome: t.nome,
      cnpj: t.cnpj,
      slug: t.slug,
      plano: t.plano,
      limiteUsuarios: t.limiteUsuarios,
      limiteObras: t.limiteObras,
      ativo: t.ativo,
      totalUsuarios: t._count.users,
      totalObras: t._count.obras,
      createdAt: t.createdAt,
      usuariosPrincipais: t.users,
    }));

    return res.json({ tenants: lista });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao listar empresas clientes.' });
  }
});

// -------------------------------------------------------------
// 3. CADASTRAR NOVA EMPRESA / CONTRATO MANUALMENTE (SUPERADMIN)
// -------------------------------------------------------------
adminRouter.post('/tenants', async (req: AuthRequest, res: Response) => {
  try {
    const {
      nomeEmpresa,
      cnpj,
      plano,
      limiteUsuarios,
      limiteObras,
      adminNome,
      adminEmail,
      adminSenha,
    } = req.body;

    if (!nomeEmpresa?.trim() || !adminNome?.trim() || !adminEmail?.trim() || typeof adminSenha !== 'string' || !adminSenha.trim()) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (Empresa, Nome do Gestor, E-mail e Senha).' });
    }
    if (adminSenha.length < 12 || adminSenha.length > 128) return res.status(400).json({ error: 'A senha inicial deve ter entre 12 e 128 caracteres.' });

    const emailNormalizado = adminEmail.trim().toLowerCase();
    const usuarioExistente = await prisma.user.findUnique({
      where: { email: emailNormalizado },
    });

    if (usuarioExistente) {
      return res.status(409).json({ error: 'Já existe um usuário cadastrado com este e-mail.' });
    }

    const baseSlug = nomeEmpresa
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    const isCorp = plano === 'CORPORATIVO';
    const maxUsers = Number(limiteUsuarios) || (isCorp ? 10 : 1);
    const maxObras = Number(limiteObras) || (isCorp ? 9999 : 3);

    const senhaHash = await hashPassword(adminSenha);

    const resultado = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nome: nomeEmpresa.trim(),
          cnpj: cnpj?.trim() || null,
          slug,
          plano: isCorp ? 'CORPORATIVO' : 'INDIVIDUAL',
          limiteUsuarios: maxUsers,
          limiteObras: maxObras,
          ativo: true,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          nome: adminNome.trim(),
          email: emailNormalizado,
          senhaHash,
          cargo: 'Administrador da Conta',
          role: 'ADMIN',
          isSuperAdmin: false,
          ativo: true,
        },
      });

      return { tenant, user };
    });

    return res.status(201).json({
      success: true,
      mensagem: `Empresa "${resultado.tenant.nome}" cadastrada com sucesso!`,
      tenant: resultado.tenant,
      admin: {
        id: resultado.user.id,
        nome: resultado.user.nome,
        email: resultado.user.email,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao cadastrar empresa: ' + (error.message || 'Erro interno') });
  }
});

adminRouter.get('/tenants/:id/obras', async (req: AuthRequest, res: Response) => {
  try {
    const obras = await prisma.obra.findMany({
      where: { tenantId: req.params.id },
      select: { id: true, nome: true, contrato: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ obras });
  } catch {
    return res.status(500).json({ error: 'Não foi possível listar os ambientes da organização.' });
  }
});

// -------------------------------------------------------------
// 4. ATUALIZAR STATUS OU LIMITES DE UMA EMPRESA
// -------------------------------------------------------------
adminRouter.patch('/tenants/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { ativo, plano, limiteUsuarios, limiteObras } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(typeof ativo === 'boolean' ? { ativo } : {}),
        ...(plano ? { plano } : {}),
        ...(Number.isInteger(limiteUsuarios) ? { limiteUsuarios } : {}),
        ...(Number.isInteger(limiteObras) ? { limiteObras } : {}),
      },
    });

    return res.json({
      success: true,
      mensagem: `Dados da empresa "${tenant.nome}" atualizados com sucesso.`,
      tenant,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao atualizar empresa.' });
  }
});

// -------------------------------------------------------------
// 5. LISTAR TODOS OS USUÁRIOS GLOBAIS DA PLATAFORMA
// -------------------------------------------------------------
adminRouter.get('/users', async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        tenant: {
          select: { id: true, nome: true, plano: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const lista = users.map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      cargo: u.cargo,
      role: u.role,
      isSuperAdmin: u.isSuperAdmin,
      ativo: u.ativo,
      createdAt: u.createdAt,
      tenantId: u.tenant.id,
      tenantNome: u.tenant.nome,
      tenantPlano: u.tenant.plano,
    }));

    return res.json({ users: lista });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao listar usuários globais.' });
  }
});

// -------------------------------------------------------------
// 6. ATUALIZAR STATUS, CARGO OU RESETAR SENHA DE QUALQUER USUÁRIO
// -------------------------------------------------------------
adminRouter.patch('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role, ativo, novaSenha } = req.body;

    const data: any = {};
    if (role && ['SUPERADMIN', 'ADMIN', 'GESTOR', 'CAMPO', 'LEITOR'].includes(role)) {
      data.role = role;
      data.isSuperAdmin = role === 'SUPERADMIN';
    }
    if (typeof ativo === 'boolean') {
      data.ativo = ativo;
    }
    if (typeof novaSenha === 'string' && novaSenha.trim()) {
      if (novaSenha.trim().length < 12 || novaSenha.trim().length > 128) return res.status(400).json({ error: 'A nova senha deve ter entre 12 e 128 caracteres.' });
      data.senhaHash = await hashPassword(novaSenha.trim());
    }

    const userAtualizado = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        nome: true,
        email: true,
        role: true,
        isSuperAdmin: true,
        ativo: true,
      },
    });

    return res.json({
      success: true,
      mensagem: `Usuário "${userAtualizado.nome}" atualizado com sucesso.`,
      user: userAtualizado,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao atualizar dados do usuário.' });
  }
});
