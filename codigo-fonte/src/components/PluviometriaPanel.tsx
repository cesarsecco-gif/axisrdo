import React, { useState, useMemo } from 'react';
import { ReportConfig, PluviometriaDia } from '../types';
import { Download, Printer, CloudRain, Upload, RefreshCw } from 'lucide-react';
import { createXlsx } from '../../xlsxWriter';
import { photoDate } from '../services/organization';

const button = 'border rounded-lg px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-40';

export function PluviometriaPanel({
  config,
  onChange,
  flush,
}: {
  config: ReportConfig;
  onChange: (c: Partial<ReportConfig>) => void;
  flush: () => Promise<unknown>;
}) {
  const pluviometria = { dias: config.pluviometria?.dias || [], fontePrecipitacao: config.pluviometria?.fontePrecipitacao || '', urlPrecipitacao: config.pluviometria?.urlPrecipitacao || '' };
  const rdoDays = config.rdo?.days || [];

  const [dias, setDias] = useState<PluviometriaDia[]>(pluviometria.dias);
  const [fontePrecipitacao, setFontePrecipitacao] = useState(pluviometria.fontePrecipitacao || '');
  const [urlPrecipitacao, setUrlPrecipitacao] = useState(pluviometria.urlPrecipitacao || '');
  const [isFetching, setIsFetching] = useState(false);
  const [printOrientation, setPrintOrientation] = useState<'portrait'|'landscape'>('portrait');

  const allDates = useMemo(() => {
    const dates = new Set(rdoDays.map(d => d.date));
    dias.forEach(d => dates.add(d.data));
    return Array.from(dates).sort();
  }, [rdoDays, dias]);

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

  const getDia = (date: string) => {
    return dias.find(d => d.data === date) || { data: date, manha: '', tarde: '', noite: '', clima: '', precipitacao: '', observacao: '' };
  };

  const rainFor = (date: string) => {
    const value = Number.parseFloat(String(getDia(date).precipitacao || '').replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const monthlyTotal = monthDates.reduce((total, date) => total + rainFor(date), 0);
  const rainyDays = monthDates.filter(date => rainFor(date) > 0).length;
  const maxDailyRain = Math.max(0, ...monthDates.map(rainFor));
  const monthTitle = monthFilter
    ? new Date(`${monthFilter}-15T12:00:00`).toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'}).toLocaleUpperCase('pt-BR')
    : '';

  const printReport = async () => {
    try {
      await flush();
    } catch (e: any) {
      alert('Não foi possível concluir o salvamento antes da impressão: ' + (e?.message || 'erro desconhecido'));
      return;
    }
    const pageStyle = document.createElement('style');
    pageStyle.dataset.pluviometriaPrint = 'true';
    pageStyle.textContent = `@page { size: A4 ${printOrientation}; margin: 8mm; }`;
    document.head.appendChild(pageStyle);
    document.body.classList.add('pluviometria-print', `pluviometria-print--${printOrientation}`);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('pluviometria-print');
      document.body.classList.remove(`pluviometria-print--${printOrientation}`);
      pageStyle.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup, {once: true});
    window.setTimeout(cleanup, 60000);
    window.print();
  };

  const updateDia = (date: string, field: keyof PluviometriaDia, value: string) => {
    if (field === 'precipitacao' && value !== '') {
      const n = parseFloat(String(value).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > 5000) value = '';
    }
    const nextDias = [...dias];
    const idx = nextDias.findIndex(d => d.data === date);
    if (idx >= 0) {
      nextDias[idx] = { ...nextDias[idx], [field]: value };
    } else {
      nextDias.push({ data: date, manha: '', tarde: '', noite: '', clima: '', precipitacao: '', observacao: '', [field]: value });
    }
    setDias(nextDias);
    onChange({ pluviometria: { dias: nextDias, fontePrecipitacao, urlPrecipitacao } });
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/);
      let newDias = [...dias];
      let imported = 0;
      let skipped = 0;

      lines.forEach(line => {
        const clean = line.replace(/["']/g,'').trim();
        if (!clean) return;
        const parts = clean.split(/[;\t]/).map(p=>p.trim());
        if (parts.length < 2) { skipped++; return; }
        const datePart = parts[0];
        const valPart = parts[1];

        let parsedDate = '';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(datePart)) {
          parsedDate = photoDate(datePart)?.key || '';
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          const [y, m, d] = datePart.split('-');
          parsedDate = photoDate(`${d}/${m}/${y}`)?.key || '';
        }

        const value = parseFloat(valPart.replace(',', '.'));
        if (parsedDate && Number.isFinite(value) && value >= 0 && value <= 5000) {
          const precip = value.toString();
          const idx = newDias.findIndex(d => d.data === parsedDate);
          if (idx >= 0) {
            newDias[idx] = { ...newDias[idx], precipitacao: precip };
          } else {
            newDias.push({ data: parsedDate, manha: '', tarde: '', noite: '', clima: '', precipitacao: precip, observacao: '' });
          }
          imported++;
        } else {
          skipped++;
        }
      });
      setDias(newDias);
      onChange({ pluviometria: { dias: newDias, fontePrecipitacao, urlPrecipitacao } });
      alert(imported > 0
        ? `CSV importado: ${imported} dia(s) atualizado(s)${skipped ? `, ${skipped} linha(s) ignorada(s) por data ou valor inválido.` : '.'}`
        : 'Nenhuma linha válida foi importada. Confira o formato Data;Precipitação (ex.: 01/01/2026;12,5).');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const fetchApi = async () => {
    if (!urlPrecipitacao) {
      alert('Por favor, informe uma URL ou API na fonte de dados.');
      return;
    }
    try {
      setIsFetching(true);
      const res = await fetch(urlPrecipitacao);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      let newDias = [...dias];
      let updated = 0;
      
      if (data.daily && data.daily.time && data.daily.precipitation_sum) {
        data.daily.time.forEach((dateStr: string, idx: number) => {
          const precip = data.daily.precipitation_sum[idx];
          if (precip !== null && precip !== undefined) {
             const parsedDate = dateStr;
             const value = Number(precip);
             if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedDate) || !Number.isFinite(value) || value < 0) return;
             const pStr = value.toString();
             const dIdx = newDias.findIndex(d => d.data === parsedDate);
             if (dIdx >= 0) {
               newDias[dIdx] = { ...newDias[dIdx], precipitacao: pStr };
             } else {
               newDias.push({ data: parsedDate, manha: '', tarde: '', noite: '', clima: '', precipitacao: pStr, observacao: '' });
             }
             updated++;
           }
        });
      } else {
        alert('Formato JSON desconhecido. Por enquanto, só o formato Open-Meteo é mapeado nativamente pela URL. Certifique-se de usar "daily=precipitation_sum".');
      }
      
      if (updated > 0) {
        if (dias.some(d => d.precipitacao && newDias.some(n => n.data === d.data && n.precipitacao !== d.precipitacao)) &&
            !confirm('A sincronização vai sobrescrever precipitação já digitada manualmente. Continuar?')) return;
        setDias(newDias);
        onChange({ pluviometria: { dias: newDias, fontePrecipitacao, urlPrecipitacao } });
        alert(`Atualizado ${updated} dias via API!`);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao buscar dados da API. Verifique a URL e o Console.');
    } finally {
      setIsFetching(false);
    }
  };

  const exportXlsx = async () => {
    if (monthDates.length === 0) return;
    const headers = ['Data', 'Dia da Semana', 'Manhã', 'Tarde', 'Noite', 'Clima Geral', 'Precipitação (mm)', 'Observação'];
    const rows = monthDates.map(date => {
      const d = getDia(date);
      const dataObj = new Date(date + 'T12:00:00');
      return [
        dataObj.toLocaleDateString('pt-BR'),
        dataObj.toLocaleDateString('pt-BR', { weekday: 'long' }),
        d.manha,
        d.tarde,
        d.noite,
        d.clima || '',
        d.precipitacao || '',
        d.observacao
      ];
    });

    try { await flush(); } catch (e: any) { alert('Não foi possível concluir o salvamento antes da exportação: ' + (e?.message || 'erro desconhecido')); return; }
    const bytes = createXlsx([{ name: 'Pluviometria', headers, rows }]);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Pluviometria-${monthFilter}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  return (
    <div className="space-y-6 print:space-y-2">
      <div className="pluviometria-screen">
      <div className="bg-white border rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Acompanhamento Pluviométrico</h2>
            <p className="text-sm text-slate-600">Registre as condições climáticas e a precipitação. O Clima Geral selecionado aqui aparecerá automaticamente no Diário de Obras (RDO) do mesmo dia.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="month" className="border p-2 rounded" value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              Orientação PDF
              <select aria-label="Orientação do PDF" className="border p-2 rounded bg-white" value={printOrientation} onChange={e=>setPrintOrientation(e.target.value as 'portrait'|'landscape')}>
                <option value="portrait">Retrato</option>
                <option value="landscape">Paisagem</option>
              </select>
            </label>
            <button className={button + ' flex items-center gap-1'} onClick={exportXlsx} disabled={monthDates.length === 0}>
              <Download className="w-4 h-4"/> XLSX
            </button>
            <button className={button + ' flex items-center gap-1'} onClick={printReport} disabled={monthDates.length === 0}>
              <Printer className="w-4 h-4"/> Imprimir (PDF)
            </button>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CloudRain className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-slate-800">Importação / Sincronização de Dados</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Fonte dos Dados (Aparece no Relatório)</label>
              <input 
                className="w-full bg-white border border-slate-300 p-2 rounded text-sm focus:ring-1 focus:ring-emerald-500" 
                placeholder="Ex: INMET - Estação Maringá" 
                value={fontePrecipitacao}
                onChange={e => {
                   setFontePrecipitacao(e.target.value);
                   onChange({ pluviometria: { dias, fontePrecipitacao: e.target.value, urlPrecipitacao } });
                }} 
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">URL / API de Pesquisa (JSON)</label>
              <input 
                className="w-full bg-white border border-slate-300 p-2 rounded text-sm focus:ring-1 focus:ring-emerald-500" 
                placeholder="Ex: https://api.open-meteo.com/v1/forecast..." 
                value={urlPrecipitacao}
                onChange={e => {
                   setUrlPrecipitacao(e.target.value);
                   onChange({ pluviometria: { dias, fontePrecipitacao, urlPrecipitacao: e.target.value } });
                }} 
              />
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <label className={button + ' cursor-pointer flex items-center gap-2 !bg-emerald-700 text-white hover:!bg-emerald-800 border-none'}>
              <Upload className="w-4 h-4" />
              <span className="font-bold text-xs">Importar CSV</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
            </label>
            
            <button className={button + ' flex items-center gap-2 text-emerald-700 border-emerald-700 hover:bg-emerald-50 font-bold text-xs'} onClick={fetchApi} disabled={!urlPrecipitacao || isFetching}>
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span>{isFetching ? 'Buscando...' : 'Sincronizar via API'}</span>
            </button>
          </div>
        </div>

        {monthDates.length === 0 ? (
          <p className="text-amber-700 bg-amber-50 p-3 rounded">Não há datas de RDO ou registros para este mês.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-3 border-r w-32">Data</th>
                  <th className="p-3 border-r w-32">Dia da Semana</th>
                  <th className="p-3 border-r w-20 text-center">Manhã</th>
                  <th className="p-3 border-r w-20 text-center">Tarde</th>
                  <th className="p-3 border-r w-20 text-center">Noite</th>
                  <th className="p-3 border-r w-32 text-center">Clima Geral</th>
                  <th className="p-3 border-r w-28 text-center">Chuva (mm)</th>
                  <th className="p-3">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {monthDates.map(date => {
                  const d = new Date(date + 'T12:00:00');
                  const val = getDia(date);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  
                  return (
                    <tr key={date} className={`hover:bg-slate-50 ${isWeekend ? 'bg-slate-50 text-slate-500' : ''}`}>
                      <td className="p-2 border-r">{d.toLocaleDateString('pt-BR')}</td>
                      <td className="p-2 border-r capitalize">{d.toLocaleDateString('pt-BR',{weekday:'long'})}</td>
                      <td className="p-0 border-r relative">
                        <select className="w-full h-full min-h-[36px] bg-transparent text-center focus:outline-none appearance-none cursor-pointer px-2" value={val.manha} onChange={e=>updateDia(date, 'manha', e.target.value)}>
                          <option value=""></option><option value="B">B</option><option value="C">C</option><option value="I">I</option>
                        </select>
                      </td>
                      <td className="p-0 border-r relative">
                        <select className="w-full h-full min-h-[36px] bg-transparent text-center focus:outline-none appearance-none cursor-pointer px-2" value={val.tarde} onChange={e=>updateDia(date, 'tarde', e.target.value)}>
                          <option value=""></option><option value="B">B</option><option value="C">C</option><option value="I">I</option>
                        </select>
                      </td>
                      <td className="p-0 border-r relative">
                        <select className="w-full h-full min-h-[36px] bg-transparent text-center focus:outline-none appearance-none cursor-pointer px-2" value={val.noite} onChange={e=>updateDia(date, 'noite', e.target.value)}>
                          <option value=""></option><option value="B">B</option><option value="C">C</option><option value="I">I</option>
                        </select>
                      </td>
                      <td className="p-0 border-r relative">
                        <select className="w-full h-full min-h-[36px] bg-transparent text-center focus:outline-none appearance-none cursor-pointer px-2" value={val.clima || ''} onChange={e=>updateDia(date, 'clima', e.target.value)}>
                          <option value=""></option><option value="BOM">BOM</option><option value="INSTÁVEL">INSTÁVEL</option><option value="CHUVOSO">CHUVOSO</option><option value="IMPRATICÁVEL">IMPRATICÁVEL</option>
                        </select>
                      </td>
                      <td className="p-0 border-r relative">
                        <input type="number" step="0.1" min="0" max="5000" className="w-full h-full min-h-[36px] bg-transparent text-center focus:outline-none px-2" value={val.precipitacao || ''} onChange={e=>updateDia(date, 'precipitacao', e.target.value)} placeholder="0.0" />
                      </td>
                      <td className="p-1">
                        <input className="w-full bg-transparent p-1 focus:bg-white focus:ring-1 rounded" value={val.observacao} onChange={e=>updateDia(date, 'observacao', e.target.value)} placeholder="Adicionar nota..." />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {monthDates.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
              <CloudRain className="w-5 h-5 text-emerald-700" />
              Gráfico de Precipitação Diária (mm)
            </h3>
            
            <div className="w-full overflow-x-auto pb-4">
              {(() => {
                const maxRainVal = Math.max(0, ...monthDates.map(d => parseFloat(getDia(d).precipitacao) || 0));
                const safeMax = Number.isFinite(maxRainVal) ? maxRainVal : 0;
                const yAxisMax = Math.max(10, Math.min(100000, Math.ceil(safeMax / 5) * 5));
                const yAxisSteps = Array.from({ length: (yAxisMax / 5) + 1 }, (_, i) => i * 5);

                return (
                  <div className="flex w-full mt-4 h-56 pb-6 min-w-[600px]">
                    {/* Y-axis Labels */}
                    <div className="flex flex-col justify-between items-end pr-2 text-[10px] text-slate-500 w-8 z-10">
                      {yAxisSteps.slice().reverse().map(step => (
                        <span key={step} className="leading-none transform -translate-y-1/2">{step}</span>
                      ))}
                    </div>

                    {/* Chart Area */}
                    <div className="flex-1 relative border-b border-l border-slate-300">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20 z-0">
                        {yAxisSteps.slice().reverse().map((step) => (
                          <div key={step} className="border-t border-slate-400 w-full h-0"></div>
                        ))}
                      </div>

                      {/* Bars */}
                      <div className="absolute inset-0 flex items-end gap-1 px-1 z-10">
                        {monthDates.map(date => {
                          const val = parseFloat(getDia(date).precipitacao) || 0;
                          const heightPct = (val / yAxisMax) * 100;
                          const d = new Date(date + 'T12:00:00');
                          const dayNum = d.getDate();
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                          return (
                            <div key={date} className="flex-1 flex flex-col justify-end items-center h-full group relative">
                               <div 
                                 className={`w-full ${val > 0 ? 'bg-blue-400 hover:bg-blue-500 shadow-sm' : ''} rounded-t-sm transition-all relative z-10`}
                                 style={{ height: val > 0 ? `${Math.max(2, heightPct)}%` : '0%' }}
                                 title={`${dayNum}: ${val} mm`}
                               >
                                  {val > 0 && (
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-0.5 px-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 whitespace-nowrap">
                                      {val} mm
                                    </div>
                                  )}
                               </div>
                               {/* X-axis label */}
                               <div className={`absolute -bottom-5 w-full text-center text-[10px] ${isWeekend ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>
                                 {dayNum}
                               </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="text-right text-xs text-slate-500 mt-2">
              Máxima do mês: {Math.max(0, ...monthDates.map(d => parseFloat(getDia(d).precipitacao) || 0))} mm
            </div>
          </div>
        )}
      </div>
      </div>
      {monthDates.length > 0 && (
        <section className="pluviometria-report-print" aria-label="Relatório pluviométrico para impressão">
          <div className="pluv-report-title">CONTROLE PLUVIOMÉTRICO</div>
          <div className="pluv-report-metadata">
            <div className="pluv-report-meta-main">
              <div><strong>Contratante:</strong> {config.departamento || config.secretaria || '—'}</div>
              <div><strong>Contrato:</strong> {config.contrato || '—'}</div>
              <div><strong>Contratada:</strong> {config.empresaExecutora || '—'}</div>
              <div><strong>Rodovia / Trecho:</strong> {[config.rodoviaPadrao, config.trechoPadrao].filter(Boolean).join(' — ') || '—'}</div>
            </div>
            <div className="pluv-report-meta-period">
              <div><strong>Período:</strong> {monthTitle}</div>
              <div><strong>Fonte:</strong> {fontePrecipitacao || 'Registro manual'}</div>
              <div><strong>Emitido em:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          <div className="pluv-report-main">
            <div className="pluv-report-table-wrap">
              <table className="pluv-report-table">
                <thead>
                  <tr>
                    <th rowSpan={2}>Data</th>
                    <th rowSpan={2}>Dia</th>
                    <th colSpan={3}>Período</th>
                    <th rowSpan={2}>Precipitação<br/>(mm)</th>
                  </tr>
                  <tr><th>Manhã</th><th>Tarde</th><th>Noite</th></tr>
                </thead>
                <tbody>
                  {monthDates.map(date => {
                    const day = new Date(`${date}T12:00:00`);
                    const value = getDia(date);
                    return (
                      <tr key={date} className={day.getDay() === 0 || day.getDay() === 6 ? 'pluv-report-weekend' : ''}>
                        <td>{day.toLocaleDateString('pt-BR')}</td>
                        <td>{day.toLocaleDateString('pt-BR', {weekday: 'short'}).replace('.', '').toLocaleUpperCase('pt-BR')}</td>
                        {[value.manha, value.tarde, value.noite].map((period, index) => (
                          <td key={index} className={`pluv-code pluv-code-${period || 'empty'}`}>{period || '—'}</td>
                        ))}
                        <td className="pluv-rain-cell">{rainFor(date).toLocaleString('pt-BR', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="pluv-report-legend"><strong>Legenda:</strong> B — Bom · C — Chuvoso · I — Impraticável</div>
            </div>

            <aside className="pluv-report-summary">
              <h2>CONSOLIDADOS</h2>
              <div className="pluv-summary-item"><span>Precipitação total no período</span><strong>{monthlyTotal.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} mm</strong></div>
              <div className="pluv-summary-item"><span>Maior precipitação diária</span><strong>{maxDailyRain.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} mm</strong></div>
              <div className="pluv-summary-item"><span>Dias com precipitação</span><strong>{rainyDays} de {monthDates.length}</strong></div>
              <div className="pluv-summary-item"><span>Média diária no período</span><strong>{(monthlyTotal / monthDates.length).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} mm</strong></div>
              {urlPrecipitacao && <div className="pluv-summary-source">{urlPrecipitacao}</div>}
            </aside>
          </div>

          <section className="pluv-report-chart">
            <h2>Precipitação do período (mm)</h2>
            <svg viewBox="0 0 1200 210" role="img" aria-label={`Gráfico de precipitação diária em ${monthTitle}`}>
              {[0, 1, 2, 3, 4].map(step => {
                const chartMax = Math.max(5, Math.ceil(maxDailyRain / 5) * 5);
                const y = 165 - step * 36;
                const amount = chartMax * step / 4;
                return <g key={step}>
                  <line x1="50" x2="1190" y1={y} y2={y} stroke="#cbd5e1" strokeWidth="1"/>
                  <text x="42" y={y + 3} textAnchor="end" fontSize="10" fill="#475569">{amount.toLocaleString('pt-BR', {maximumFractionDigits: 1})}</text>
                </g>;
              })}
              {monthDates.map((date, index) => {
                const value = rainFor(date);
                const chartMax = Math.max(5, Math.ceil(maxDailyRain / 5) * 5);
                const step = 1140 / monthDates.length;
                const barHeight = value / chartMax * 144;
                const x = 50 + index * step + step * 0.18;
                const width = step * 0.64;
                return <g key={date}>
                  {value > 0 && <rect x={x} y={165 - barHeight} width={width} height={barHeight} fill="#1e3a5f"><title>{`${date}: ${value.toLocaleString('pt-BR')} mm`}</title></rect>}
                  {value > 0 && <text x={x + width / 2} y={160 - barHeight} textAnchor="middle" fontSize="8" fill="#334155">{value.toLocaleString('pt-BR', {maximumFractionDigits: 1})}</text>}
                  <text x={x + width / 2} y="182" textAnchor="middle" fontSize="9" fill="#475569">{new Date(`${date}T12:00:00`).getDate()}</text>
                </g>;
              })}
              <line x1="50" x2="1190" y1="165" y2="165" stroke="#64748b" strokeWidth="1"/>
              <line x1="50" x2="50" y1="20" y2="165" stroke="#64748b" strokeWidth="1"/>
            </svg>
          </section>
          <footer className="pluv-report-footer">Controle pluviométrico — {monthTitle} · {config.rodoviaPadrao || ''} {config.trechoPadrao || ''}</footer>
        </section>
      )}
    </div>
  );
}
