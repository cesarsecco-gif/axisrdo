import React, { useMemo, useState } from 'react';
import { ReportConfig, AcaoCorretiva } from '../types';
import { Plus, Trash2, Download, Printer } from 'lucide-react';
import { createXlsx } from '../../xlsxWriter';
import { CampoCatalogo } from './CampoCatalogo';
import { FaixaCorrecao } from './FaixaCorrecao';
import { registrarValores, CatalogoId } from '../services/catalogos';

const button = 'border rounded-lg px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-40';

export function AcoesCorretivasPanel({
  config,
  onChange,
  flush,
  onAbrirCatalogo,
  correcao,
  onLimparCorrecao,
}: {
  config: ReportConfig;
  onChange: (c: Partial<ReportConfig>) => void;
  flush: () => Promise<unknown>;
  onAbrirCatalogo?: (c: CatalogoId) => void;
  correcao?:{ids:string[];item:string};onLimparCorrecao?:()=>void;
}) {
  const acoes = Array.isArray(config.acoes) ? config.acoes : [];
  const [items, setItems] = useState<AcaoCorretiva[]>(acoes);

  const itensVisiveis = useMemo(() => {
    if (!correcao) return items;
    const alvos = new Set(correcao.ids);
    return items.filter(i => alvos.has(i.id));
  }, [items, correcao]);

  const [newRnf, setNewRnf] = useState('');
  const [newAcao, setNewAcao] = useState('');
  const [newHabilitacao, setNewHabilitacao] = useState('');
  const [newImplementacao, setNewImplementacao] = useState('');

  const addItem = () => {
    if (!newAcao.trim()) return;
    const newItem: AcaoCorretiva = {
      id: crypto.randomUUID(),
      rnf: newRnf.trim(),
      acao: newAcao.trim(),
      habilitacao: newHabilitacao.trim(),
      implementacao: newImplementacao.trim(),
    };
    const nextItems = [...items, newItem];
    setItems(nextItems);
    setNewRnf('');
    setNewAcao('');
    setNewHabilitacao('');
    setNewImplementacao('');
    onChange({ acoes: nextItems, catalogos: registrarValores(config, [['acoes', newItem.acao]]).catalogos });
  };

  const removeItem = (id: string) => {
    if (!confirm('Remover esta ação corretiva?')) return;
    const nextItems = items.filter(m => m.id !== id);
    setItems(nextItems);
    onChange({ acoes: nextItems });
  };

  const exportXlsx = async () => {
    if (items.length === 0) return;
    const headers = ['Nº RNF', 'Ação', 'Habilitação', 'Implementação'];
    const rows = items.map(m => [m.rnf, m.acao, m.habilitacao, m.implementacao]);

    try { await flush(); } catch (e: any) { alert('Não foi possível concluir o salvamento antes da exportação: ' + (e?.message || 'erro desconhecido')); return; }
    const bytes = createXlsx([{ name: 'Acoes_Corretivas', headers, rows }]);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Acoes_Corretivas.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div className="space-y-6 print:space-y-2">
      {correcao && <FaixaCorrecao quantidade={itensVisiveis.length} item={correcao.item} onLimpar={() => onLimparCorrecao?.()} />}
      <div className="bg-white border rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Ações Corretivas</h2>
            <p className="text-sm text-slate-600">Registre as ações corretivas tomadas na obra.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className={button + ' flex items-center gap-1'} onClick={exportXlsx} disabled={items.length === 0}>
              <Download className="w-4 h-4"/> XLSX
            </button>
            <button className={button + ' flex items-center gap-1'} onClick={() => window.print()} disabled={items.length === 0}>
              <Printer className="w-4 h-4"/> Imprimir (PDF)
            </button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 items-end">
          <label className="w-24">
            <span className="block text-xs font-semibold uppercase mb-1">Nº RNF</span>
            <input className="w-full border p-2 rounded" value={newRnf} onChange={e=>setNewRnf(e.target.value)} placeholder="Ex: 01" />
          </label>
          <CampoCatalogo className="flex-1 min-w-[200px]" catalogo="acoes" config={config} valor={newAcao}
            rotulo="Ação" placeholder="Descrição da ação..." onAbrirCatalogo={onAbrirCatalogo} onChange={setNewAcao} />
          <label className="w-40">
            <span className="block text-xs font-semibold uppercase mb-1">Habilitação</span>
            <input type="date" className="w-full border p-2 rounded" value={newHabilitacao} onChange={e=>setNewHabilitacao(e.target.value)} />
          </label>
          <label className="w-40">
            <span className="block text-xs font-semibold uppercase mb-1">Implementação</span>
            <input type="date" className="w-full border p-2 rounded" value={newImplementacao} onChange={e=>setNewImplementacao(e.target.value)} />
          </label>
          <button className={button + ' !bg-emerald-700 text-white'} disabled={!newAcao} onClick={addItem}>
            <Plus className="w-5 h-5 inline mr-1 -mt-1"/> Adicionar
          </button>
        </div>

        {items.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3 w-24">Nº RNF</th>
                  <th className="p-3">Ação</th>
                  <th className="p-3 w-40">Habilitação</th>
                  <th className="p-3 w-40">Implementação</th>
                  <th className="p-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itensVisiveis.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium">{m.rnf || '-'}</td>
                    <td className="p-3">{m.acao}</td>
                    <td className="p-3">{m.habilitacao ? new Date(m.habilitacao + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="p-3">{m.implementacao ? new Date(m.implementacao + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}</td>
                    <td className="p-3">
                      <button onClick={() => removeItem(m.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {items.length === 0 && (
          <p className="text-slate-600 bg-slate-50 p-3 rounded">Nenhuma ação corretiva registrada.</p>
        )}
      </div>
    </div>
  );
}
