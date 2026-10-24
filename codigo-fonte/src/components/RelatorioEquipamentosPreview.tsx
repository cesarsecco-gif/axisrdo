import React from 'react';
import { ReportConfig } from '../types';
import { Printer, X } from 'lucide-react';

export function RelatorioEquipamentosPreview({ config, monthFilter, onClose }: { config: ReportConfig, monthFilter: string, onClose: () => void }) {
  const items = config.equipamentos?.items || [];
  const efetivo = config.equipamentos?.efetivo || {};
  
  const sortedItems = [...items].sort((a, b) => a.nome.localeCompare(b.nome));

  const contractInfo = config.contrato || '141 / 2025';

  const [yearStr, monthStr] = monthFilter.split('-');
  const prevMonthDate = new Date(parseInt(yearStr), parseInt(monthStr) - 2, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const wasUsedInPrevMonth = (nome: string) => Object.keys(efetivo).some(d => d.startsWith(prevMonthStr) && (efetivo[d]?.[nome] || 0) > 0);
  const wasUsedInCurrentMonth = (nome: string) => Object.keys(efetivo).some(d => d.startsWith(monthFilter) && (efetivo[d]?.[nome] || 0) > 0);

  const allDatesInMonth = Object.keys(efetivo).filter(d => d.startsWith(monthFilter)).sort();
  const lastActiveDateInMonth = allDatesInMonth.length > 0 ? allDatesInMonth[allDatesInMonth.length - 1] : null;

  const isMobilizado = (nome: string) => {
    if (!lastActiveDateInMonth) return false;
    return (efetivo[lastActiveDateInMonth]?.[nome] || 0) > 0;
  };
  
  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 overflow-y-auto print:bg-white print:fixed print:inset-0 print:z-50 font-sans">
      <div className="min-h-screen py-8 flex flex-col items-center print:p-0 print:block">
        
        {/* Controls */}
        <div className="bg-white rounded-lg p-4 w-full max-w-[210mm] mb-8 shadow-xl flex items-center justify-between print:hidden sticky top-4 z-10 border border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Visualização de Impressão</h2>
            <p className="text-xs text-slate-500">Altere as quantidades clicando diretamente na tabela. O botão "Imprimir" gera o PDF final.</p>
          </div>
          <div className="flex gap-2">
            <button className="border border-slate-300 rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-slate-50 font-bold text-sm bg-white shadow-sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 text-slate-600"/> Imprimir PDF
            </button>
            <button className="border border-slate-300 rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-red-50 text-red-700 font-bold text-sm bg-white shadow-sm" onClick={onClose}>
              <X className="w-4 h-4"/> Fechar
            </button>
          </div>
        </div>

        {/* A4 Page Wrapper */}
        <div className="bg-white w-[210mm] min-h-[297mm] shadow-2xl print:shadow-none print:w-full print:min-h-0 print:h-auto mx-auto box-border overflow-hidden relative print:m-0 print:border-none p-[8mm]">
          
          {/* Main green borders container */}
          <div className="w-full h-full border-[6px] border-[#006400] p-1 flex flex-col">
            <div className="w-full h-full border border-[#006400] p-1 flex flex-col">

              {/* Banner Area */}
              <div className="w-full h-[22mm] border-[1.5px] border-black mb-1 p-1 flex items-center justify-center relative overflow-hidden">
                {config.headerBannerBase64 ? (
                  <img src={config.headerBannerBase64} alt="Banner" className="w-full h-full object-contain" />
                ) : null}
              </div>

              {/* Info Header Area */}
              <div className="w-full border-[1.5px] border-black mb-1 flex text-[9px] uppercase font-bold text-black font-sans leading-snug">
                <div className="w-[65%] border-r-[1.5px] border-black p-1 pr-2 grid grid-cols-[60px_1fr] gap-y-0 items-start">
                  <div>Executante:</div>
                  <div className="font-normal">{config.contrato ? 'CONSÓRCIO RODOVIA PR 317 IGUARAÇU MARINGÁ' : 'CONSÓRCIO RODOVIA PR 317 IGUARAÇU MARINGÁ'}</div>
                  
                  <div>Rodovia:</div>
                  <div className="font-normal">{config.rodoviaPadrao || 'PR-317'}</div>
                  
                  <div>Trecho:</div>
                  <div className="font-normal leading-tight">{config.trechoPadrao || 'DUPLICAÇÃO E RESTAURAÇÃO DA PISTA EXISTENTE DA RODOVIA PR-317, TRECHO IGUARAÇU–MARINGÁ'}</div>
                </div>
                <div className="w-[35%] p-1 flex flex-col justify-center">
                  <div className="flex justify-between w-full">
                    <span>Contrato:</span> 
                    <span className="font-normal">{contractInfo}</span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span>Relatório N:</span> 
                    <span className="font-normal flex-1 text-right outline-none bg-yellow-50/50 print:bg-transparent" contentEditable suppressContentEditableWarning>13</span>
                  </div>
                  <div className="flex justify-between w-full">
                    <span>Período de Referência:</span> 
                    <span className="font-normal lowercase first-letter:uppercase">{config.mesAno}</span>
                  </div>
                </div>
              </div>

              {/* Main Table */}
              <table className="w-full border-collapse border-[1.5px] border-black text-[9px] font-sans font-bold text-black mt-2">
                <thead>
                  <tr>
                    <th colSpan={2} className="border-[1.5px] border-black p-1 text-center bg-white h-[18px]">Equipamentos</th>
                    <th colSpan={4} className="border-[1.5px] border-black p-1 text-center bg-white h-[18px]">Quantidades</th>
                  </tr>
                  <tr className="bg-white text-center">
                    <th className="border-[1.5px] border-black p-1 w-[20%] font-bold align-bottom">CÓDIGO</th>
                    <th className="border-[1.5px] border-black p-1 w-[40%] font-bold align-bottom text-left pl-2">DESCRIÇÃO</th>
                    <th className="border-[1.5px] border-black p-1 w-[10%] font-normal align-middle leading-tight h-[28px]">Período<br/>Anterior</th>
                    <th className="border-[1.5px] border-black p-1 w-[10%] font-normal align-middle leading-tight h-[28px]">Período Atual</th>
                    <th className="border-[1.5px] border-black p-1 w-[10%] font-normal align-middle leading-tight h-[28px]">Mobilizado</th>
                    <th className="border-[1.5px] border-black p-1 w-[10%] font-normal align-middle leading-tight h-[28px]">Desmobilizado</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item, idx) => {
                    const mobilizado = isMobilizado(item.nome);
                    return (
                      <tr key={idx} className="h-[14px]">
                        <td className="border-[1.5px] border-black px-1 font-normal uppercase text-left">{item.placa || '-'}</td>
                        <td className="border-[1.5px] border-black px-1 font-normal uppercase text-left">{item.nome}</td>
                        <td className="border-[1.5px] border-black p-0 text-center"><input type="text" className="w-full h-full text-center outline-none hover:bg-yellow-50 bg-transparent print:bg-transparent font-normal" defaultValue={wasUsedInPrevMonth(item.nome) ? 'SIM' : ''} /></td>
                        <td className="border-[1.5px] border-black p-0 text-center"><input type="text" className="w-full h-full text-center outline-none hover:bg-yellow-50 bg-transparent print:bg-transparent font-normal" defaultValue={wasUsedInCurrentMonth(item.nome) ? 'SIM' : ''} /></td>
                        <td className="border-[1.5px] border-black p-0 text-center"><input type="text" className="w-full h-full text-center outline-none hover:bg-yellow-50 bg-transparent print:bg-transparent font-normal" defaultValue={mobilizado ? 'SIM' : ''} /></td>
                        <td className="border-[1.5px] border-black p-0 text-center"><input type="text" className="w-full h-full text-center outline-none hover:bg-yellow-50 bg-transparent print:bg-transparent font-normal" defaultValue={!mobilizado ? 'SIM' : ''} /></td>
                      </tr>
                    );
                  })}
                  {/* Empty rows to reach at least 35 rows or fill space */}
                  {Array.from({ length: Math.max(0, 35 - sortedItems.length) }).map((_, i) => (
                    <tr key={`empty-${i}`} className="h-[14px]">
                      <td className="border-[1.5px] border-black px-1"></td>
                      <td className="border-[1.5px] border-black px-1"></td>
                      <td className="border-[1.5px] border-black p-0 text-center"><input type="text" className="w-full h-full text-center outline-none bg-transparent" /></td>
                      <td className="border-[1.5px] border-black p-0 text-center"><input type="text" className="w-full h-full text-center outline-none bg-transparent" /></td>
                      <td className="border-[1.5px] border-black p-0 text-center"><input type="text" className="w-full h-full text-center outline-none bg-transparent" /></td>
                      <td className="border-[1.5px] border-black p-0 text-center"><input type="text" className="w-full h-full text-center outline-none bg-transparent" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
