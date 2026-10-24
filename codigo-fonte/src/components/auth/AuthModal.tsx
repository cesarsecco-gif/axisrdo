import React, { useState } from 'react';
import { AxisLogo } from '../AxisLogo';
import { authApi, AuthUser, TenantInfo } from '../../services/authApi';
import { Lock, Mail, User, Building, ShieldCheck, ArrowRight, Loader2, X, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (user: AuthUser, tenant: TenantInfo) => void;
  isInitial?: boolean; // Se for tela inicial obrigatória
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, isInitial = false }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Form Login
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Form Registro
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [plano, setPlano] = useState<'INDIVIDUAL' | 'CORPORATIVO'>('INDIVIDUAL');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const res = await authApi.login({ email, senha });
      onSuccess(res.user, res.tenant);
      if (onClose) onClose();
    } catch (err: any) {
      setErro(err.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const res = await authApi.register({
        nomeEmpresa,
        nomeUsuario,
        email,
        senha,
        cnpj,
        plano,
      });
      onSuccess(res.user, res.tenant);
      if (onClose) onClose();
    } catch (err: any) {
      setErro(err.message || 'Falha ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-slate-900 p-6 text-white text-center relative">
          {!isInitial && onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="flex justify-center mb-2">
            <AxisLogo variant="full" className="h-10" />
          </div>
          <p className="text-xs text-sky-400 font-medium mt-2">
            {mode === 'login' ? 'Acesse o sistema com suas credenciais' : 'Cadastre sua empresa e comece a gerenciar'}
          </p>
        </div>

        {/* Abas Alternar Login / Cadastro */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => { setMode('login'); setErro(''); }}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${mode === 'login' ? 'border-sky-600 text-sky-700 bg-white' : 'border-transparent hover:bg-slate-100'}`}
          >
            Entrar no Sistema
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErro(''); }}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${mode === 'register' ? 'border-sky-600 text-sky-700 bg-white' : 'border-transparent hover:bg-slate-100'}`}
          >
            Cadastrar Nova Empresa
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {erro && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg flex items-start gap-2">
              <span className="font-bold">Aviso:</span>
              <span>{erro}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seu.email@empresa.com.br"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    placeholder="Sua senha de acesso"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2.5 font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>{loading ? 'Entrando...' : 'Entrar no AXIS RDO'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Nome da Empresa / Construtora</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    required
                    placeholder="Ex: Construtora Alfa Engenharia"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">CNPJ (Opcional)</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Plano Inicial</label>
                  <select
                    value={plano}
                    onChange={(e) => setPlano(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-semibold focus:bg-white focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="INDIVIDUAL">Individual (1 Usuário)</option>
                    <option value="CORPORATIVO">Corporativo (5 Usuários)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Seu Nome Completo (Admin)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={nomeUsuario}
                    onChange={(e) => setNomeUsuario(e.target.value)}
                    required
                    placeholder="Eng. Responsável"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">E-mail Profissional</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@empresa.com.br"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Senha de Acesso</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{loading ? 'Criando Conta...' : 'Criar Conta e Começar'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
