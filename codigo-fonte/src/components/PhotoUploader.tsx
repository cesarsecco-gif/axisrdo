import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Camera, Sparkles, Check, Trash2, ArrowRight, Loader2, RefreshCw, Layers, MapPin, Calendar, Tag, Folder, FolderPlus, Plus, ChevronDown, CheckCircle2, Edit3, Settings2, X, Maximize2 } from 'lucide-react';
import { PhotoRecord, ReportConfig, DriveFolderOption } from '../types';
import { photoDate, reportSubtitle, AUTO_SUBTITLE, serviceSuggestions } from '../services/organization';
import { readNoteCamDescription } from '../services/noteCamOcr';
import {
  recusaDeArquivo, mimeDoArquivo, bytesParaDataUrl,
  lerExif, hashDeBytes, hashDeDataUrl, miniatura, ExifFoto,
} from '../services/photoMeta';
import { CampoCatalogo } from './CampoCatalogo';
import { registrarValores, CatalogoId } from '../services/catalogos';

interface PhotoUploaderProps {
  config: ReportConfig;
  stagedPhotos: StagedPhoto[];
  setStagedPhotos: React.Dispatch<React.SetStateAction<StagedPhoto[]>>;
  onImportBusy: (busy: boolean) => void;
  onPhotosAdded: (newPhotos: PhotoRecord[]) => void;
  allPhotos: PhotoRecord[];
  onUpdateConfig?: (updated: Partial<ReportConfig>) => void;
  onDeletePhotos?: (ids: string[]) => void;
  flush?: () => Promise<unknown>;
  headers?: () => Record<string, string>;
  onAbrirCatalogo?: (c: CatalogoId) => void;
}

export interface StagedPhoto {
  id: string;
  fileName: string;
  previewUrl: string;
  /** Cópia reduzida só para desenhar a fila; a original é previewUrl. */
  thumbUrl?: string;
  /** Hash do conteúdo, para não importar a mesma foto duas vezes. */
  contentHash?: string;
  /** De onde veio a data exibida: EXIF do arquivo ou o relógio da importação. */
  fonteData?: 'exif' | 'importacao';
  data: string;
  hora: string;
  rodovia: string;
  trecho: string;
  servico: string;
  estaca: string;
  lado: string;
  categoria: string;
  latitude: string;
  longitude: string;
  elevacao: string;
  isAnalyzing: boolean;
  analyzed: boolean;
}

