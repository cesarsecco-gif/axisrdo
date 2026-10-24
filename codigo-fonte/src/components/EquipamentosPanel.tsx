import React, { useState, useMemo, useEffect } from 'react';
import { ReportConfig, Equipamento } from '../types';
import { Plus, Trash2, Download, Printer, Pencil, Check, X } from 'lucide-react';
import { createXlsx } from '../../xlsxWriter';
import { RelatorioEquipamentosPreview } from './RelatorioEquipamentosPreview';
import { CampoCatalogo } from './CampoCatalogo';
import { FaixaCorrecao } from './FaixaCorrecao';
import { registrarValores, CatalogoId } from '../services/catalogos';

const button = 'border rounded-lg px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-40';

export function EquipamentosPanel({
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
  const equipamentos = { items: config.equipamentos?.items || [], efetivo: config.equipamentos?.efetivo || {} };
  const rdoDays = config.rdo?.days || [];

  const [items, setItems] = useState<Equipamento[]>(equipamentos.items);
  const [efetivo, setEfetivo] = useState<Record<string, Record<string, number>>>(equipamentos.efetivo);
  const [showPreview, setShowPreview] = useState(false);

  // Group equipments by nome (type)
  const equipmentTypes = useMemo(() => {
    const types: Record<string, Equipamento[]> = {};
    items.forEach(item => {
      const nome = item.nome.trim().toUpperCase();
      if (!types[nome]) types[nome] = [];
      types[nome].push(item);
    });
    return types;
  }, [items]);

  const sortedTypes = Object.keys(equipmentTypes).sort();
  const itensVisiveis = useMemo(() => {
    if (!correcao) return items;
    const alvos = new Set(correcao.ids);
    return items.filter(i => alvos.has(i.id));
  }, [items, correcao]);

  const allDates = useMemo(() => {
    const dates = new Set(rdoDays.map(d => d.date));
    Object.keys(efetivo).forEach(d => dates.add(d));
    return Array.from(dates).sort();
  }, [rdoDays, efetivo]);

  const [monthFilter, setMonthFilter] = useState(() => {
    if (allDates.length > 0) return allDates[allDates.length - 1].slice(0, 7);
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const monthDates = useMemo(() => {
    if (!monthFilter) return [];
    const [y, m] = monthFilter.split('-');
    const year = parseInt(y, 10);
    const month = parseInt(m, 10);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
  }, [monthFilter]);

  const lastActiveDateInMonth = useMemo(() => {
    const activeDates = monthDates.filter(d => sortedTypes.some(t => (efetivo[d]?.[t] || 0) > 0));
    return activeDates.length > 0 ? activeDates[activeDates.length - 1] : null;
  }, [monthDates, sortedTypes, efetivo]);

  const [newNome, setNewNome] = useState('');
  const [newPlaca, setNewPlaca] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editPlaca, setEditPlaca] = useState('');

  const addItem = () => {
    if (!newNome.trim()) return;
    const newItem: Equipamento = {
      id: crypto.randomUUID(),
      nome: newNome.trim().toUpperCase(),
      placa: newPlaca.trim(),
    };
    const nextItems = [...items, newItem];
    setItems(nextItems);
    setNewNome('');
    setNewPlaca('');
    onChange({ equipamentos: { items: nextItems, efetivo }, catalogos: registrarValores(config, [['equipamentos', newItem.nome], ['placas', newItem.placa]]).catalogos });
  };

  const removeItem = (id: string) => {
    if (!confirm('Remover equipamento?')) return;
    const target = items.find(m => m.id === id);
    const nextItems = items.filter(m => m.id !== id);
    let nextEfetivo = efetivo;
    if (target && !nextItems.some(m => m.nome === target.nome)) {
      nextEfetivo = {};
      for (const date of Object.keys(efetivo)) {
        const day: Record<string, number> | undefined = efetivo[date];
        if (!day || day[target.nome] === undefined) continue;
        const cleaned: Record<string, number> = { ...day };
        delete cleaned[target.nome];
        nextEfetivo[date] = cleaned;
      }
    }
    setItems(nextItems);
    setEfetivo(nextEfetivo);
    onChange({ equipamentos: { items: nextItems, efetivo: nextEfetivo } });
  };

  const startEdit = (m: Equipamento) => {
    setEditingId(m.id);
    setEditNome(m.nome);
    setEditPlaca(m.placa || '');
  };

  const saveEdit = () => {
    if (!editingId || !editNome.trim()) return;
    const target = items.find(m => m.id === editingId);
    const oldName = target?.nome || '';
    const newName = editNome.trim().toUpperCase();
    const nextItems = items.map(m => m.id === editingId ? {
      ...m,
      nome: newName,
      placa: editPlaca.trim().toUpperCase(),
    } : m);
    let nextEfetivo = efetivo;
    if (oldName && oldName !== newName) {
      nextEfetivo = { ...efetivo };
      for (const date of Object.keys(efetivo)) {
        const day: Record<string, number> | undefined = efetivo[date];
        if (!day || day[oldName] === undefined) continue;
        const merged: Record<string, number> = { ...day };
        merged[newName] = (merged[newName] || 0) + (merged[oldName] || 0);
        delete merged[oldName];
        nextEfetivo[date] = merged;
      }
    }
    setItems(nextItems);
    setEfetivo(nextEfetivo);
    setEditingId(null);
    onChange({ equipamentos: { items: nextItems, efetivo: nextEfetivo }, catalogos: registrarValores(config, [['equipamentos', newName], ['placas', editPlaca.trim().toUpperCase()]]).catalogos });
  };

  const cycleQuantity = (date: string, typeName: string, max: number) => {
    const current = efetivo[date]?.[typeName] || 0;
    const nextVal = current >= max ? 0 : current + 1;
    const nextEfetivo = { ...efetivo };
    if (!nextEfetivo[date]) nextEfetivo[date] = {};
    nextEfetivo[date][typeName] = nextVal;
    setEfetivo(nextEfetivo);
    onChange({ equipamentos: { items, efetivo: nextEfetivo } });
  };

  const exportXlsx = async () => {
    if (sortedTypes.length === 0 || monthDates.length === 0) return;
    const headers = ['Equipamento', ...monthDates.map(d => new Date(d + 'T12:00:00').getDate().toString())];
    const rows = sortedTypes.map(typeName => {
      const row = [typeName];
      monthDates.forEach(date => {
        const val = efetivo[date]?.[typeName] || 0;
        row.push(val ? String(val) : (null as any));
      });
      return row;
    });

    const totalRow = ['TOTAL EM USO'];
    monthDates.forEach(date => {
      const total = sortedTypes.reduce((acc, t) => acc + (efetivo[date]?.[t] || 0), 0);
      totalRow.push(String(total) as any);
    });
    rows.push(totalRow);

    const qtyHeaders = ['Equipamento', 'Quantidade Atual'];
    const qtyRows = sortedTypes.map(typeName => [
      typeName,
      lastActiveDateInMonth ? String(efetivo[lastActiveDateInMonth]?.[typeName] || 0) : '0'
    ]);
    qtyRows.push(['TOTAL', lastActiveDateInMonth ? String(sortedTypes.reduce((acc, t) => acc + (efetivo[lastActiveDateInMonth]?.[t] || 0), 0)) : '0']);

    const mobHeaders = ['Placa/Tag', 'Equipamento', 'Período Anterior', 'Período Atual', 'Mobilizado', 'Desmobilizado'];
    const [yearStr, monthStr] = monthFilter.split('-');
    const prevMonthDate = new Date(parseInt(yearStr), parseInt(monthStr) - 2, 1);
    const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    const wasUsedInPrevMonth = (nome: string) => Object.keys(efetivo).some(d => d.startsWith(prevMonthStr) && (efetivo[d]?.[nome] || 0) > 0);
    const wasUsedInCurrentMonth = (nome: string) => Object.keys(efetivo).some(d => d.startsWith(monthFilter) && (efetivo[d]?.[nome] || 0) > 0);
    const isMobilizado = (nome: string) => {
      if (!lastActiveDateInMonth) return false;
      return (efetivo[lastActiveDateInMonth]?.[nome] || 0) > 0;
    };
    const sortedItems = [...items].sort((a, b) => a.nome.localeCompare(b.nome));
    const mobRows = sortedItems.map(item => {
      const mob = isMobilizado(item.nome);
      return [
        item.placa || '-',
        item.nome,
        wasUsedInPrevMonth(item.nome) ? 'SIM' : '',
        wasUsedInCurrentMonth(item.nome) ? 'SIM' : '',
        mob ? 'SIM' : '',
        !mob ? 'SIM' : ''
      ];
    });

    try { await flush(); } catch (e: any) { alert('Não foi possível concluir o salvamento antes da exportação: ' + (e?.message || 'erro desconhecido')); return; }
    const bytes = createXlsx([
      { name: 'Equipamentos', headers, rows },
      { name: 'Quantidades Atuais', headers: qtyHeaders, rows: qtyRows },
      { name: 'Mobilizacao', headers: mobHeaders, rows: mobRows }
    ]);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Equipamentos-${monthFilter}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div className="space-y-6 print:space-y-2">
      {correcao && <FaixaCorrecao quantidade={itensVisiveis.length} item={correcao.item} onLimpar={() => onLimparCorrecao?.()} />}
      <div className="bg-white border rounded-xl p-4 space-y-4">
        <h2 className="text-xl font-bold">Equipamentos</h2>
        <p className="text-sm text-slate-600">Cadastre as máquinas e equipamentos da obra.</p>
        
        <div className="flex flex-wrap gap-2 items-end">
          <CampoCatalogo className="flex-1 min-w-[200px]" catalogo="equipamentos" config={config} valor={newNome} maiusculas
            rotulo="Equipamento" placeholder="Ex: ESCAVADEIRA HIDRÁULICA" onAbrirCatalogo={onAbrirCatalogo} onChange={setNewNome} />
          <CampoCatalogo className="flex-1 min-w-[150px]" catalogo="placas" config={config} valor={newPlaca} maiusculas
            rotulo="Placa / Tag (Opcional)" placeholder="Ex: ABC-1234" onAbrirCatalogo={onAbrirCatalogo} onChange={setNewPlaca} />
          <button className={button + ' !bg-emerald-700 text-white'} disabled={!newNome} onClick={addItem}>
            <Plus className="w-5 h-5 inline mr-1 -mt-1"/> Adicionar
          </button>
        </div>

        {items.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3">Nº</th>
                  <th className="p-3">Equipamento</th>
                  <th className="p-3">Placa / Tag</th>
                  <th className="p-3 w-16">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {itensVisiveis.map((m, i) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="p-3">{i + 1}</td>
                    {editingId === m.id ? (
                      <>
                        <td className="p-3"><CampoCatalogo catalogo="equipamentos" config={config} valor={editNome} maiusculas onChange={setEditNome} /></td>
                        <td className="p-3"><CampoCatalogo catalogo="placas" config={config} valor={editPlaca} maiusculas onChange={setEditPlaca} /></td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button onClick={saveEdit} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded" title="Salvar">
                              <Check className="w-4 h-4"/>
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-slate-500 hover:bg-slate-100 p-1 rounded" title="Cancelar">
                              <X className="w-4 h-4"/>
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 font-medium">{m.nome}</td>
                        <td className="p-3">{m.placa || '-'}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => startEdit(m)} className="text-slate-500 hover:bg-slate-100 p-1 rounded" title="Editar">
                              <Pencil className="w-4 h-4"/>
                            </button>
                            <button onClick={() => removeItem(m.id)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Remover">
                              <Trash2 className="w-4 h-4"/>
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Histograma de Equipamentos</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="month" className="border p-2 rounded" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} />
            <button className={button + ' flex items-center gap-1 text-emerald-700 border-emerald-700 hover:bg-emerald-50'} onClick={() => setShowPreview(true)} disabled={items.length === 0}>
              <Printer className="w-4 h-4"/> Relatório de Mobilização
            </button>
            <button className={button + ' flex items-center gap-1'} onClick={exportXlsx} disabled={sortedTypes.length === 0 || monthDates.length === 0}>
              <Download className="w-4 h-4"/> XLSX
            </button>
            <button className={button + ' flex items-center gap-1'} onClick={() => window.print()} disabled={sortedTypes.length === 0 || monthDates.length === 0}>
              <Printer className="w-4 h-4"/> Imprimir (PDF)
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-600">Clique na célula para alterar a quantidade de equipamentos utilizados no dia.</p>
        
        {sortedTypes.length === 0 ? (
          <p className="text-amber-700 bg-amber-50 p-3 rounded">Cadastre os equipamentos primeiro.</p>
        ) : monthDates.length === 0 ? (
          <p className="text-amber-700 bg-amber-50 p-3 rounded">Não há datas de RDO ou registros para este mês.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs text-center border-collapse">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-2 border-r text-left sticky left-0 bg-slate-50 z-10 w-48 min-w-[200px]">Equipamento</th>
                  {monthDates.map(date => {
                    const d = new Date(date + 'T12:00:00');
                    return (
                      <th key={date} className="p-2 border-r min-w-[36px]" title={date}>
                        {d.getDate()}<br/>
                        <span className="text-[10px] text-slate-500 font-normal">{d.toLocaleDateString('pt-BR',{weekday:'short'}).toUpperCase().slice(0,3)}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedTypes.map(typeName => {
                  const max = equipmentTypes[typeName].length;
                  return (
                    <tr key={typeName} className="hover:bg-slate-50">
                      <td className="p-2 border-r text-left sticky left-0 bg-white font-medium truncate z-10" title={typeName}>
                        {typeName} <span className="text-slate-400 font-normal ml-1">(max {max})</span>
                      </td>
                      {monthDates.map(date => {
                        const val = efetivo[date]?.[typeName] || 0;
                        return (
                          <td key={date} className="p-0 border-r relative">
                            <button 
                              className={`w-full h-full min-h-[32px] hover:bg-slate-100 ${val > 0 ? 'text-emerald-700 font-bold bg-emerald-50' : 'text-slate-300'}`}
                              onClick={() => cycleQuantity(date, typeName, max)}
                            >
                              {val > 0 ? val : '•'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bg-slate-100 font-bold border-t">
                  <td className="p-2 border-r text-left sticky left-0 z-10 bg-slate-100">Total em uso</td>
                  {monthDates.map(date => {
                    const total = sortedTypes.reduce((acc, t) => acc + (efetivo[date]?.[t] || 0), 0);
                    return (
                      <td key={date} className="p-2 border-r text-slate-800">
                        {total}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {sortedTypes.length > 0 && monthDates.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-bold mb-4">
              Quantidade Atual 
              <span className="text-sm font-normal text-slate-500 ml-2">
                ({lastActiveDateInMonth ? new Date(lastActiveDateInMonth + 'T12:00:00').toLocaleDateString('pt-BR') : 'Nenhum registro no mês'})
              </span>
            </h3>
            <div className="overflow-x-auto border rounded-lg max-w-2xl">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="p-3 border-r">Equipamento</th>
                    <th className="p-3 text-center w-48">Quantidade Atual</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedTypes.map(typeName => (
                    <tr key={typeName} className="hover:bg-slate-50">
                      <td className="p-3 border-r font-medium">{typeName}</td>
                      <td className="p-3 text-center font-bold text-slate-700">
                        {lastActiveDateInMonth ? (efetivo[lastActiveDateInMonth]?.[typeName] || 0) : 0}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold border-t">
                    <td className="p-3 border-r text-right">TOTAL</td>
                    <td className="p-3 text-center text-emerald-700 text-base">
                      {lastActiveDateInMonth ? sortedTypes.reduce((acc, t) => acc + (efetivo[lastActiveDateInMonth]?.[t] || 0), 0) : 0}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showPreview && (
        <RelatorioEquipamentosPreview config={config} monthFilter={monthFilter} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}
