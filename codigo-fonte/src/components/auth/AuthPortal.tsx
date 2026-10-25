import React, { useEffect, useState } from 'react';
import { AxisLogo } from '../AxisLogo';
import { authApi, AuthUser, TenantInfo } from '../../services/authApi';
import {
  Lock,
  Mail,
  User,
  Building,
  ShieldAlert,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Camera,
  FileSpreadsheet,
  Check,
  ShieldCheck,
  MapPin,
  Sparkles
} from 'lucide-react';

interface AuthPortalProps {
  onSuccess: (user: AuthUser, tenant: TenantInfo) => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'admin_login'>('login');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [selfSignup, setSelfSignup] = useState(true);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(data => {
      setSelfSignup(data.selfSignup !== false);
      if (data.selfSignup === false) setMode('login');
    }).catch(() => {});
  }, []);

  // Login form
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  // Register form
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [plano, setPlano] = useState<'INDIVIDUAL' | 'CORPORATIVO'>('INDIVIDUAL');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const res = await authApi.login({ email, senha, area: mode === 'admin_login' ? 'platform' : 'client' });
      onSuccess(res.user, res.tenant);
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
    } catch (err: any) {
      setErro(err.message || 'Falha ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-white selection:bg-amber-500 selection:text-black">
      {/* Top Banner on Mobile */}
      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <AxisLogo variant="full" className="h-9" />
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-block text-xs text-slate-400 font-mono">
            Axis Consultoria e Planejamento
          </span>
          <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
            SaaS Cloud v1.14
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Side: Presentation / Hero */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Plataforma Oficial de Supervisão de Obras & RDO</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Gestão Inteligente de <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500">Diários de Obras</span> e Relatórios Fotográficos.
          </h1>

          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-xl">
            Solução técnica completa para construtoras, supervisoras rodoviárias e consultorias de engenharia civil. Controle de contratos, frentes de serviço e fiscalização com padrão executivo.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Georreferenciamento & OCR</h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Fotos com GPS, estaqueamento, lado e leitura automática de carimbos.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center flex-shrink-0">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">RDOs Diários & Lotes</h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Exportação executiva em PDF e relatórios consolidados em Excel (.xlsx).
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Perfis de Acesso (RBAC)</h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Níveis dedicados para Administradores, Gestores, Campo e Fiscais.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Multi-Empresa Seguro</h4>
                <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                  Isolamento total de dados e armazenamento permanente em nuvem.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Access Card */}
        <div className="lg:col-span-5">
          <div className={`rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 ${
            mode === 'admin_login'
              ? 'bg-slate-900 border-amber-500/40 shadow-amber-500/10'
              : 'bg-slate-900/90 border-slate-800 shadow-sky-500/5'
          }`}>
            {/* Header das Abas de Acesso */}
            <div className="flex border-b border-slate-800 bg-slate-950/70 text-xs font-bold text-slate-400">
              <button
                type="button"
                onClick={() => { setMode('login'); setErro(''); }}
                className={`flex-1 py-3.5 text-center border-b-2 transition ${
                  mode === 'login'
                    ? 'border-sky-500 text-sky-400 bg-slate-900'
                    : 'border-transparent hover:text-white'
                }`}
              >
                Área do Cliente
              </button>
              {selfSignup && <button
                type="button"
                onClick={() => { setMode('register'); setErro(''); }}
                className={`flex-1 py-3.5 text-center border-b-2 transition ${
                  mode === 'register'
                    ? 'border-sky-500 text-sky-400 bg-slate-900'
                    : 'border-transparent hover:text-white'
                }`}
              >
                Nova Empresa
              </button>}
              <button
                type="button"
                onClick={() => { setMode('admin_login'); setErro(''); }}
                className={`flex-1 py-3.5 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                  mode === 'admin_login'
                    ? 'border-amber-500 text-amber-400 bg-slate-900'
                    : 'border-transparent hover:text-amber-400'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Gestão Axis
              </button>
            </div>

            {/* Conteúdo do Formulário */}
            <div className="p-6 sm:p-7">
              {!selfSignup && <div className="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">Novos acessos comerciais serão liberados após a integração do pagamento. A administração da plataforma pode cadastrar contas corporativas manualmente.</div>}
              {erro && (
                <div className="mb-4 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl flex items-start gap-2">
                  <span className="font-bold">Aviso:</span>
                  <span>{erro}</span>
                </div>
              )}

              {mode === 'admin_login' && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Acesso restrito à diretoria e equipe técnica da <strong>Axis Consultoria e Planejamento</strong> para controle de clientes e auditoria.
                  </span>
                </div>
              )}

              {/* Formulário: Login Cliente ou Login Admin Axis */}
              {mode === 'login' || mode === 'admin_login' ? (
                <form onSubmit={handleLogin} className="space-y-4 text-xs sm:text-sm">
                  <div>
                    <label className={`block text-[11px] font-bold uppercase mb-1.5 ${
                      mode === 'admin_login' ? 'text-slate-300' : 'text-slate-300'
                    }`}>
                      E-mail {mode === 'admin_login' && 'do Gestor Master'}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={mode === 'admin_login' ? 'E-mail de administrador da plataforma' : 'seu@email.com'}
                        className={`w-full pl-9 pr-3 py-2.5 bg-slate-800/90 border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition ${
                          mode === 'admin_login'
                            ? 'border-slate-700 focus:border-amber-500'
                            : 'border-slate-700 focus:border-sky-500'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                      Senha
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="password"
                        required
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder="••••••••"
                        className={`w-full pl-9 pr-3 py-2.5 bg-slate-800/90 border rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition ${
                          mode === 'admin_login'
                            ? 'border-slate-700 focus:border-amber-500'
                            : 'border-slate-700 focus:border-sky-500'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3 px-4 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg disabled:opacity-50 text-white ${
                      mode === 'admin_login'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 shadow-amber-500/20'
                        : 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/20'
                    }`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Autenticando...
                      </>
                    ) : (
                      <>
                        {mode === 'admin_login' ? 'Acessar Gestão Master Axis' : 'Entrar no Sistema'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Formulário: Cadastro de Nova Empresa Cliente */
                <form onSubmit={handleRegister} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Razão Social / Nome da Empresa *
                    </label>
                    <div className="relative">
                      <Building className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={nomeEmpresa}
                        onChange={(e) => setNomeEmpresa(e.target.value)}
                        placeholder="Ex: Construtora Silva Ltda."
                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      CNPJ (Opcional)
                    </label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      placeholder="00.000.000/0000-00"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Nome do Gestor Responsável *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={nomeUsuario}
                        onChange={(e) => setNomeUsuario(e.target.value)}
                        placeholder="Ex: Eng. Roberto Carlos"
                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      E-mail de Acesso *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="roberto@construtora.com.br"
                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Crie uma Senha *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        minLength={mode === 'register' ? 12 : undefined}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        placeholder={mode === 'register' ? 'Mínimo 12 caracteres' : 'Sua senha'}
                        className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Escolha do Plano Inicial */}
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1.5">
                      Escolha o Plano Inicial
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div
                        onClick={() => setPlano('INDIVIDUAL')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                          plano === 'INDIVIDUAL'
                            ? 'border-sky-500 bg-sky-500/10 shadow-xs'
                            : 'border-slate-800 hover:border-slate-700 bg-slate-800/60'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-bold text-white text-xs">Individual</span>
                          {plano === 'INDIVIDUAL' && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 block leading-tight">1 usuário • até 3 obras</span>
                        <span className="text-xs font-extrabold text-sky-400 mt-1 block">R$ 149/mês</span>
                      </div>

                      <div
                        onClick={() => setPlano('CORPORATIVO')}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                          plano === 'CORPORATIVO'
                            ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                            : 'border-slate-800 hover:border-slate-700 bg-slate-800/60'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-bold text-white text-xs">Corporativo</span>
                          {plano === 'CORPORATIVO' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <span className="text-[10px] text-slate-400 block leading-tight">10 usuários • ilimitado</span>
                        <span className="text-xs font-extrabold text-amber-400 mt-1 block">R$ 489/mês</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-sky-600/20 disabled:opacity-50"
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
      </main>

      {/* Footer */}
      <footer className="p-4 sm:p-6 text-center text-xs text-slate-500 border-t border-slate-900 bg-slate-950">
        <span>© {new Date().getFullYear()} <strong>Axis Consultoria e Planejamento</strong>. Todos os direitos reservados.</span>
      </footer>
    </div>
  );
};
