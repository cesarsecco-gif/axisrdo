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
billingRouter.post(
  '/checkout',
  authenticate,
  requireRole(['ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { planId, billingCycle, paymentMethod } = req.body;

      if (!['INDIVIDUAL', 'CORPORATIVO'].includes(planId)) {
        return res.status(400).json({ error: 'Plano inválido.' });
      }

      const plano = PLANOS_CONFIG[planId as keyof typeof PLANOS_CONFIG];
      const isYearly = billingCycle === 'yearly';
      const valor = isYearly ? plano.precoAnual : plano.precoMensal;
      const txId = `AXIS-TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      if (paymentMethod === 'pix') {
        // Código PIX Copia e Cola simulado / formatado pronto para gateway Asaas/MercadoPago
        const pixCopiaECola = `00020126580014br.gov.bcb.pix0136axis-financeiro@axisconsultoria.com0204AXIS520400005303986540${valor.toFixed(2)}5802BR5925AXIS CONSULTORIA E PLAN6008CURITIBA62070503***6304ABCD`;

        return res.json({
          transactionId: txId,
          planId,
          billingCycle: isYearly ? 'anual' : 'mensal',
          valor,
          paymentMethod: 'pix',
          pixCopiaECola,
          qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCopiaECola)}`,
          expiraEmMinutos: 30,
        });
      }

      // Checkout por Cartão de Crédito
      return res.json({
        transactionId: txId,
        planId,
        billingCycle: isYearly ? 'anual' : 'mensal',
        valor,
        paymentMethod: 'credit_card',
        status: 'PENDING_CARD_DETAILS',
        mensagem: 'Gateway de pagamento pronto para processamento com token de cartão.',
      });
    } catch (error: any) {
      return res.status(500).json({ error: 'Erro ao processar checkout.' });
    }
  }
);

// -------------------------------------------------------------
// 4. ATIVAÇÃO / UPGRADE IMEDIATO DE PLANO (ADMIN)
// -------------------------------------------------------------
billingRouter.post(
  '/upgrade',
  authenticate,
  requireRole(['ADMIN']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { planId } = req.body;

      if (!['INDIVIDUAL', 'CORPORATIVO'].includes(planId)) {
        return res.status(400).json({ error: 'Plano selecionado inválido.' });
      }

      const tenantId = req.user!.tenantId;
      const novoPlano = PLANOS_CONFIG[planId as keyof typeof PLANOS_CONFIG];

      const tenantAtualizado = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          plano: planId,
          limiteUsuarios: novoPlano.limiteUsuarios,
          limiteObras: novoPlano.limiteObras,
          ativo: true,
        },
      });

      return res.json({
        success: true,
        mensagem: `Plano atualizado com sucesso para ${novoPlano.nome}!`,
        tenant: {
          id: tenantAtualizado.id,
          nome: tenantAtualizado.nome,
          plano: tenantAtualizado.plano,
          limiteUsuarios: tenantAtualizado.limiteUsuarios,
          limiteObras: tenantAtualizado.limiteObras,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ error: 'Erro ao atualizar plano da organização.' });
    }
  }
);

// -------------------------------------------------------------
// 5. WEBHOOK DO GATEWAY DE PAGAMENTOS (ASAAS / MERCADO PAGO)
// -------------------------------------------------------------
billingRouter.post('/webhook', async (req, res: Response) => {
  try {
    const event = req.body;
    // Exemplo de payload recebido pelo Asaas / Mercado Pago:
    // event = { event: 'PAYMENT_RECEIVED', payment: { customer: '...', externalReference: 'tenant_id_cuid', value: 489.0 } }
    const externalRef = event?.payment?.externalReference || event?.data?.metadata?.tenant_id;
    const eventType = event?.event || event?.action;

    if (externalRef && (eventType === 'PAYMENT_RECEIVED' || eventType === 'payment.created')) {
      await prisma.tenant.update({
        where: { id: externalRef },
        data: {
          ativo: true,
          plano: 'CORPORATIVO',
          limiteUsuarios: 10,
          limiteObras: 9999,
        },
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    return res.status(200).json({ received: true, note: 'Webhook processado.' });
  }
});
