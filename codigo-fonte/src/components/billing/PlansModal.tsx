import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Shield,
  Crown,
  Building2,
  User,
  Users,
  AlertCircle,
  Sparkles,
  Layers
} from 'lucide-react';
import { billingApi, PlanoDetalhes, SubscriptionInfo } from '../../services/billingApi';
import { AuthUser } from '../../services/authApi';

interface PlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onPlanUpdated?: () => void;
}

export const PlansModal: React.FC<PlansModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [plans, setPlans] = useState<PlanoDetalhes[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const plansRes = await billingApi.getPlans();
      setPlans(plansRes.plans);

      if (currentUser) {
        const subRes = await billingApi.getSubscription();
        setSubscription(subRes);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados de planos e faturamento.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 my-8 text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Planos & Assinatura <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono uppercase">AXIS RDO</span>
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie seus limites de obras, assentos de colaboradores e armazenamento.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-950/50 border border-red-800/80 rounded-xl flex items-center gap-3 text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Current Subscription Status Bar */}
        {subscription && (
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-slate-800/80 to-slate-850 border border-slate-700/70">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Assinatura Atual da Empresa
                </span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-lg font-bold text-white">{subscription.tenantNome}</span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                      subscription.plano === 'CORPORATIVO'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    }`}
                  >
                    {subscription.plano}
                  </span>
                </div>
              </div>

              {/* Usage Stats Badges */}
              <div className="flex items-center gap-4 text-xs">
                <div className="bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700/60">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" /> Assentos de Usuários
                  </div>
                  <div className="font-semibold text-white mt-0.5">
                    {subscription.usuariosAtivos} / {subscription.limiteUsuarios >= 999 ? 'Ilimitado' : subscription.limiteUsuarios}
                  </div>
                </div>

                <div className="bg-slate-900/80 px-3 py-2 rounded-lg border border-slate-700/60">
                  <div className="text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" /> Obras Simultâneas
                  </div>
                  <div className="font-semibold text-white mt-0.5">
                    {subscription.obrasAtivas} / {subscription.limiteObras >= 999 ? 'Ilimitado' : subscription.limiteObras}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Billing Cycle Toggle */}
        <div className="mt-6 flex justify-center">
          <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700 flex items-center gap-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Faturamento Mensal
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                billingCycle === 'yearly'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Faturamento Anual
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.2 rounded border border-emerald-500/30">
                -17% OFF
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plano) => {
            const isCurrent = subscription?.plano === plano.id;
            const preco = billingCycle === 'yearly' ? plano.precoAnual / 12 : plano.precoMensal;

            return (
              <div
                key={plano.id}
                className={`relative flex flex-col justify-between p-6 rounded-2xl border transition ${
                  plano.destaque
                    ? 'bg-gradient-to-b from-slate-800/90 to-slate-900 border-amber-500/40 shadow-xl shadow-amber-500/5'
                    : 'bg-slate-850/60 border-slate-750'
                }`}
              >
                {plano.destaque && (
                  <div className="absolute -top-3 right-6 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> MAIS ESCOLHIDO
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    {plano.id === 'CORPORATIVO' ? (
                      <Building2 className="w-5 h-5 text-amber-400" />
                    ) : (
                      <User className="w-5 h-5 text-blue-400" />
                    )}
                    <h3 className="text-lg font-bold text-white">{plano.nome}</h3>
                  </div>

                  <p className="mt-2 text-xs text-slate-400 leading-relaxed min-h-[36px]">
                    {plano.descricao}
                  </p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-sm font-semibold text-slate-400">R$</span>
                    <span className="text-3xl font-extrabold text-white tracking-tight">
                      {preco.toFixed(0)}
                    </span>
                    <span className="text-xs text-slate-400">/ mês</span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <span className="text-[11px] text-emerald-400">
                      Cobrado anualmente (R$ {plano.precoAnual.toFixed(0)} / ano)
                    </span>
                  )}

                  <div className="mt-6 border-t border-slate-750 pt-4">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      Recursos inclusos:
                    </span>
                    <ul className="mt-3 space-y-2.5 text-xs text-slate-300">
                      {plano.beneficios.map((b, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-750">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800 text-slate-400 border border-slate-750 text-xs font-bold cursor-default"
                    >
                      Plano Atual Ativo
                    </button>
                  ) : (
                    <div className="w-full py-2.5 px-4 rounded-xl bg-slate-800/70 text-slate-400 border border-slate-750 text-xs text-center">
                      Alterações de plano estarão disponíveis após a integração de pagamentos.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Guarantee */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            <span>Valores e condições são informativos; a contratação será habilitada após a integração do provedor de pagamento.</span>
          </div>
          <span>Axis Consultoria e Planejamento</span>
        </div>
      </div>
    </div>
  );
};