const COMMON_SERVICES = [
  'Lançamento de material, BGMC, BASE, PISTA, LD, EST:',
  'Lançamento de CBUQ faixa B, Est:1002, Pista 1, marginal direita',
  'Lançamento de CBUQ FAIXA C, PISTA 1 marginal, LD, EST:1009-1020',
  'Aplicação de malhas para cortina de projetado, muro C7, estaca 4537 a 4538 - LD',
  'Escavação para cortina de projetado, muro C7, estaca 4537 a 4538 - LD',
  'Concretagem do berço da tubulação, BSTC 1,0m da PV-292 a PV-293 estaca 4541',
  'Assentamento de tubos BSTC 0,60m entre a PV-298 a CCSP-324, estaca 4519+10',
  'Concretagem de sarjeta STC 10, estaca 4144 a 4149',
  'Lançamento de rachão p/ sub leito pista LE',
  'Fresagem de pista existente pista LD EST:4524',
  'Pintura de sinalização, marginal LD estaca 1013 a 1093',
  'Rompimento de estaca escavada muro C7 LE estaca 4537',
];

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  config, stagedPhotos, setStagedPhotos, onImportBusy,
  onPhotosAdded,
  allPhotos,
  onUpdateConfig,
  onDeletePhotos,
  flush,
  headers,
  onAbrirCatalogo,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; message: string }>({
    current: 0,
    total: 0,
    message: '',
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMessage, setOcrMessage] = useState('');
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; name: string } | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomPan, setZoomPan] = useState({ x: 0, y: 0 });
  const [ocrAtivo, setOcrAtivo] = useState(() => {
    try { return localStorage.getItem('der-ocr-importacao') === '1'; } catch { return false; }
  });
  const alterarOcrAtivo = (ativo: boolean) => {
    setOcrAtivo(ativo);
    try { localStorage.setItem('der-ocr-importacao', ativo ? '1' : '0'); } catch {}
  };
  const [dataGrupo, setDataGrupo] = useState('');
  const [avisoGrupo, setAvisoGrupo] = useState('');
  const [ignorados, setIgnorados] = useState<string[]>([]);
  const zoomDrag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const importingRef = useRef(false);

  useEffect(() => {
    if (!avisoGrupo) return;
    const t = setTimeout(() => setAvisoGrupo(''), 5000);
    return () => clearTimeout(t);
  }, [avisoGrupo]);

  const descriptionCatalog = useMemo(
    () => [...[...allPhotos].sort((a, b) => b.timestamp - a.timestamp).map((p) => p.servico || ''), ...COMMON_SERVICES],
    [allPhotos]
  );

  const isoToBR = (iso: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  };
  const aplicarDataGrupo = () => {
    const data = isoToBR(dataGrupo);
    if (!data) { alert('Escolha a data que será aplicada às fotos do grupo.'); return; }
    if (!stagedPhotos.length) { alert('Não há fotos na lista para receber a data.'); return; }
    setStagedPhotos((prev) => prev.map((p) => ({ ...p, data })));
    setAvisoGrupo(`Data ${data} aplicada às ${stagedPhotos.length} foto(s) do grupo.`);
  };

  const openZoom = (url: string, name: string) => {
    setZoomScale(1);
    setZoomPan({ x: 0, y: 0 });
    setZoomPhoto({ url, name });
  };
  function bumpZoom(delta: number) {
    const next = Math.min(6, Math.max(1, Math.round((zoomScale + delta) * 100) / 100));
    setZoomScale(next);
    if (next <= 1) setZoomPan({ x: 0, y: 0 });
  }
  const resetZoom = () => { setZoomScale(1); setZoomPan({ x: 0, y: 0 }); };
  const toggleZoom = () => {
    if (zoomScale > 1) resetZoom();
    else { setZoomScale(2.5); setZoomPan({ x: 0, y: 0 }); }
  };

  useEffect(() => {
    if (!zoomPhoto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomPhoto(null);
      else if (e.key === '+' || e.key === '=') bumpZoom(0.5);
      else if (e.key === '-' || e.key === '_') bumpZoom(-0.5);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomPhoto, zoomScale]);

  // Folder destination state
  const availableFolders: DriveFolderOption[] = config.availableFolders || [
    { id: 'folder-jul-2026', name: '07_JULHO_2026', period: 'JULHO/2026', isDefault: true },
    { id: 'folder-jun-2026', name: '06_JUNHO_2026', period: 'JUNHO/2026' },
    { id: 'folder-mai-2026', name: '05_MAIO_2026', period: 'MAIO/2026' },
  ];

  const [selectedFolderId, setSelectedFolderId] = useState<string>(
    config.selectedDestinationFolderId || availableFolders[0]?.id || 'folder-jul-2026'
  );

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderPeriod, setNewFolderPeriod] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Folder edit state
  const [showEditFolderModal, setShowEditFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<DriveFolderOption | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderPeriod, setEditFolderPeriod] = useState('');

  const currentFolder = availableFolders.find((f) => f.id === selectedFolderId) || availableFolders[0];

  const autoSubtitle = (period: string) =>
    config.subtitulo && !AUTO_SUBTITLE.test(config.subtitulo.trim())
      ? config.subtitulo
      : reportSubtitle(config.rodoviaPadrao, config.trechoPadrao, period);

  const handleSelectFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    if (onUpdateConfig) {
      const period = availableFolders.find(f => f.id === folderId)?.period;
      onUpdateConfig({ selectedDestinationFolderId: folderId, ...(period ? {mesAno: period, subtitulo: autoSubtitle(period)} : {}) });
    }
  };

  const handleOpenEditFolder = (folder?: DriveFolderOption) => {
    const target = folder || currentFolder;
    if (!target) return;
    setEditingFolder(target);
    setEditFolderName(target.name);
    setEditFolderPeriod(target.period || '');
    setShowEditFolderModal(true);
  };

  const handleSaveEditFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder || !editFolderName.trim()) return;

    const trimmedName = editFolderName.trim();
    const trimmedPeriod = editFolderPeriod.trim() || undefined;
    const trimmedId = editingFolder.id;

    const updatedFolders = availableFolders.map((f) => {
      if (f.id === editingFolder.id) {
        return {
          ...f,
          id: trimmedId,
          name: trimmedName,
          period: trimmedPeriod,
        };
      }
      return f;
    });

    const isCurrentActive = selectedFolderId === editingFolder.id;
    const nextSelectedId = isCurrentActive ? trimmedId : selectedFolderId;

    if (onUpdateConfig) {
      onUpdateConfig({
        availableFolders: updatedFolders,
        selectedDestinationFolderId: nextSelectedId,
        ...(isCurrentActive && trimmedPeriod ? { mesAno: trimmedPeriod, subtitulo: autoSubtitle(trimmedPeriod) } : {}),
      });
    }

    setSelectedFolderId(nextSelectedId);
    setShowEditFolderModal(false);
    setEditingFolder(null);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (availableFolders.length <= 1) {
      alert('É necessário manter pelo menos uma pasta cadastrada.');
      return;
    }
    const folder = availableFolders.find((f) => f.id === folderId);
    const label = folder?.name || 'esta pasta';
    const ids = allPhotos.filter((p) => p.folderId === folderId).map((p) => p.id);
    const message = ids.length
      ? `A pasta "${label}" contém ${ids.length} foto(s).\n\nAo confirmar:\n• a pasta sai da lista de opções;\n• os registros dessas fotos serão removidos do projeto;\n• as cópias das fotos da pasta serão apagadas do disco;\n• um backup automático é criado antes.\n\nDeseja excluir a pasta e as fotos dela?`
      : `Deseja realmente remover a pasta "${label}" da lista de opções?`;
    if (!confirm(message)) return;

    if (ids.length) {
      try {
        if (flush) await flush();
        const r = await fetch('/api/photos/delete-copies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(headers ? headers() : {}) },
          body: JSON.stringify({ ids }),
        });
        const d = await r.json().catch(() => ({} as any));
        if (!r.ok) throw new Error(d.error || `Falha ao apagar as cópias (HTTP ${r.status}).`);
        if (Array.isArray(d.failed) && d.failed.length) {
          alert(`${d.failed.length} cópia(s) não puderam ser apagadas do disco e permanecem na pasta. Elas já não têm registro no projeto.`);
        }
      } catch (err: any) {
        const keepGoing = confirm(`Não foi possível apagar as cópias em disco:\n${err.message}\n\nDeseja remover a pasta e os registros mesmo assim? As cópias órfãs permaneceriam em disco.`);
        if (!keepGoing) return;
      }
    }

    const updatedFolders = availableFolders.filter((f) => f.id !== folderId);
    const nextSelectedId = selectedFolderId === folderId ? updatedFolders[0].id : selectedFolderId;
    setSelectedFolderId(nextSelectedId);
    if (onUpdateConfig) {
      onUpdateConfig({
        availableFolders: updatedFolders,
        selectedDestinationFolderId: nextSelectedId,
      });
    }
    if (ids.length && onDeletePhotos) onDeletePhotos(ids);
    setShowEditFolderModal(false);
    setEditingFolder(null);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    let createdId = `folder-${Date.now()}`;

    try {

      const newFolder: DriveFolderOption = {
        id: createdId,
        name: newFolderName.trim(),
        period: newFolderPeriod.trim() || undefined,
      };

      const updatedFolders = [newFolder, ...availableFolders];
      if (onUpdateConfig) {
        onUpdateConfig({
          availableFolders: updatedFolders,
          selectedDestinationFolderId: createdId,
          ...(newFolder.period ? {mesAno: newFolder.period, subtitulo: autoSubtitle(newFolder.period)} : {}),
        });
      }

      setSelectedFolderId(createdId);
      setShowNewFolderModal(false);
      setNewFolderName('');
      setNewFolderPeriod('');
    } catch (err: any) {
      console.error('Erro ao criar pasta:', err);
      const newFolder: DriveFolderOption = {
        id: createdId,
        name: newFolderName.trim(),
        period: newFolderPeriod.trim() || undefined,
      };
      const updatedFolders = [newFolder, ...availableFolders];
      if (onUpdateConfig) {
        onUpdateConfig({
          availableFolders: updatedFolders,
          selectedDestinationFolderId: createdId,
        });
      }
      setSelectedFolderId(createdId);
      setShowNewFolderModal(false);
      setNewFolderName('');
      setNewFolderPeriod('');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const atualizarStaged = (id: string, patch: Partial<StagedPhoto>) => {
    setStagedPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  /** Hash do conteúdo das fotos já salvas: usado para não importar a mesma foto duas vezes. */
  const hashesJaSalvas = async (): Promise<Set<string>> => {
    const conjunto = new Set<string>();
    for (let i = 0; i < allPhotos.length; i++) {
      const p = allPhotos[i];
      let hash = p.contentHash;
      // Projeto antigo não tem contentHash guardado: o custo é uma única vez
      // por sessão (o resultado fica memoizado em photoMeta).
      if (!hash && p.imageUrl.startsWith('data:')) {
        setOcrMessage(`Verificando fotos já importadas… ${i + 1} de ${allPhotos.length}`);
        hash = await hashDeDataUrl(p.id, p.imageUrl);
      }
      if (hash) conjunto.add(hash);
    }
    return conjunto;
  };

  const handleFiles = async (files: FileList | File[]) => {
    const recebidos = Array.from(files);
    if (recebidos.length === 0) return;
    if (importingRef.current) {
      alert('A importação anterior ainda está em andamento. Aguarde a conclusão antes de selecionar novas fotos.');
      return;
    }

    // Formato e tamanho: nada é descartado em silêncio (HEIC/AVIF passavam
    // pela interface e sumiam no disco, porque photoStorage só grava 5 formatos).
    const aceitos: File[] = [];
    const recusados: string[] = [];
    for (const file of recebidos) {
      const motivo = recusaDeArquivo(file);
      if (motivo) recusados.push(`${file.name} — ${motivo}`);
      else aceitos.push(file);
    }
    setIgnorados(recusados);
    if (aceitos.length === 0) {
      alert('Nenhuma foto pôde ser importada:\n' + recusados.join('\n'));
      return;
    }

    importingRef.current = true;
    onImportBusy(true);
    setOcrBusy(true);
    const falhas: string[] = [];
    const duplicadas: string[] = [];
    const novos: { id: string; previewUrl: string }[] = [];

    try {
      setOcrMessage('Verificando fotos já importadas…');
      const jaSalvas = await hashesJaSalvas();
      const doLote = new Set<string>();

      for (let i = 0; i < aceitos.length; i++) {
        const file = aceitos[i];
        setOcrMessage(`Preparando foto ${i + 1} de ${aceitos.length}…`);
        try {
          // Uma leitura só: hash (duplicatas), EXIF (data/hora/GPS) e miniatura.
          const bytes = new Uint8Array(await file.arrayBuffer());
          const hash = await hashDeBytes(bytes);
          if (hash && (jaSalvas.has(hash) || doLote.has(hash))) {
            duplicadas.push(file.name);
            continue;
          }
          if (hash) doLote.add(hash);

          const previewUrl = bytesParaDataUrl(bytes, mimeDoArquivo(file));
          const exif: ExifFoto = lerExif(bytes);
          const thumb = await miniatura(previewUrl, exif.orientacao);
          const agora = new Date();
          const veioDoExif = !dataGrupo && !!exif.data;

          const staged: StagedPhoto = {
            id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            fileName: file.name,
            previewUrl,
            thumbUrl: thumb === previewUrl ? undefined : thumb,
            contentHash: hash || undefined,
            fonteData: veioDoExif ? 'exif' : 'importacao',
            // A data do EXIF é a data real da foto; sem EXIF, a do grupo ou a de hoje.
            data: dataGrupo ? isoToBR(dataGrupo) : exif.data || agora.toLocaleDateString('pt-BR'),
            hora: exif.hora || agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            rodovia: config.rodoviaPadrao || 'PR-317',
            trecho: config.trechoPadrao || 'Iguaraçu – Maringá',
            servico: 'Registro fotográfico dos serviços executados na pista',
            estaca: '',
            lado: 'LD',
            categoria: 'Pavimentação',
            latitude: exif.latitude || '',
            longitude: exif.longitude || '',
            elevacao: exif.elevacao || '',
            isAnalyzing: ocrAtivo,
            analyzed: false,
          };

          // Entra na fila assim que estiver pronta: o lote inteiro não precisa
          // terminar para a primeira foto aparecer.
          setStagedPhotos((prev) => [...prev, staged]);
          novos.push({ id: staged.id, previewUrl });
        } catch (err: any) {
          falhas.push(file.name + (err?.message ? ` (${err.message})` : ''));
        }
      }

      // OCR lê uma foto por vez e atualiza só ela, mantendo o progresso real.
      if (ocrAtivo && novos.length) {
        for (let i = 0; i < novos.length; i++) {
          const { id, previewUrl } = novos[i];
          const titulo = `Lendo carimbo da foto ${i + 1} de ${novos.length}`;
          setOcrMessage(`${titulo}…`);
          try {
            const ocr = await readNoteCamDescription(previewUrl, (message) =>
              setOcrMessage(message ? `${titulo} — ${message}` : `${titulo}…`),
            );
            if (ocr.description) {
              atualizarStaged(id, { servico: ocr.description.toUpperCase(), analyzed: true, isAnalyzing: false });
            } else {
              atualizarStaged(id, { isAnalyzing: false });
            }
          } catch {
            // O OCR é auxiliar: a importação segue mesmo sem ler a estampa.
            atualizarStaged(id, { isAnalyzing: false });
          }
        }
      } else {
        for (const { id } of novos) atualizarStaged(id, { isAnalyzing: false });
      }
    } finally {
      setOcrBusy(false);
      setOcrMessage('');
      importingRef.current = false;
      onImportBusy(false);
      const avisos: string[] = [];
      if (duplicadas.length) {
        avisos.push(
          `${duplicadas.length} foto(s) já estavam no projeto e foram ignoradas:\n${duplicadas.join('\n')}`,
        );
      }
      if (falhas.length) {
        avisos.push(`Não foi possível importar ${falhas.length} arquivo(s):\n${falhas.join('\n')}`);
      }
      if (avisos.length) alert(avisos.join('\n\n'));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleUpdateStaged = (id: string, field: keyof StagedPhoto, value: string) => {
    setStagedPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const handleRemoveStaged = (id: string) => {
    setStagedPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleProcessAndSave = async () => {
    if (stagedPhotos.length === 0) return;


    setIsUploading(true);
    try {
    setUploadProgress({
      current: 0,
      total: stagedPhotos.length,
      message: 'Preparando fotos locais...',
    });

    const newRecords: PhotoRecord[] = [];

    for (let i = 0; i < stagedPhotos.length; i++) {
      const staged = stagedPhotos[i];
      setUploadProgress({
        current: i + 1,
        total: stagedPhotos.length,
        message: `Enviando foto ${i + 1} de ${stagedPhotos.length} para a pasta "${currentFolder?.name || 'Geral'}"...`,
      });

      // Parse timestamp for chronological sorting. Invalid dates or times
      // must never produce NaN, which would break every chronological sort.
      let timestamp = Date.now();
      const parsedDate = photoDate(staged.data);
      const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(staged.hora || '');
      if (parsedDate) {
        const hour = timeMatch ? Number(timeMatch[1]) : 0;
        const minute = timeMatch ? Number(timeMatch[2]) : 0;
        timestamp = new Date(parsedDate.year, parsedDate.month - 1, Number(parsedDate.day), hour, minute).getTime();
      }
      if (!Number.isFinite(timestamp)) timestamp = Date.now() + i;

      const record: PhotoRecord = {
        id: staged.id,

        imageUrl: staged.previewUrl,
        thumbnailUrl: staged.thumbUrl,
        data: staged.data,
        hora: staged.hora,
        rodovia: staged.rodovia,
        trecho: staged.trecho,
        servico: staged.servico,
        estaca: staged.estaca,
        lado: staged.lado,
        categoria: staged.categoria as any,
        latitude: staged.latitude,
        longitude: staged.longitude,
        elevacao: staged.elevacao,
        driveStatus: 'pending',
        sheetsStatus: 'pending',
        aiAnalyzed: staged.analyzed,
        contentHash: staged.contentHash,
        timestamp,
        folderId: currentFolder?.id || selectedFolderId,
        folderName: currentFolder?.name || 'Geral',
        includedInReport: true,
      };

      newRecords.push(record);
    }

    if (onUpdateConfig) {
      const pares = newRecords.flatMap(r => ([
        ['rodovias', r.rodovia], ['trechos', r.trecho], ['estacas', r.estaca],
        ['lados', r.lado], ['categorias', r.categoria], ['servicos', r.servico],
      ] as [CatalogoId, unknown][]));
      onUpdateConfig({ catalogos: registrarValores(config, pares).catalogos });
    }
    onPhotosAdded(newRecords);

    } catch (e: any) { alert('Não foi possível importar as fotos: ' + e.message); } finally { setIsUploading(false); }
  };

  return (
    <div className="space-y-6">
      {/* 1. Folder Selection Card (Requested Feature 1) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                1. Selecionar Pasta de Destino das Fotos
              </h3>
              <p className="text-xs text-slate-500">
                Escolha a pasta mensal onde as fotos serão organizadas dentro da pasta de trabalho do PC.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-edit-current-folder"
              type="button"
              onClick={() => handleOpenEditFolder(currentFolder)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
              title="Editar dados da pasta selecionada"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-600" />
              <span>Editar Pasta</span>
            </button>

            <button
              id="btn-create-folder"
              type="button"
              onClick={() => setShowNewFolderModal(true)}
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Criar Nova Pasta</span>
            </button>
          </div>
        </div>

        {/* Folder Select Buttons Grid */}
        <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {availableFolders.map((f) => {
            const isSelected = selectedFolderId === f.id;
            return (
              <div
                key={f.id}
                onClick={() => handleSelectFolder(f.id)}
                className={`p-3 rounded-lg text-left border transition-all flex items-start justify-between gap-2 cursor-pointer relative group ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                    : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-emerald-900' : 'text-slate-700'}`}>
                      {f.name}
                    </span>
                  </div>
                  {f.period && (
                    <span className="text-[10px] text-slate-500 block mt-0.5 font-medium">
                      Mês: {f.period}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditFolder(f);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-200/80 rounded transition-colors"
                    title={`Editar dados da pasta "${f.name}"`}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Pasta de destino ativa: <strong className="text-slate-900 font-semibold">{currentFolder?.name}</strong>
              {currentFolder?.period && <span className="text-emerald-800 ml-1 font-medium">({currentFolder.period})</span>}
            </span>
            <button
              type="button"
              onClick={() => handleOpenEditFolder(currentFolder)}
              className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 underline underline-offset-2"
            >
              <Edit3 className="w-3 h-3" />
              <span>Editar Dados da Pasta</span>
            </button>
          </div>

        </div>
      </div>

      {/* 2. Upload Zone & Capture */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-700" />
              <span>2. Envio & Captura de Fotos no Campo</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Salvando na pasta <strong>{currentFolder?.name}</strong> com preenchimento manual dos dados.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Armazenamento local
            </span>
          </div>
        </div>

        {/* Action Buttons for Mobile / Desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Mobile Camera Direct Button */}
          <button
            id="btn-open-camera"
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-3 px-4 rounded-xl shadow-xs transition-all active:scale-98"
          >
            <Camera className="w-5 h-5" />
            <span>Tirar Foto no Canteiro de Obras</span>
          </button>

          {/* Multiple File Picker */}
          <button
            id="btn-select-files"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-4 rounded-xl shadow-xs transition-all active:scale-98"
          >
            <Upload className="w-5 h-5" />
            <span>Selecionar Fotos da Galeria / PC</span>
          </button>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.avif"
            capture="environment"
            className="hidden"
            onChange={(e) => { const files = Array.from(e.target.files || []) as File[]; e.target.value = ''; if (files.length) handleFiles(files); }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.avif"
            multiple
            className="hidden"
            onChange={(e) => { const files = Array.from(e.target.files || []) as File[]; e.target.value = ''; if (files.length) handleFiles(files); }}
          />
        </div>

        <label className="flex items-start gap-2 mb-4 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={ocrAtivo}
            onChange={(e) => alterarOcrAtivo(e.target.checked)}
          />
          <span>
            <span className="font-semibold">Ler descrição do carimbo NoteCam ao importar</span>
            <span className="block text-xs text-slate-500">
              Use somente se o carimbo trouxer a descrição do serviço no canto inferior direito. A leitura leva alguns segundos por foto; desligada, a importação é imediata.
            </span>
          </span>
        </label>

        {/* Drag and Drop Box */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-emerald-500 bg-emerald-50/50'
              : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Upload className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              Arraste e solte fotos aqui ou clique para navegar
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              Suporta fotos do aplicativo <strong>NoteCam</strong>, GPS Map Camera ou câmera padrão do smartphone, em
              <strong> JPG, PNG, WEBP, GIF ou BMP</strong>. A <strong>data, a hora e a coordenada</strong> são lidas do
              EXIF quando existe (marcadas com EXIF na fila); arquivos já importados são ignorados. Confira os dados
              antes de salvar.
            </p>
          </div>
        </div>

        {ignorados.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <strong className="font-bold">
                {ignorados.length} arquivo(s) não puderam ser importados
              </strong>
              <button
                type="button"
                onClick={() => setIgnorados([])}
                className="text-amber-800 hover:text-amber-950 font-semibold underline underline-offset-2 shrink-0"
              >
                Fechar
              </button>
            </div>
            <ul className="list-disc list-inside space-y-0.5">
              {ignorados.map((linha, i) => (
                <li key={i}>{linha}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Staged Photos Queue / Preview & Review */}
      {stagedPhotos.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Fotos Prontas para Envio ({stagedPhotos.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Destino: <strong className="text-emerald-700">{currentFolder?.name}</strong>. Revise os dados e as descrições antes de salvar.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-clear-staged"
                onClick={() => {if(confirm('Remover os rascunhos da lista? O estado anterior será preservado em backup.'))setStagedPhotos([]);}}
                className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors font-medium"
              >
                Limpar Lista
              </button>

              <button
                id="btn-submit-photos"
                disabled={isUploading || ocrBusy}
                onClick={() => handleProcessAndSave()}
                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg shadow-xs transition-all active:scale-98 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando no PC...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Salvar na Pasta e no Relatório ({stagedPhotos.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Data padrão aplicada a todo o grupo de fotos */}
          <div className="flex flex-wrap items-end gap-2 bg-sky-50 border border-sky-200 rounded-lg p-2.5">
            <label className="text-[10px] font-bold text-sky-800 uppercase">
              Data padrão do grupo
              <input
                id="input-data-grupo"
                type="date"
                value={dataGrupo}
                onChange={(e) => setDataGrupo(e.target.value)}
                className="block mt-1 px-2 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </label>
            <button
              id="btn-aplicar-data-grupo"
              type="button"
              disabled={!dataGrupo || stagedPhotos.length === 0}
              onClick={aplicarDataGrupo}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors shadow-xs disabled:opacity-50"
            >
              Aplicar às {stagedPhotos.length} foto(s)
            </button>
            <button
              type="button"
              onClick={() => setDataGrupo(new Date().toISOString().slice(0, 10))}
              className="px-3 py-1.5 text-xs font-medium text-sky-800 hover:bg-sky-100 border border-sky-300 rounded-lg transition-colors"
            >
              Hoje
            </button>
            <span className="text-[11px] text-slate-500">
              Define a data de todas as fotos do grupo (e das próximas importações enquanto estiver preenchida).
              {avisoGrupo && <strong className="block text-emerald-700">{avisoGrupo}</strong>}
            </span>
          </div>

          {/* Upload Progress Bar if active */}
          {ocrBusy && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-900">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{ocrMessage || 'Lendo automaticamente as descrições das estampas…'}</span>
            </div>
          )}

          {isUploading && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-xs font-semibold text-emerald-800">
                <span>{uploadProgress.message}</span>
                <span>{Math.round((uploadProgress.current / (uploadProgress.total || 1)) * 100)}%</span>
              </div>
              <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-700 h-2 transition-all duration-300 rounded-full"
                  style={{ width: `${(uploadProgress.current / (uploadProgress.total || 1)) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Photos Cards List */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {stagedPhotos.map((photo, index) => {
              const serviceIdeas = serviceSuggestions(photo.servico, descriptionCatalog, 3);
              return (
              <div
                key={photo.id}
                className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 hover:bg-white hover:border-slate-300 transition-all flex flex-col sm:flex-row gap-4"
              >
                {/* Photo thumbnail with NoteCam badge */}
                <div className="sm:w-72 w-full h-48 sm:h-56 rounded-lg overflow-hidden relative bg-slate-900 shrink-0 border border-slate-200">
                  <img
                    src={photo.thumbUrl || photo.previewUrl}
                    alt="Foto tirada"
                    title="Clique para ampliar"
                    onClick={() => openZoom(photo.previewUrl, photo.fileName)}
                    className="w-full h-full object-contain cursor-zoom-in"
                  />
                  <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white p-1 rounded pointer-events-none" title="Clique para ampliar">
                    <Maximize2 className="w-3.5 h-3.5" />
                  </span>
                  <button
                    onClick={() => handleRemoveStaged(photo.id)}
                    className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-rose-700 text-white p-1 rounded transition-colors"
                    title="Remover esta foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Form Fields Extracted / Editable */}
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Data
                        {photo.fonteData === 'exif' && (
                          <span
                            className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 normal-case"
                            title="Data e hora lidas do EXIF do arquivo (metadado da câmera)"
                          >
                            EXIF
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={photo.data}
                        onChange={(e) => handleUpdateStaged(photo.id, 'data', e.target.value)}
                        placeholder="DD/MM/AAAA"
                        className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Hora</label>
                      <input
                        type="text"
                        value={photo.hora}
                        onChange={(e) => handleUpdateStaged(photo.id, 'hora', e.target.value)}
                        placeholder="HH:MM"
                        className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <CampoCatalogo catalogo="lados" config={config} valor={photo.lado} rotulo="Lado" maiusculas
                      inputClassName="w-full text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500" rotuloClassName="text-[10px] font-bold text-slate-500 uppercase" onAbrirCatalogo={onAbrirCatalogo}
                      onChange={(v) => handleUpdateStaged(photo.id, 'lado', v)} />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <CampoCatalogo catalogo="rodovias" config={config} valor={photo.rodovia} rotulo="Rodovia"
                      inputClassName="w-full text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500" rotuloClassName="text-[10px] font-bold text-slate-500 uppercase" onAbrirCatalogo={onAbrirCatalogo}
                      onChange={(v) => handleUpdateStaged(photo.id, 'rodovia', v)} />
                    <CampoCatalogo catalogo="trechos" config={config} valor={photo.trecho} rotulo="Trecho"
                      inputClassName="w-full text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500" rotuloClassName="text-[10px] font-bold text-slate-500 uppercase" onAbrirCatalogo={onAbrirCatalogo}
                      onChange={(v) => handleUpdateStaged(photo.id, 'trecho', v)} />
                    <CampoCatalogo catalogo="estacas" config={config} valor={photo.estaca} rotulo="Estaca"
                      inputClassName="w-full text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500" rotuloClassName="text-[10px] font-bold text-slate-500 uppercase" onAbrirCatalogo={onAbrirCatalogo}
                      onChange={(v) => handleUpdateStaged(photo.id, 'estaca', v)} />
                    <CampoCatalogo catalogo="categorias" config={config} valor={photo.categoria} rotulo="Categoria"
                      inputClassName="w-full text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:ring-1 focus:ring-emerald-500" rotuloClassName="text-[10px] font-bold text-slate-500 uppercase" onAbrirCatalogo={onAbrirCatalogo}
                      onChange={(v) => handleUpdateStaged(photo.id, 'categoria', v)} />
                  </div>

                  <CampoCatalogo catalogo="servicos" config={config} valor={photo.servico} multiline
                    inputClassName="w-full text-xs bg-white border border-slate-200 rounded-md p-2 focus:ring-1 focus:ring-emerald-500 leading-relaxed font-medium text-slate-800"
                    rotuloClassName="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 flex-wrap"
                    placeholder="Ex: Lançamento de material, BGMC, BASE, PISTA, LD, EST:4446-4442"
                    onAbrirCatalogo={onAbrirCatalogo}
                    onChange={(v) => handleUpdateStaged(photo.id, 'servico', v)}
                    sugestoes={serviceIdeas}
                    onEscolherSugestao={(v) => handleUpdateStaged(photo.id, 'servico', v)}
                    rotulo={<>
                      <span>Descrição do Serviço (Padrão DER/PR)</span>
                      {photo.isAnalyzing && <span className="text-amber-700 flex items-center gap-1 font-normal normal-case"><Loader2 className="w-3 h-3 animate-spin" /> Lendo foto…</span>}
                      {!photo.isAnalyzing && photo.analyzed && <span className="text-emerald-700 font-normal normal-case">✓ Lido da foto</span>}
                    </>} />

                  {(photo.latitude || photo.longitude) && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-2 py-1">
                      <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
                      <span className="font-mono">
                        {photo.latitude} {photo.longitude}
                        {photo.elevacao && <> • {photo.elevacao}</>}
                      </span>
                      <span className="text-slate-400">localização lida do EXIF</span>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      id={`btn-remove-photo-${index}`}
                      type="button"
                      onClick={() => handleRemoveStaged(photo.id)}
                      className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1 font-medium px-2 py-1 rounded hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remover</span>
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Zoomed photo overlay */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Foto ampliada"
          onClick={() => setZoomPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setZoomPhoto(null)}
            className="absolute top-3 right-3 bg-white/10 hover:bg-white/25 text-white p-2 rounded-lg transition-colors z-10"
            aria-label="Fechar visualização"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={zoomPhoto.url}
            alt={zoomPhoto.name || 'Foto ampliada'}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={toggleZoom}
            onPointerDown={(e) => {
              if (zoomScale <= 1) return;
              e.preventDefault();
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              zoomDrag.current = { x: e.clientX, y: e.clientY, px: zoomPan.x, py: zoomPan.y };
            }}
            onPointerMove={(e) => {
              const d = zoomDrag.current;
              if (!d) return;
              setZoomPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
            }}
            onPointerUp={() => { zoomDrag.current = null; }}
            onPointerCancel={() => { zoomDrag.current = null; }}
            className="max-w-[96vw] max-h-[86vh] object-contain rounded shadow-2xl select-none transition-transform duration-75"
            style={{
              transform: `translate(${zoomPan.x}px, ${zoomPan.y}px) scale(${zoomScale})`,
              cursor: zoomScale > 1 ? 'grab' : 'zoom-in',
              touchAction: zoomScale > 1 ? 'none' : 'auto',
            }}
          />
          <div className="absolute bottom-3 left-3 max-w-[45vw] text-white/80 text-xs bg-black/60 px-3 py-1.5 rounded-full truncate pointer-events-none">
            {zoomPhoto.name}
          </div>
          <div
            className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/70 border border-white/15 rounded-lg p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={() => bumpZoom(-0.5)} disabled={zoomScale <= 1} className="text-white px-2.5 py-1 rounded hover:bg-white/15 disabled:opacity-40 text-sm font-bold" title="Reduzir (−)">−</button>
            <span className="text-white text-xs w-12 text-center tabular-nums">{Math.round(zoomScale * 100)}%</span>
            <button type="button" onClick={() => bumpZoom(0.5)} disabled={zoomScale >= 6} className="text-white px-2.5 py-1 rounded hover:bg-white/15 disabled:opacity-40 text-sm font-bold" title="Ampliar (+)">+</button>
            <button type="button" onClick={resetZoom} disabled={zoomScale === 1 && zoomPan.x === 0 && zoomPan.y === 0} className="text-white text-xs px-2 py-1 rounded hover:bg-white/15 disabled:opacity-40" title="Ajustar à tela">Ajustar</button>
          </div>
          <p className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/60 text-xs pointer-events-none hidden sm:block">
            Clique duas vezes para ampliar • arraste para mover • Esc fecha
          </p>
        </div>
      )}

      {/* Create New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">Criar pasta mensal</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Nome da Pasta
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Ex: 08_AGOSTO_2026 ou Drenagem_KM15"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 font-semibold focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Mês / Período do Relatório (Opcional)
                </label>
                <input
                  type="text"
                  value={newFolderPeriod}
                  onChange={(e) => setNewFolderPeriod(e.target.value)}
                  placeholder="Ex: AGOSTO/2026"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-xs text-emerald-800">
                A pasta mensal será criada dentro de fotos na pasta de trabalho escolhida no PC.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewFolderModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isCreatingFolder ? 'Criando...' : 'Criar Pasta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Folder Modal */}
      {showEditFolderModal && editingFolder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">Editar Dados da Pasta</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditFolderModal(false);
                  setEditingFolder(null);
                }}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditFolder} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Nome da Pasta / Identificação
                </label>
                <input
                  type="text"
                  value={editFolderName}
                  onChange={(e) => setEditFolderName(e.target.value)}
                  placeholder="Ex: 07_JULHO_2026 ou Drenagem_KM15"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 font-semibold focus:bg-white focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Mês / Período do Relatório
                </label>
                <input
                  type="text"
                  value={editFolderPeriod}
                  onChange={(e) => setEditFolderPeriod(e.target.value)}
                  placeholder="Ex: JULHO/2026 ou 07/2026"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-slate-900 font-medium focus:bg-white focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Esse período será exibido automaticamente no cabeçalho do relatório desta pasta.
                </span>
              </div>



              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(editingFolder.id)}
                  className="text-rose-600 hover:text-rose-800 text-xs font-semibold flex items-center gap-1 hover:bg-rose-50 px-2.5 py-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Pasta</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditFolderModal(false);
                      setEditingFolder(null);
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-xs transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
