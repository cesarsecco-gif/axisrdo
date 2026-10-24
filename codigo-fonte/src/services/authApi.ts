export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'GESTOR' | 'CAMPO' | 'LEITOR';
  isSuperAdmin?: boolean;
}

export interface TenantInfo {
  id: string;
  nome: string;
  slug: string;
  plano: 'INDIVIDUAL' | 'CORPORATIVO';
  limiteUsuarios: number;
  limiteObras: number;
  totalUsuarios?: number;
  totalObras?: number;
}

export interface TeamMember {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  role: 'ADMIN' | 'GESTOR' | 'CAMPO' | 'LEITOR';
  ativo: boolean;
  createdAt: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Erro na requisição (HTTP ${res.status})`);
  }
  return data as T;
}

export const authApi = {
  me: () => request<{ user: AuthUser; tenant: TenantInfo }>('/api/auth/me'),

  login: (dados: { email: string; senha: string }) =>
    request<{ success: boolean; user: AuthUser; tenant: TenantInfo; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(dados),
    }),

  register: (dados: {
    nomeEmpresa: string;
    nomeUsuario: string;
    email: string;
    senha: string;
    cnpj?: string;
    plano?: 'INDIVIDUAL' | 'CORPORATIVO';
  }) =>
    request<{ success: boolean; user: AuthUser; tenant: TenantInfo; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(dados),
    }),

  logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  team: () => request<{ members: TeamMember[] }>('/api/auth/team'),

  invite: (dados: {
    nome: string;
    email: string;
    senha: string;
    cargo?: string;
    role?: 'ADMIN' | 'GESTOR' | 'CAMPO' | 'LEITOR';
  }) =>
    request<{ success: boolean; member: TeamMember }>('/api/auth/team/invite', {
      method: 'POST',
      body: JSON.stringify(dados),
    }),
};
