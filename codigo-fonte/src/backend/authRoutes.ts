import { Router, Request, Response } from 'express';
import { prisma } from './prisma';
import {
  hashPassword,
  comparePassword,
  generateToken,
  authenticate,
  requireRole,
  AuthRequest,
} from './auth';

export const authRouter = Router();

// -------------------------------------------------------------
// CADASTRO DE NOVA EMPRESA E USUÁRIO ADMINISTRADOR
// -------------------------------------------------------------
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { nomeEmpresa, nomeUsuario, email, senha, cnpj, plano = 'INDIVIDUAL' } = req.body;

    if (!nomeEmpresa?.trim() || !nomeUsuario?.trim() || !email?.trim() || !senha?.trim()) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios (empresa, nome, e-mail e senha).' });
    }

    const emailNormalizado = email.trim().toLowerCase();

    // Verificar se o e-mail já existe
    const usuarioExistente = await prisma.user.findUnique({
      where: { email: emailNormalizado },
    });

    if (usuarioExistente) {
      return res.status(409).json({ error: 'Já existe uma conta cadastrada com este e-mail.' });
    }

    // Criar Slug para o Tenant
    const baseSlug = nomeEmpresa
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    // Limites de acordo com o plano
    const isCorp = plano.toUpperCase() === 'CORPORATIVO';
    const limiteUsuarios = isCorp ? 5 : 1;
    const limiteObras = isCorp ? 100 : 3;

    // Criar Tenant e Usuário Admin em transação
    const senhaCriptografada = await hashPassword(senha);

    const resultado = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          nome: nomeEmpresa.trim(),
          cnpj: cnpj?.trim() || null,
          slug,
          plano: isCorp ? 'CORPORATIVO' : 'INDIVIDUAL',
          limiteUsuarios,
          limiteObras,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          nome: nomeUsuario.trim(),
          email: emailNormalizado,
          senhaHash: senhaCriptografada,
          cargo: 'Administrador',
          role: 'ADMIN',
        },
      });

      return { tenant, user };
    });

    const token = generateToken({
      id: resultado.user.id,
      tenantId: resultado.tenant.id,
      email: resultado.user.email,
      nome: resultado.user.nome,
      role: 'ADMIN',
      tenantNome: resultado.tenant.nome,
      plano: resultado.tenant.plano,
    });

    // Enviar Cookie HttpOnly
    res.cookie('axis_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    });

    res.status(201).json({
      success: true,
      user: {
        id: resultado.user.id,
        nome: resultado.user.nome,
        email: resultado.user.email,
        cargo: resultado.user.cargo,
        role: resultado.user.role,
      },
      tenant: {
        id: resultado.tenant.id,
        nome: resultado.tenant.nome,
        slug: resultado.tenant.slug,
        plano: resultado.tenant.plano,
        limiteUsuarios: resultado.tenant.limiteUsuarios,
        limiteObras: resultado.tenant.limiteObras,
      },
      token,
    });
  } catch (error: any) {
    console.error('Erro no cadastro:', error);
    res.status(500).json({ error: 'Não foi possível concluir o cadastro: ' + (error.message || 'Erro interno') });
  }
});

// -------------------------------------------------------------
// LOGIN DE USUÁRIO
// -------------------------------------------------------------
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, senha } = req.body;

    if (!email?.trim() || !senha?.trim()) {
      return res.status(400).json({ error: 'Informe seu e-mail e sua senha.' });
    }

    const emailNormalizado = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: emailNormalizado },
      include: { tenant: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    if (!user.ativo || !user.tenant.ativo) {
      return res.status(403).json({ error: 'Esta conta ou empresa está temporariamente inativa. Contate o suporte.' });
    }

    const senhaCorreta = await comparePassword(senha, user.senhaHash);
    if (!senhaCorreta) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = generateToken({
      id: user.id,
      tenantId: user.tenant.id,
      email: user.email,
      nome: user.nome,
      role: user.role as any,
      tenantNome: user.tenant.nome,
      plano: user.tenant.plano,
    });

    res.cookie('axis_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
        role: user.role,
      },
      tenant: {
        id: user.tenant.id,
        nome: user.tenant.nome,
        slug: user.tenant.slug,
        plano: user.tenant.plano,
        limiteUsuarios: user.tenant.limiteUsuarios,
        limiteObras: user.tenant.limiteObras,
      },
      token,
    });
  } catch (error: any) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Não foi possível realizar o login.' });
  }
});

// -------------------------------------------------------------
// LOGOUT
// -------------------------------------------------------------
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('axis_auth_token');
  res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

// -------------------------------------------------------------
// DADOS DO USUÁRIO LOGADO (/api/auth/me)
// -------------------------------------------------------------
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        tenant: {
          include: {
            _count: {
              select: { users: true, obras: true },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
        role: user.role,
      },
      tenant: {
        id: user.tenant.id,
        nome: user.tenant.nome,
        slug: user.tenant.slug,
        plano: user.tenant.plano,
        limiteUsuarios: user.tenant.limiteUsuarios,
        limiteObras: user.tenant.limiteObras,
        totalUsuarios: user.tenant._count.users,
        totalObras: user.tenant._count.obras,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao consultar dados da sessão.' });
  }
});

// -------------------------------------------------------------
// GESTÃO DE EQUIPE (MEMBROS DA CONTA / RBAC)
// -------------------------------------------------------------
authRouter.get('/team', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const members = await prisma.user.findMany({
      where: { tenantId: req.user!.tenantId },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        role: true,
        ativo: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ members });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao listar membros da equipe.' });
  }
});

// -------------------------------------------------------------
// CONVIDAR NOVO MEMBRO (COM LIMITE DE ASSENTOS DO PLANO)
// -------------------------------------------------------------
authRouter.post('/team/invite', authenticate, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { nome, email, senha, cargo = 'Engenheiro', role = 'GESTOR' } = req.body;

    if (!nome?.trim() || !email?.trim() || !senha?.trim()) {
      return res.status(400).json({ error: 'Informe o nome, e-mail e senha inicial do membro.' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      include: { _count: { select: { users: true } } },
    });

    if (!tenant) return res.status(404).json({ error: 'Organização não encontrada.' });

    // Checar limite de assentos
    if (tenant._count.users >= tenant.limiteUsuarios) {
      return res.status(403).json({
        error: `Limite de usuários atingido (${tenant._count.users} de ${tenant.limiteUsuarios}). Faça upgrade para o plano Corporativo ou adicione mais assentos.`,
      });
    }

    const emailNormalizado = email.trim().toLowerCase();
    const jaExiste = await prisma.user.findUnique({ where: { email: emailNormalizado } });
    if (jaExiste) {
      return res.status(409).json({ error: 'Já existe um usuário com este e-mail no sistema.' });
    }

    const senhaHash = await hashPassword(senha);
    const novoUsuario = await prisma.user.create({
      data: {
        tenantId: req.user!.tenantId,
        nome: nome.trim(),
        email: emailNormalizado,
        senhaHash,
        cargo: cargo.trim(),
        role: ['ADMIN', 'GESTOR', 'CAMPO', 'LEITOR'].includes(role) ? role : 'GESTOR',
      },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        role: true,
        ativo: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, member: novoUsuario });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao convidar membro: ' + (error.message || 'Erro interno') });
  }
});
