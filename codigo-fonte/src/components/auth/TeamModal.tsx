import React, { useState, useEffect } from 'react';
import { authApi, TeamMember, TenantInfo } from '../../services/authApi';
import { Users, UserPlus, X, Shield, HardHat, Camera, Eye, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: TenantInfo;
}

export const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose, tenant }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  // Form de convite
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState('Engenheiro de Campo');
  const [role, setRole] = useState<'ADMIN' | 'GESTOR' | 'CAMPO' | 'LEITOR'>('GESTOR');

  useEffect(() => {
    if (isOpen) {
      carregarMembros();
    }
  }, [isOpen]);

  const carregarMembros = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await authApi.team();
      setMembers(res.members);
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar equipe.');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setErro('');
    setSucesso('');
    try {
      const res = await authApi.invite({ nome, email, senha, cargo, role });
      setMembers((prev) => [...prev, res.member]);
      setSucesso(`Usuário ${res.member.nome} cadastrado com sucesso!`);
      setNome('');
      setEmail('');
      setSenha('');
      setShowInviteForm(false);
    } catch (e: any) {
      setErro(e.message || 'Falha ao convidar membro.');
    } finally {
      setInviting(false);
    }
  };

  if (!isOpen) return null;

  const totalAssentos = tenant.limiteUsuarios;
  const assentosUsados = members.length;
  const limiteAtingido = assentosUsados >= totalAssentos;

  const roleBadge = (r: string) => {
    switch (r) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <Shield className="w-3 h-3" /> Administrador
          </span>
        );
      case 'GESTOR':
        return (
          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <HardHat className="w-3 h-3" /> Gestor / Engenheiro
          </span>
        );
      case 'CAMPO':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <Camera className="w-3 h-3" /> Apontador de Campo
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
            <Eye className="w-3 h-3" /> Fiscal / Leitor
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Gestão de Usuários e Equipe</h3>
              <p className="text-xs text-slate-500">
                {tenant.nome} • Plano <strong className="text-sky-700">{tenant.plano}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informação de Assentos do Plano */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase block">Uso de Assentos</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-slate-900">
                {assentosUsados} de {totalAssentos} usuários contratados
              </span>
              {limiteAtingido && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  Limite do Plano
                </span>
              )}
            </div>
          </div>
          {!limiteAtingido && !showInviteForm && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-center"
            >
              <UserPlus className="w-4 h-4" />
              <span>Convidar Membro</span>
            </button>
          )}
        </div>

        {/* Notificações */}
        {erro && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}
        {sucesso && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{sucesso}</span>
          </div>
        )}

        {/* Formulário de Convite */}
        {showInviteForm && (
          <form onSubmit={handleInvite} className="bg-sky-50/60 border border-sky-200 rounded-xl p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between pb-1 border-b border-sky-200">
              <h4 className="text-xs font-bold text-sky-900 uppercase">Novo Membro da Equipe</h4>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
              >
                Cancelar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  placeholder="Nome do engenheiro/fiscal"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="email@empresa.com"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Cargo / Função</label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ex: Engenheiro de Produção"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Nível de Permissão (Role)</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-semibold text-slate-800"
                >
                  <option value="GESTOR">Gestor / Engenheiro (Cria e finaliza RDO)</option>
                  <option value="CAMPO">Apontador de Campo (Tira fotos e rascunhos)</option>
                  <option value="LEITOR">Fiscal / Leitor (Somente visualização de PDFs)</option>
                  <option value="ADMIN">Administrador (Controle total da conta)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">Senha Provisória de Acesso</label>
                <input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={inviting}
                className="bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
              >
                {inviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                <span>Salvar e Cadastrar Membro</span>
              </button>
            </div>
          </form>
        )}

        {/* Lista de Membros */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase">Membros Atuais ({members.length})</h4>
          {loading ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-sky-600" />
              Carregando equipe...
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
              {members.map((m) => (
                <div key={m.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{m.nome}</span>
                      {roleBadge(m.role)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {m.email} • <span className="text-slate-600">{m.cargo}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    Cadastrado em {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
