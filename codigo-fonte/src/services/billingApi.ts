export interface PlanoDetalhes {
  id: 'INDIVIDUAL' | 'CORPORATIVO';
  nome: string;
  precoMensal: number;
  precoAnual: number;
  descricao: string;
  limiteUsuarios: number;
  limiteObras: number;
  storageGb: number;
  destaque: boolean;
  beneficios: string[];
}

export interface SubscriptionInfo {
  tenantId: string;
  tenantNome: string;
  plano: 'INDIVIDUAL' | 'CORPORATIVO';
  planoDetalhes: PlanoDetalhes;
  limiteUsuarios: number;
  limiteObras: number;
  usuariosAtivos: number;
  obrasAtivas: number;
  status: 'ATIVA' | 'SUSPENSA';
  storageUsadoMb: number;
  proximaFatura: string;
}

export interface CheckoutResult {
  transactionId: string;
  planId: string;
  billingCycle: string;
  valor: number;
  paymentMethod: 'pix' | 'credit_card';
  pixCopiaECola?: string;
  qrCodeUrl?: string;
  expiraEmMinutos?: number;
  mensagem?: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Erro na requisição (${res.status})`);
  }

  return data as T;
}

export const billingApi = {
  getPlans: async (): Promise<{ plans: PlanoDetalhes[] }> => {
    return request<{ plans: PlanoDetalhes[] }>('/api/billing/plans');
  },

  getSubscription: async (): Promise<SubscriptionInfo> => {
    return request<SubscriptionInfo>('/api/billing/subscription');
  },

  createCheckout: async (dados: {
    planId: 'INDIVIDUAL' | 'CORPORATIVO';
    billingCycle: 'monthly' | 'yearly';
    paymentMethod: 'pix' | 'credit_card';
  }): Promise<CheckoutResult> => {
    return request<CheckoutResult>('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  },

  upgradePlan: async (planId: 'INDIVIDUAL' | 'CORPORATIVO'): Promise<{ success: boolean; mensagem: string }> => {
    return request<{ success: boolean; mensagem: string }>('/api/billing/upgrade', {
      method: 'POST',
      body: JSON.stringify({ planId }),
    });
  },
};
