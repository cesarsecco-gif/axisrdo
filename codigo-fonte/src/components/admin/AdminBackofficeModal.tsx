import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  Building2,
  Users,
  Layers,
  DollarSign,
  HardDrive,
  Search,
  Plus,
  Check,
  AlertCircle,
  KeyRound,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Power,
  Edit2
} from 'lucide-react';
import {
  adminApi,
  PlatformMetrics,
  TenantAdminRow,
  UserAdminRow,
} from '../../services/adminApi';
import { AuthUser } from '../../services/authApi';

interface AdminBackofficeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
}

export const AdminBackofficeModal: React.FC<AdminBackofficeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [tab, setTab] = useState<'metrics' | 'tenants' | 'users' | 'settings'>('metrics');
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [tenants, setTenants] = useState<TenantAdminRow[]>([]);
  const [users, setUsers] = useState<UserAdminRow[]>([]);
  const [tenantObras, setTenantObras] = useState<{ tenant: TenantAdminRow; obras: { id: string; nome: string; contrato: string | null; updatedAt: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filtros de busca
  const [searchTenant, setSearchTenant] = useState('');
  const [searchUser, setSearchUser] = useState('');

  // Modal para cadastro manual de nova empresa
  const [modalNovoTenant, setModalNovoTenant] = useState(false);
  const [formTenant, setFormTenant] = useState({
    nomeEmpresa: '',
    cnpj: '',
    plano: 'CORPORATIVO' as 'INDIVIDUAL' | 'CORPORATIVO',
    limiteUsuarios: 10,
    limiteObras: 9999,
    adminNome: '',
    adminEmail: '',
    adminSenha: '',
  });

  // Modal de reset de senha de usuário
  const [modalResetSenha, setModalResetSenha] = useState<UserAdminRow | null>(null);
  const [novaSenhaInput, setNovaSenhaInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAll();
    }
  }, [isOpen]);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, tRes, uRes] = await Promise.all([
        adminApi.getMetrics(),
        adminApi.getTenants(),
        adminApi.getUsers(),
      ]);
      setMetrics(mRes);
      setTenants(tRes.tenants);
      setUsers(uRes.users);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do Backoffice.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTenantWorks = async (tenant: TenantAdminRow) => {
    try {
      const result = await adminApi.getTenantWorks(tenant.id);
      setTenantObras({ tenant, obras: result.obras });
    } catch (err: any) {
      setError(err.message || 'Não foi possível listar os ambientes desta organização.');
    }
  };

  const handleToggleTenantStatus = async (tenant: TenantAdminRow) => {
    try {
      await adminApi.updateTenant(tenant.id, { ativo: !tenant.ativo });
      setSuccessMsg(`Status de "${tenant.nome}" alterado para ${!tenant.ativo ? 'Ativo' : 'Suspenso'}.`);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChangeTenantPlan = async (tenant: TenantAdminRow, novoPlano: 'INDIVIDUAL' | 'CORPORATIVO') => {
    try {
      await adminApi.updateTenant(tenant.id, {
        plano: novoPlano,
        limiteUsuarios: novoPlano === 'CORPORATIVO' ? 10 : 1,
        limiteObras: novoPlano === 'CORPORATIVO' ? 9999 : 3,
      });
      setSuccessMsg(`Plano de "${tenant.nome}" atualizado para ${novoPlano}.`);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateTenantManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await adminApi.createTenant(formTenant);
      setSuccessMsg(`Empresa "${formTenant.nomeEmpresa}" cadastrada com sucesso!`);
      setModalNovoTenant(false);
      setFormTenant({
        nomeEmpresa: '',
        cnpj: '',
        plano: 'CORPORATIVO',
        limiteUsuarios: 10,
        limiteObras: 9999,
        adminNome: '',
        adminEmail: '',
        adminSenha: '',
      });
      loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (user: UserAdminRow, role: any) => {
    try {
      await adminApi.updateUser(user.id, { role });
      setSuccessMsg(`Cargo de ${user.nome} atualizado para ${role}.`);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleUserStatus = async (user: UserAdminRow) => {
    try {
      await adminApi.updateUser(user.id, { ativo: !user.ativo });
      setSuccessMsg(`Usuário ${user.nome} ${!user.ativo ? 'ativado' : 'desativado'}.`);
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveNovaSenha = async () => {
    if (!modalResetSenha || !novaSenhaInput.trim()) return;
    try {
      await adminApi.updateUser(modalResetSenha.id, { novaSenha: novaSenhaInput.trim() });
      setSuccessMsg(`Senha de ${modalResetSenha.nome} atualizada com sucesso!`);
      setModalResetSenha(null);
      setNovaSenhaInput('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  const tenantsFiltrados = tenants.filter(
    (t) =>
      t.nome.toLowerCase().includes(searchTenant.toLowerCase()) ||
      (t.cnpj && t.cnpj.includes(searchTenant))
  );

  const usersFiltrados = users.filter(
    (u) =>
      u.nome.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
      u.tenantNome.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-slate-950 border border-amber-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 my-8 text-white">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  Backoffice Master — Axis Consultoria e Planejamento
                </h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                  SUPERADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Painel central de controle de empresas clientes, usuários, assinaturas e infraestrutura SaaS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              title="Recarregar Dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-950/60 border border-red-800 rounded-xl flex items-center gap-3 text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-300 text-sm">
            <Check className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mt-6 flex border-b border-slate-800 gap-2">
          <button
            onClick={() => setTab('metrics')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              tab === 'metrics'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Métricas & Faturamento
          </button>
          <button
            onClick={() => setTab('tenants')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              tab === 'tenants'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" /> Empresas & Contratos ({tenants.length})
          </button>
          <button
            onClick={() => setTab('users')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              tab === 'users'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> Usuários Globais ({users.length})
          </button>
        </div>

        {/* TAB 1: METRICS */}
        {tab === 'metrics' && metrics && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Building2 className="w-4 h-4 text-amber-400" /> Empresas Clientes
                </div>
                <div className="text-2xl font-bold text-white mt-1">{metrics.totalTenants}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {metrics.corpCount} Corp. | {metrics.indCount} Indiv.
                </div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Users className="w-4 h-4 text-blue-400" /> Usuários na Plataforma
                </div>
                <div className="text-2xl font-bold text-white mt-1">{metrics.totalUsers}</div>
                <div className="text-[11px] text-slate-500 mt-1">Engenheiros e fiscais</div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Layers className="w-4 h-4 text-emerald-400" /> Obras Ativas
                </div>
                <div className="text-2xl font-bold text-white mt-1">{metrics.totalObras}</div>
                <div className="text-[11px] text-slate-500 mt-1">Contratos rodoviários</div>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <DollarSign className="w-4 h-4 text-emerald-400" /> MRR Estimado (Mensal)
                </div>
                <div className="text-2xl font-bold text-emerald-400 mt-1">
                  R$ {metrics.mrrEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Recorrência mensal</div>
              </div>
            </div>

            <div className="p-5 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-400" /> Armazenamento de Fotos e RDOs
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fotos georreferenciadas e backups sincronizados no volume persistente da VPS Hostinger.
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-white">{metrics.totalPhotos} fotos</span>
                <span className="text-xs text-slate-400 block font-mono">
                  ~{(metrics.storageEstimadoMb / 1024).toFixed(2)} GB em uso
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TENANTS & CONTRATOS */}
        {tab === 'tenants' && (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Pesquisar por razão social ou CNPJ..."
                  value={searchTenant}
                  onChange={(e) => setSearchTenant(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                onClick={() => setModalNovoTenant(true)}
                className="py-2 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
              >
                <Plus className="w-4 h-4" /> Cadastrar Empresa / Contrato Manual
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Empresa / Razão Social</th>
                    <th className="p-3">CNPJ</th>
                    <th className="p-3">Plano</th>
                    <th className="p-3">Assentos</th>
                    <th className="p-3">Obras</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {tenantsFiltrados.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-850/50 transition">
                      <td className="p-3 font-semibold text-white">
                        {t.nome}
                        <span className="block text-[10px] text-slate-500 font-mono font-normal">
                          slug: {t.slug}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400">{t.cnpj || '-'}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            t.plano === 'CORPORATIVO'
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          }`}
                        >
                          {t.plano}
                        </span>
                      </td>
                      <td className="p-3">
                        {t.totalUsuarios} / {t.limiteUsuarios >= 999 ? 'Ilimitado' : t.limiteUsuarios}
                      </td>
                      <td className="p-3">
                        <button onClick={() => handleOpenTenantWorks(t)} className="underline decoration-dotted hover:text-white" title="Ver ambientes desta organização">
                          {t.totalObras} / {t.limiteObras >= 999 ? 'Ilimitado' : t.limiteObras}
                        </button>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.ativo
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${t.ativo ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {t.ativo ? 'Ativa' : 'Suspensa'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() =>
                            handleChangeTenantPlan(
                              t,
                              t.plano === 'CORPORATIVO' ? 'INDIVIDUAL' : 'CORPORATIVO'
                            )
                          }
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded border border-slate-700 text-[10px] font-semibold"
                          title="Alternar Plano"
                        >
                          Mudar para {t.plano === 'CORPORATIVO' ? 'Individual' : 'Corporativo'}
                        </button>
                        <button
                          onClick={() => handleToggleTenantStatus(t)}
                          className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                            t.ativo
                              ? 'bg-rose-950/40 text-rose-300 border-rose-800 hover:bg-rose-900/50'
                              : 'bg-emerald-950/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/50'
                          }`}
                        >
                          {t.ativo ? 'Suspender' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: USERS GLOBAIS */}
        {tab === 'users' && (
          <div className="mt-6 space-y-4">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Pesquisar por nome, e-mail ou empresa..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3">Nome / Usuário</th>
                    <th className="p-3">E-mail</th>
                    <th className="p-3">Empresa (Tenant)</th>
                    <th className="p-3">Nível de Acesso</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {usersFiltrados.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-850/50 transition">
                      <td className="p-3 font-semibold text-white">
                        {u.nome}
                        {u.isSuperAdmin && (
                          <span className="ml-1.5 text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1 py-0.2 rounded font-bold">
                            MASTER
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-400">{u.email}</td>
                      <td className="p-3 text-slate-300">{u.tenantNome}</td>
                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateUserRole(u, e.target.value)}
                          className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-1 text-xs focus:outline-none"
                        >
                          <option value="SUPERADMIN">SUPERADMIN (Master)</option>
                          <option value="ADMIN">ADMIN (Dono)</option>
                          <option value="GESTOR">GESTOR (Engenheiro)</option>
                          <option value="CAMPO">CAMPO (Apontador)</option>
                          <option value="LEITOR">LEITOR (Fiscal)</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.ativo
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.ativo ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setModalResetSenha(u);
                            setNovaSenhaInput('');
                          }}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded border border-slate-700 text-[10px] font-semibold"
                          title="Resetar Senha"
                        >
                          Resetar Senha
                        </button>
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={`px-2 py-1 rounded text-[10px] font-semibold border ${
                            u.ativo
                              ? 'bg-rose-950/40 text-rose-300 border-rose-800 hover:bg-rose-900/50'
                              : 'bg-emerald-950/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/50'
                          }`}
                        >
                          {u.ativo ? 'Bloquear' : 'Desbloquear'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: CADASTRAR EMPRESA MANUALMENTE */}
        {modalNovoTenant && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full shadow-2xl text-white">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" /> Cadastrar Empresa Cliente (Contrato Manual)
                </h3>
                <button
                  onClick={() => setModalNovoTenant(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTenantManual} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nome da Empresa / Construtora *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTenant.nomeEmpresa}
                    onChange={(e) => setFormTenant({ ...formTenant, nomeEmpresa: e.target.value })}
                    placeholder="Ex: Construtora Triunfo S.A."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">CNPJ (Opcional)</label>
                    <input
                      type="text"
                      value={formTenant.cnpj}
                      onChange={(e) => setFormTenant({ ...formTenant, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Plano Contratado</label>
                    <select
                      value={formTenant.plano}
                      onChange={(e) =>
                        setFormTenant({
                          ...formTenant,
                          plano: e.target.value as any,
                          limiteUsuarios: e.target.value === 'CORPORATIVO' ? 10 : 1,
                          limiteObras: e.target.value === 'CORPORATIVO' ? 9999 : 3,
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                    >
                      <option value="INDIVIDUAL">Plano Individual (1 usuário, 3 obras)</option>
                      <option value="CORPORATIVO">Plano Corporativo (Ilimitado / Custom)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Limite de Usuários</label>
                    <input
                      type="number"
                      value={formTenant.limiteUsuarios}
                      onChange={(e) => setFormTenant({ ...formTenant, limiteUsuarios: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Limite de Obras</label>
                    <input
                      type="number"
                      value={formTenant.limiteObras}
                      onChange={(e) => setFormTenant({ ...formTenant, limiteObras: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <span className="text-xs font-semibold text-amber-400">Dados do Primeiro Gestor Cliente:</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nome do Gestor Responsável *</label>
                  <input
                    type="text"
                    required
                    value={formTenant.adminNome}
                    onChange={(e) => setFormTenant({ ...formTenant, adminNome: e.target.value })}
                    placeholder="Ex: Eng. Roberto Carlos"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">E-mail de Login *</label>
                    <input
                      type="email"
                      required
                      value={formTenant.adminEmail}
                      onChange={(e) => setFormTenant({ ...formTenant, adminEmail: e.target.value })}
                      placeholder="roberto@construtora.com"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Senha Provisória *</label>
                    <input
                      type="password"
                      required
                      minLength={12}
                      value={formTenant.adminSenha}
                      onChange={(e) => setFormTenant({ ...formTenant, adminSenha: e.target.value })}
                      placeholder="Senha forte"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setModalNovoTenant(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20"
                  >
                    Salvar e Criar Empresa
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {tenantObras && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-2xl w-full shadow-2xl text-white max-h-[80vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-4">
                <div><h3 className="text-sm font-bold">Ambientes de {tenantObras.tenant.nome}</h3><p className="mt-1 text-xs text-slate-400">Obras vinculadas a esta conta. Os dados permanecem isolados por organização.</p></div>
                <button onClick={() => setTenantObras(null)} className="p-1 text-slate-400 hover:text-white" aria-label="Fechar"><X className="w-4 h-4" /></button>
              </div>
              <div className="mt-4 divide-y divide-slate-800">
                {tenantObras.obras.length ? tenantObras.obras.map((obra) => <div key={obra.id} className="py-3 flex flex-wrap justify-between gap-2 text-xs"><div><p className="font-semibold text-white">{obra.nome}</p><p className="text-slate-400">Contrato: {obra.contrato || '—'} · Atualizada: {new Date(obra.updatedAt).toLocaleDateString('pt-BR')}</p></div><p className="text-slate-300">Ambiente ativo</p></div>) : <p className="py-6 text-center text-xs text-slate-400">Esta organização ainda não tem ambientes cadastrados.</p>}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RESETAR SENHA DE USUÁRIO */}
        {modalResetSenha && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-white">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" /> Definir Nova Senha
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Defina a nova senha para o usuário <strong className="text-white">{modalResetSenha.nome}</strong> ({modalResetSenha.email}).
              </p>

              <div className="mt-4">
                <input
                  type="password"
                  minLength={12}
                  placeholder="Digite uma senha com pelo menos 12 caracteres..."
                  value={novaSenhaInput}
                  onChange={(e) => setNovaSenhaInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="mt-4 flex gap-2 justify-end">
                <button
                  onClick={() => setModalResetSenha(null)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNovaSenha}
                  disabled={!novaSenhaInput.trim()}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold"
                >
                  Salvar Nova Senha
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
