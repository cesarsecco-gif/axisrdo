import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Download, Printer, ChevronLeft, ChevronRight, FileText, Layers, ZoomIn, ZoomOut, CheckCircle, Share2, Folder, Calendar, Edit3, Check, Settings2 } from 'lucide-react';
import { PhotoRecord, ReportConfig, DriveFolderOption } from '../types';
import { DERParanaLogo, ConsortiumLogos } from './DERLogos';
import { AUTO_SUBTITLE, reportSubtitle, orderPhotos } from '../services/organization';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

interface ReportViewerProps {
  photos: PhotoRecord[];
  config: ReportConfig;
  onUpdateConfig?: (updated: Partial<ReportConfig>) => void;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ photos, config, onUpdateConfig }) => {
  const [selectedReportFolder, setSelectedReportFolder] = useState<string>(
    config.selectedDestinationFolderId || 'all'
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewAllPages, setViewAllPages] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfScope,setPdfScope]=useState<'all'|'current'>('all');
  const [pdfQuality,setPdfQuality]=useState<'compact'|'standard'|'high'>('standard');
  const [pdfProgress,setPdfProgress]=useState('');
  const [pdfEstimate,setPdfEstimate]=useState(0);
  const cancelPdf=useRef(false);
  const [isEditingPeriod, setIsEditingPeriod] = useState<boolean>(false);

  // Edit period / title local state
  const [editMesAno, setEditMesAno] = useState<string>(config.mesAno || 'JULHO/2026');
  const [editRodovia, setEditRodovia] = useState<string>(config.rodoviaPadrao || 'PR-317');
  const [editTrecho, setEditTrecho] = useState<string>(config.trechoPadrao || 'Iguaraçu – Maringá');
  const [editContrato, setEditContrato] = useState<string>(config.contrato || 'Contrato nº 084/2023');
  const [editTitulo, setEditTitulo] = useState<string>(config.titulo || 'RELATÓRIO FOTOGRÁFICO');
  const [editSubtitulo, setEditSubtitulo] = useState<string>(config.subtitulo || '');

  const reportRef = useRef<HTMLDivElement>(null);

  const availableFolders: DriveFolderOption[] = config.availableFolders || [
    { id: 'folder-jul-2026', name: '07_JULHO_2026', period: 'JULHO/2026', isDefault: true },
    { id: 'folder-jun-2026', name: '06_JUNHO_2026', period: 'JUNHO/2026' },
    { id: 'folder-mai-2026', name: '05_MAIO_2026', period: 'MAIO/2026' },
  ];

  // Filter photos based on chosen report folder & inclusion, keeping the
  // manual sequence (or chronological order when the user never reordered).
  const hasManualOrder = useMemo(() => photos.some((p) => p.manualOrder !== undefined), [photos]);
  const reportPhotos = useMemo(() => {
    const ordered = orderPhotos(photos);
    return ordered.filter((p) => {
      if (p.includedInReport === false) return false;
      if (selectedReportFolder === 'all') return true;
      return (p.folderId || 'folder-jul-2026') === selectedReportFolder;
    });
  }, [photos, selectedReportFolder]);

  const photosPerPage = config.photosPerPage || 4;
  const totalPages = Math.max(1, Math.ceil(reportPhotos.length / photosPerPage));
  useEffect(()=>{setCurrentPage(p=>Math.min(p,totalPages));},[totalPages]);
  useEffect(()=>()=>{cancelPdf.current=true;},[]);

  const getPagePhotos = (pageNumber: number) => {
    const start = (pageNumber - 1) * photosPerPage;
    return reportPhotos.slice(start, start + photosPerPage);
  };

  const handleSelectReport = (folderId: string) => {
    setSelectedReportFolder(folderId);
    setCurrentPage(1);

    if (folderId !== 'all') {
      const folderObj = availableFolders.find((f) => f.id === folderId);
      if (folderObj?.period) {
        const sub = reportSubtitle(config.rodoviaPadrao, config.trechoPadrao, folderObj.period);
        setEditMesAno(folderObj.period);
        setEditSubtitulo(sub);
        if (onUpdateConfig) {
          onUpdateConfig({
            mesAno: folderObj.period,
            subtitulo: sub,
            selectedDestinationFolderId: folderId,
          });
        }
      }
    }
  };

  const handleSavePeriodConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSub = reportSubtitle(editRodovia, editTrecho, editMesAno);
    const current = editSubtitulo.trim();
    const subtitulo = !current || AUTO_SUBTITLE.test(current) ? updatedSub : current;

    if (onUpdateConfig) {
      onUpdateConfig({
        mesAno: editMesAno,
        rodoviaPadrao: editRodovia,
        trechoPadrao: editTrecho,
        contrato: editContrato,
        titulo: editTitulo,
        subtitulo,
      });
    }
    setEditSubtitulo(subtitulo);
    setIsEditingPeriod(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!reportRef.current || reportPhotos.length === 0 || isExportingPdf) return;
    const previousView = viewAllPages;
    const exportAll=pdfScope==='all';
    const expectedPages=exportAll?totalPages:1;
    const quality={compact:{scale:1.5,jpeg:0.72},standard:{scale:2,jpeg:0.88},high:{scale:3,jpeg:0.96}}[pdfQuality];
    cancelPdf.current=false;
    setPdfEstimate(0);
    setPdfProgress('Preparando páginas e fotos…');
    setIsExportingPdf(true);
    setViewAllPages(exportAll);

    try {
      // Let React mount every report page, including when previewing a single page.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await document.fonts.ready;
      const images = Array.from(reportRef.current.querySelectorAll('img')) as HTMLImageElement[];
      for (let index = 0; index < images.length; index++) {
        if(cancelPdf.current)return;
        setPdfProgress(`Conferindo foto ${index+1} de ${images.length}…`);
        try { await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Tempo de leitura esgotado')),15000);images[index].decode().then(()=>{clearTimeout(timer);resolve();},e=>{clearTimeout(timer);reject(e);});}); }
        catch { throw new Error(`A foto ${index + 1} não pôde ser carregada. Reimporte o arquivo original do PC e tente novamente.`); }
        if (!images[index].naturalWidth) throw new Error(`A foto ${index + 1} está vazia ou indisponível.`);
      }
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageElements = reportRef.current.querySelectorAll('.der-report-page');
      if (pageElements.length !== expectedPages) throw new Error('As páginas ainda não estão prontas. Aguarde e tente novamente.');

      let generatedBytes=0;
      for (let i = 0; i < pageElements.length; i++) {
        if(cancelPdf.current)return;
        setPdfProgress(`Gerando página ${i+1} de ${pageElements.length}…`);
        await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
        const el = pageElements[i] as HTMLElement;
        const canvas = await html2canvas(el, {
          scale: quality.scale,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1280,
          onclone: (doc) => {
            doc.querySelectorAll<HTMLElement>('.der-report-page').forEach(page => {
              page.style.width = '794px';
              page.style.maxWidth = 'none';
              page.style.minHeight = '1123px';
              page.style.padding = '14mm';
              page.style.boxShadow = 'none';
            });
          },
        });

        const imgData = canvas.toDataURL('image/jpeg', quality.jpeg);
        generatedBytes+=imgData.length*0.75;
        setPdfEstimate(generatedBytes/(i+1)*expectedPages);
        if (i > 0) {
          pdf.addPage('a4', 'portrait');
        }
        const ratio = Math.min(210 / canvas.width, 297 / canvas.height);
        const width = canvas.width * ratio;
        const height = canvas.height * ratio;
        pdf.addImage(imgData, 'JPEG', (210 - width) / 2, (297 - height) / 2, width, height);
        canvas.width = 0;
        canvas.height = 0;
      }

      if(cancelPdf.current)return;
      pdf.save(`Relatorio_Fotografico_DER_PR_${config.rodoviaPadrao}_${(config.mesAno || 'periodo').replace('/', '_')}${exportAll?'':`_pagina-${currentPage}`}.pdf`);
    } catch (error: any) {
      console.error('Erro na exportação de PDF:', error);
      fetch('/api/diagnostics/error',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'gerar-pdf',message:String(error?.message||'Falha na exportação').slice(0,500)})}).catch(()=>{});
      alert(`Não foi possível gerar o PDF: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setViewAllPages(previousView);
      setIsExportingPdf(false);
    }
  };

  const currentFolder = availableFolders.find((f) => f.id === selectedReportFolder);

  return (
    <div className="space-y-6">
      {isExportingPdf&&<div data-html2canvas-ignore="true" className="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center print:hidden" role="dialog" aria-modal="true" aria-label="Exportando PDF"><div className="bg-white rounded-xl p-6 space-y-4"><p role="status" className="font-semibold">{pdfProgress}</p>{pdfEstimate>0&&<p className="text-sm">Tamanho aproximado: {(pdfEstimate/1048576).toFixed(1)} MB (estimativa das páginas processadas).</p>}<button className="px-4 py-2 border rounded-lg" onClick={()=>{cancelPdf.current=true;setPdfProgress('Cancelando após a operação em andamento…');}}>Cancelar exportação</button></div></div>}
      {/* 1. Report Selector & Period Editor Bar (Requested Feature 3) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                1. Selecionar Relatório Mensal & Editar Período / Ano
              </h3>
              <p className="text-xs text-slate-500">
                Alterne entre relatórios de diferentes pastas e configure o cabeçalho oficial DER/PR.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsEditingPeriod(!isEditingPeriod)}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditingPeriod ? 'Fechar Editor' : 'Editar Período / Ano'}</span>
          </button>
        </div>

        {/* Report / Folder Switcher Buttons (Requested Feature 3) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-600 mr-1">Exibir Relatório:</span>
          
          <button
            type="button"
            onClick={() => handleSelectReport('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
              selectedReportFolder === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
            }`}
          >
            <span>Todas as Fotos Marcadas ({photos.filter(p => p.includedInReport !== false).length})</span>
          </button>

          {availableFolders.map((f) => {
            const isSelected = selectedReportFolder === f.id;
            const countInF = photos.filter((p) => (p.folderId || 'folder-jul-2026') === f.id && p.includedInReport !== false).length;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handleSelectReport(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>{f.name}</span>
                {f.period && <span className="opacity-90 font-normal">({f.period})</span>}
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-emerald-950 text-white' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {countInF}
                </span>
              </button>
            );
          })}
        </div>

        {/* Expandable Period / Year Editor Form (Requested Feature 3) */}
        {isEditingPeriod && (
          <form onSubmit={handleSavePeriodConfig} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 mt-3 animate-in fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Editar Dados do Cabeçalho & Período do Relatório</span>
              </span>
              <span className="text-[11px] text-slate-500">Reflete no PDF impresso imediatamente</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Período / Mês e Ano
                </label>
                <input
                  type="text"
                  value={editMesAno}
                  onChange={(e) => setEditMesAno(e.target.value)}
                  placeholder="Ex: JULHO/2026 ou 08/2026"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Rodovia
                </label>
                <input
                  type="text"
                  value={editRodovia}
                  onChange={(e) => setEditRodovia(e.target.value)}
                  placeholder="Ex: PR-317"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Contrato
                </label>
                <input
                  type="text"
                  value={editContrato}
                  onChange={(e) => setEditContrato(e.target.value)}
                  placeholder="Ex: Contrato nº 084/2023"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Trecho
                </label>
                <input
                  type="text"
                  value={editTrecho}
                  onChange={(e) => setEditTrecho(e.target.value)}
                  placeholder="Ex: Iguaraçu – Maringá"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-medium text-slate-900 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Título Principal do Documento
                </label>
                <input
                  type="text"
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  placeholder="Ex: RELATÓRIO FOTOGRÁFICO"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-900 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingPeriod(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-4 py-1.5 rounded-lg shadow-xs transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Aplicar no Relatório</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Top PDF / Print Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-700" />
              <span>
                {selectedReportFolder !== 'all' ? `Relatório: ${currentFolder?.name || ''}` : 'Relatório Geral'} ({config.mesAno})
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              {reportPhotos.length} fotos selecionadas • {totalPages} {totalPages === 1 ? 'página' : 'páginas'} ({photosPerPage} fotos por folha A4 {hasManualOrder ? 'na ordem definida em Gerenciar fotos' : 'em ordem cronológica'}). 
            </p>
          </div>
        </div>

        {/* Actions: Export PDF, Print, Page switch */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm">Exportar<select aria-label="Páginas do PDF" value={pdfScope} onChange={e=>setPdfScope(e.target.value as any)} className="block border rounded p-1.5"><option value="all">Relatório completo</option><option value="current">Página atual ({currentPage})</option></select></label>
          <label className="text-sm">Qualidade<select aria-label="Qualidade do PDF" value={pdfQuality} onChange={e=>setPdfQuality(e.target.value as any)} className="block border rounded p-1.5"><option value="compact">Compacta</option><option value="standard">Padrão</option><option value="high">Alta</option></select></label>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setViewAllPages(true)}
              className={`px-2.5 py-1 rounded-md transition-all ${viewAllPages ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
            >
              Todas ({totalPages} págs)
            </button>
            <button
              onClick={() => setViewAllPages(false)}
              className={`px-2.5 py-1 rounded-md transition-all ${!viewAllPages ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
            >
              Página Única
            </button>
          </div>

          {!viewAllPages && (
            <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded hover:bg-white disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-1 text-slate-700">
                Pág. {currentPage} de {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded hover:bg-white disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            id="btn-print-report"
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition-all active:scale-98"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Salvar PDF</span>
          </button>

          <button
            id="btn-download-pdf"
            disabled={isExportingPdf || reportPhotos.length === 0}
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition-all active:scale-98 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{isExportingPdf ? 'Gerando PDF...' : 'Baixar PDF'}</span>
          </button>
        </div>
      </div>

      {/* The Printable / Rendered Report Container */}
      <div ref={reportRef} className="space-y-8 flex flex-col items-center">
        {reportPhotos.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2 max-w-lg">
            <p className="text-sm font-bold text-slate-800">Nenhuma foto selecionada para este relatório</p>
            <p className="text-xs text-slate-500">
              Vá para a aba <strong>"Gerenciar Fotos"</strong> e marque as caixas de seleção das fotos que deseja incluir, ou selecione outra pasta no filtro acima.
            </p>
          </div>
        ) : (
          (viewAllPages ? Array.from({ length: totalPages }, (_, i) => i + 1) : [currentPage]).map((pageNum) => {
            const pagePhotos = getPagePhotos(pageNum);

            return (
              <div
                key={pageNum}
                className="der-report-page bg-white w-full max-w-[210mm] min-h-[297mm] shadow-lg border border-slate-300 mx-auto flex flex-col justify-between text-slate-900 box-border print:shadow-none print:border-none print:m-0 print:w-full print:max-w-none print:min-h-screen relative"
                style={{ 
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  padding: '14mm',
                }}
              >
                {/* Page Content */}
                  <>
                    <div className="flex-1 flex flex-col p-0 h-full">
                      {/* 1. Official Header / Custom Banner */}
                      {config.headerBannerBase64 ? (
                        <div className="border-b-2 border-slate-800 pb-2 mb-3 w-full flex justify-center">
                          <img src={config.headerBannerBase64} alt="Cabeçalho Personalizado" className="w-full object-contain" style={{ maxHeight: '75px' }} crossOrigin="anonymous" />
                        </div>
                      ) : (
                        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-2 mb-3 gap-2">
                          <div className="w-1/4">
                            <DERParanaLogo className="scale-90 origin-top-left" />
                          </div>

                          <div className="w-2/4 text-center leading-tight">
                            <div className="text-[10px] sm:text-[11px] font-bold text-slate-900 tracking-wide uppercase">
                              {config.orgaoPrincipal}
                            </div>
                            <div className="text-[8px] sm:text-[9px] font-bold text-slate-800 uppercase mt-0.5">
                              {config.secretaria}
                            </div>
                            <div className="text-[8px] sm:text-[9px] font-bold text-slate-800 uppercase">
                              {config.departamento}
                            </div>
                            <div className="text-[8px] sm:text-[9px] font-bold text-slate-800 uppercase mt-0.5 text-slate-900">
                              {config.superintendencia}
                            </div>
                          </div>

                          <div className="w-1/4 flex justify-end">
                            <ConsortiumLogos className="scale-90 origin-top-right" />
                          </div>
                        </div>
                      )}

                      {/* 2. Titles */}
                      <div className="text-center mb-3">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-wide uppercase">
                          {config.titulo}
                        </h3>
                        <div className="text-[11px] sm:text-xs font-bold text-slate-900 mt-1 uppercase">
                          {config.subtitulo || reportSubtitle(config.rodoviaPadrao, undefined, config.mesAno)}
                        </div>
                      </div>

                      {/* 3. The Photos Grid */}
                      <div className={`grid grid-cols-2 ${photosPerPage === 6 ? 'gap-2 sm:gap-3 grid-rows-3' : 'gap-3 sm:gap-4 grid-rows-2'} flex-1`}>
                        {pagePhotos.map((photo, pIdx) => (
                          <div
                            key={photo.id || pIdx}
                            className={`border border-slate-400 ${photosPerPage === 6 ? 'py-1 px-1' : 'p-1.5'} flex flex-col justify-between bg-white ${photosPerPage === 6 ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-[11px]'} overflow-hidden`}
                          >
                            {/* Photo Image Frame */}
                            <div className="w-full h-full min-h-0 bg-slate-100 overflow-hidden relative border border-slate-300 flex items-center justify-center">
                              <img
                                src={photo.imageUrl}
                                alt={photo.servico}
                                className="w-full h-full object-contain"
                                crossOrigin="anonymous"
                              />
                              {photo.latitude && photo.longitude && (
                                <div className="absolute bottom-1 left-1 bg-black/75 text-white text-[7px] font-mono px-1 py-0.5 leading-none">
                                  {photo.latitude}, {photo.longitude}
                                </div>
                              )}
                            </div>

                            {/* Photo Description Block (Matches DER PDF exactly) */}
                            <div className="pt-1 space-y-0.5 leading-snug shrink-0 mt-1.5">
                              <div className="font-normal text-slate-900 truncate">
                                <span className="font-normal">Data: </span>
                                <span className="font-normal">{photo.data}</span>
                                <span className="mx-1">|</span>
                                <span className="font-normal">Rodovia: </span>
                                <span>{photo.rodovia || config.rodoviaPadrao || 'PR-317'}</span>
                                <span className="mx-1">|</span>
                                <span className="font-normal">Trecho: </span>
                                <span>{photo.trecho || config.trechoPadrao || 'Iguaraçu – Maringá'}</span>
                              </div>
                              <div className="font-normal text-slate-900 text-[9.5px] sm:text-[10.5px] line-clamp-3">
                                <span className="font-normal">Serviço: </span>
                                <span>{photo.servico}</span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Empty slots placeholders if page has fewer than requested */}
                        {Array.from({ length: Math.max(0, photosPerPage - pagePhotos.length) }).map((_, emptyIdx) => (
                          <div
                            key={`empty-${emptyIdx}`}
                            className="border border-dashed border-slate-300 p-2 flex flex-col items-center justify-center text-slate-300 text-xs min-h-[150px]"
                          >
                            <span>Espaço reservado para registro fotográfico</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. Page Footer */}
                    <div className="pt-2 shrink-0 flex items-center justify-between text-[10px] sm:text-[11px] font-normal text-slate-800">
                      <div className="w-1/3"></div>
                      <div className="w-1/3 text-center font-normal">{config.contrato}</div>
                      <div className="w-1/3 text-right font-normal">{pageNum}</div>
                    </div>
                  </>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
