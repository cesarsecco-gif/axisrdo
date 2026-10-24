export interface PlatformMetrics {
  totalTenants: number;
  totalUsers: number;
  totalObras: number;
  totalPhotos: number;
  indCount: number;
  corpCount: number;
  mrrEstimado: number;
  storageEstimadoMb: number;
}

export interface TenantAdminRow {
  id: string;
  nome: string;
  cnpj: string | null;
  slug: string;
  plano: 'INDIVIDUAL' | 'CORPORATIVO';
  limiteUsuarios: number;
  limiteObras: number;
  ativo: boolean;
  totalUsuarios: number;
  totalObras: number;
  createdAt: string;
  usuariosPrincipais: { id: string; nome: string; email: string; role: string }[];
}

export interface UserAdminRow {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'GESTOR' | 'CAMPO' | 'LEITOR';
  isSuperAdmin: boolean;
  ativo: boolean;
  createdAt: string;
  tenantId: string;
  tenantNome: string;
  tenantPlano: string;
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
    throw new Error(data.error || `Erro na requisição administrativa (${res.status})`);
  }

  return data as T;
}

export const adminApi = {
  getMetrics: async (): Promise<PlatformMetrics> => {
    return request<PlatformMetrics>('/api/admin/metrics');
  },

  getTenants: async (): Promise<{ tenants: TenantAdminRow[] }> => {
    return request<{ tenants: TenantAdminRow[] }>('/api/admin/tenants');
  },

  createTenant: async (dados: {
    nomeEmpresa: string;
    cnpj?: string;
    plano: 'INDIVIDUAL' | 'CORPORATIVO';
    limiteUsuarios: number;
    limiteObras: number;
    adminNome: string;
    adminEmail: string;
    adminSenha: string;
  }): Promise<{ success: boolean; mensagem: string; tenant: any }> => {
    return request<{ success: boolean; mensagem: string; tenant: any }>('/api/admin/tenants', {
      method: 'POST',
      body: JSON.stringify(dados),
    });
  },

  updateTenant: async (
    id: string,
    dados: {
      ativo?: boolean;
      plano?: 'INDIVIDUAL' | 'CORPORATIVO';
      limiteUsuarios?: number;
      limiteObras?: number;
    }
  ): Promise<{ success: boolean; mensagem: string }> => {
    return request<{ success: boolean; mensagem: string }>(`/api/admin/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    });
  },

  getUsers: async (): Promise<{ users: UserAdminRow[] }> => {
    return request<{ users: UserAdminRow[] }>('/api/admin/users');
  },

  updateUser: async (
    id: string,
    dados: {
      role?: 'SUPERADMIN' | 'ADMIN' | 'GESTOR' | 'CAMPO' | 'LEITOR';
      ativo?: boolean;
      novaSenha?: string;
    }
  ): Promise<{ success: boolean; mensagem: string }> => {
    return request<{ success: boolean; mensagem: string }>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dados),
    });
  },
};
