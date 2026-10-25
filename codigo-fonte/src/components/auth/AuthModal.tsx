import React, { useState, useEffect } from 'react';
import { AxisLogo } from '../AxisLogo';
import { authApi, AuthUser, TenantInfo } from '../../services/authApi';
import { Lock, Mail, User, Building, ShieldCheck, ArrowRight, Loader2, X, CheckCircle2, ShieldAlert } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: (user: AuthUser, tenant: TenantInfo) => void;
  isInitial?: boolean;
  initialMode?: 'login' | 'register' | 'admin_login';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isInitial = false,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'admin_login'>('login');
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

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErro('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const res = await authApi.login({ email, senha, area: mode === 'admin_login' ? 'platform' : 'client' });
      if (mode === 'admin_login' && !res.user.isSuperAdmin && res.user.role !== 'SUPERADMIN') {
        throw new Error('Esta conta não possui privilégios de Gestão Master da Axis Consultoria.');
      }
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
      <div className={`rounded-2xl border shadow-2xl max-w-md w-full overflow-hidden transition-all ${
        mode === 'admin_login'
          ? 'bg-slate-900 border-amber-500/40 text-white shadow-amber-500/10'
          : 'bg-white border-slate-200 text-slate-800'
      }`}>
        {/* Cabeçalho */}
        <div className={`p-6 text-center relative ${
          mode === 'admin_login'
            ? 'bg-gradient-to-b from-slate-950 to-slate-900 border-b border-slate-800'
            : 'bg-slate-900 text-white'
        }`}>
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
          <p className={`text-xs font-medium mt-2 ${
            mode === 'admin_login' ? 'text-amber-400' : 'text-sky-400'
          }`}>
            {mode === 'login' && 'Área do Cliente — Acesse suas obras e diários'}
            {mode === 'register' && 'Cadastre sua empresa e comece a gerenciar'}
            {mode === 'admin_login' && 'Acesso à Gestão da Plataforma Axis'}
          </p>
        </div>

        {/* Abas Alternar Login / Cadastro / Gestão Master */}
        <div className={`flex border-b text-[11px] font-bold ${
          mode === 'admin_login'
            ? 'border-slate-800 bg-slate-950 text-slate-400'
            : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}>
          <button
            type="button"
            onClick={() => { setMode('login'); setErro(''); }}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${
              mode === 'login'
                ? 'border-sky-600 text-sky-700 bg-white font-extrabold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Área do Cliente
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErro(''); }}
            className={`flex-1 py-3 text-center border-b-2 transition-all ${
              mode === 'register'
                ? 'border-sky-600 text-sky-700 bg-white font-extrabold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Nova Empresa
          </button>
          <button
            type="button"
            onClick={() => { setMode('admin_login'); setErro(''); }}
            className={`flex-1 py-3 text-center border-b-2 transition-all flex items-center justify-center gap-1 ${
              mode === 'admin_login'
                ? 'border-amber-500 text-amber-400 bg-slate-900 font-extrabold'
                : 'border-transparent hover:text-amber-400'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            Gestão Axis
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

          {mode === 'admin_login' && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                Área restrita à diretoria e equipe técnica da <strong>Axis Consultoria e Planejamento</strong> para controle de clientes e auditoria.
              </span>
            </div>
          )}

          {mode === 'login' || mode === 'admin_login' ? (
            <form onSubmit={handleLogin} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className={`block text-[11px] font-bold uppercase mb-1 ${
                  mode === 'admin_login' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  E-mail {mode === 'admin_login' && 'do Gestor Axis'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={mode === 'admin_login' ? 'E-mail de administrador da plataforma' : 'seu@email.com'}
                    className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none transition ${
                      mode === 'admin_login'
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-amber-500'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-[11px] font-bold uppercase mb-1 ${
                  mode === 'admin_login' ? 'text-slate-300' : 'text-slate-700'
                }`}>
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Sua senha secreta"
                    className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-xs sm:text-sm focus:outline-none transition ${
                      mode === 'admin_login'
                        ? 'bg-slate-800 border-slate-700 text-white focus:border-amber-500'
                        : 'bg-white border-slate-300 text-slate-900 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50 ${
                  mode === 'admin_login'
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-amber-500/20'
                    : 'bg-sky-700 hover:bg-sky-800 shadow-sky-700/20'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Autenticando...
                  </>
                ) : (
                  <>
                    {mode === 'admin_login' ? 'Acessar Backoffice Axis' : 'Entrar na Plataforma'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Nome da Empresa / Construtora</label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    placeholder="Ex: Construtora Silva & Filhos"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">CNPJ (Opcional)</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Seu Nome Completo (Gestor da Conta)</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={nomeUsuario}
                    onChange={(e) => setNomeUsuario(e.target.value)}
                    placeholder="Ex: Eng. Carlos Alberto"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">E-mail Profissional</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="carlos@construtora.com.br"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Crie uma Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Escolha do Plano Inicial */}
              <div className="pt-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">Escolha o Plano Inicial</label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => setPlano('INDIVIDUAL')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      plano === 'INDIVIDUAL'
                        ? 'border-sky-600 bg-sky-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-bold text-slate-900 text-xs">Individual</span>
                      {plano === 'INDIVIDUAL' && <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 block leading-tight">1 usuário • até 3 obras</span>
                    <span className="text-xs font-extrabold text-sky-700 mt-1 block">R$ 149/mês</span>
                  </div>

                  <div
                    onClick={() => setPlano('CORPORATIVO')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      plano === 'CORPORATIVO'
                        ? 'border-amber-600 bg-amber-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-bold text-slate-900 text-xs">Corporativo</span>
                      {plano === 'CORPORATIVO' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 block leading-tight">10 usuários • obras ilimitadas</span>
                    <span className="text-xs font-extrabold text-amber-700 mt-1 block">R$ 489/mês</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-sky-700 hover:bg-sky-800 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-md shadow-sky-700/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Criando Conta Empresarial...
                  </>
                ) : (
                  <>
                    Criar Conta Empresarial <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
