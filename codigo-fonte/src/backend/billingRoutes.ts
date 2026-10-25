import { Router, Response } from 'express';
import { prisma } from './prisma';
import { authenticate, requireRole, AuthRequest } from './auth';

export const billingRouter = Router();

// Catálogo de planos disponíveis para o AXIS RDO
export const PLANOS_CONFIG = {
  INDIVIDUAL: {
    id: 'INDIVIDUAL',
    nome: 'Plano Individual',
    precoMensal: 149.0,
    precoAnual: 1490.0,
    descricao: 'Ideal para engenheiros autônomos, peritos e fiscais individuais.',
    limiteUsuarios: 1,
    limiteObras: 3,
    storageGb: 5,
    destaque: false,
    beneficios: [
      '1 usuário com acesso completo',
      'Até 3 obras ativas simultâneas',
      '5 GB de armazenamento em nuvem',
      'Emissão ilimitada de RDOs diários',
      'Relatórios Fotográficos com carimbo georreferenciado',
      'Exportação em PDF e Excel (.xlsx)',
      'Backup completo dos dados',
      'Suporte via e-mail',
    ],
  },
  CORPORATIVO: {
    id: 'CORPORATIVO',
    nome: 'Plano Corporativo',
    precoMensal: 489.0,
    precoAnual: 4890.0,
    descricao: 'Projetado para construtoras, supervisoras e consórcios rodoviários.',
    limiteUsuarios: 10,
    limiteObras: 9999,
    storageGb: 100,
    destaque: true,
    beneficios: [
      'Até 10 usuários inclusos (+ assentos adicionais)',
      'Obras e contratos rodoviários ilimitados',
      '100 GB de armazenamento de fotos em nuvem',
      'Controle de níveis de acesso (Admin, Gestor, Campo, Fiscal)',
      'Exportação em lote e relatórios consolidados',
      'Assinaturas digitais de prepostos e engenheiros fiscais',
      'Logo e banner customizados da construtora no cabeçalho',
      'Suporte prioritário via WhatsApp e Telefone (Axis Consultoria)',
    ],
  },
};

// -------------------------------------------------------------
// 1. LISTAR PLANOS DISPONÍVEIS
// -------------------------------------------------------------
billingRouter.get('/plans', (_req, res: Response) => {
  return res.json({
    plans: Object.values(PLANOS_CONFIG),
  });
});

// -------------------------------------------------------------
// 2. CONSULTAR ASSINATURA E CONSUMO ATUAL DO TENANT
// -------------------------------------------------------------
billingRouter.get('/subscription', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Organização não encontrada.' });
    }

    const [totalUsers, totalObras] = await Promise.all([
      prisma.user.count({ where: { tenantId, ativo: true } }),
      prisma.obra.count({ where: { tenantId } }),
    ]);

    const planoAtual = PLANOS_CONFIG[tenant.plano as keyof typeof PLANOS_CONFIG] || PLANOS_CONFIG.INDIVIDUAL;

    return res.json({
      tenantId: tenant.id,
      tenantNome: tenant.nome,
      plano: tenant.plano,
      planoDetalhes: planoAtual,
      limiteUsuarios: tenant.limiteUsuarios,
      limiteObras: tenant.limiteObras,
      usuariosAtivos: totalUsers,
      obrasAtivas: totalObras,
      status: tenant.ativo ? 'ATIVA' : 'SUSPENSA',
      storageUsadoMb: Math.min(totalObras * 45, 1024), // estimativa calculada
      proximaFatura: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao consultar detalhes da assinatura.' });
  }
});

// -------------------------------------------------------------
// 3. INICIAR CHECKOUT / PAGAMENTO (PIX OU CARTÃO)
// -------------------------------------------------------------
billingRouter.post('/checkout', authenticate, requireRole(['ADMIN']), async (_req: AuthRequest, res: Response) => {
  return res.status(503).json({ error: 'O pagamento online ainda não está configurado. Nenhuma cobrança foi criada.' });
});

// 4. ATIVAÇÃO / UPGRADE IMEDIATO DE PLANO (ADMIN)
// -------------------------------------------------------------
billingRouter.post('/upgrade', authenticate, requireRole(['ADMIN']), async (_req: AuthRequest, res: Response) => {
  return res.status(503).json({ error: 'A mudança de plano exige confirmação de pagamento ou ativação manual pela administração.' });
});

// 5. WEBHOOK DO GATEWAY DE PAGAMENTOS (ASAAS / MERCADO PAGO)
// -------------------------------------------------------------
billingRouter.post('/webhook', async (_req, res: Response) => {
  return res.status(503).json({ error: 'Webhook indisponível até configurar e validar a assinatura do provedor.' });
});
