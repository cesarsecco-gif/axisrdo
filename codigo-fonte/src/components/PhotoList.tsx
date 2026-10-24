import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, ArrowUpDown, Calendar, Edit3, Trash2, ExternalLink, CheckCircle2, AlertCircle, Clock, Grid, List, Sparkles, FolderUp, RefreshCw, Folder, FolderInput, CheckSquare, Square, FileText, Check, Tag, GripVertical, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown } from 'lucide-react';
import { PhotoRecord, ReportConfig, DriveFolderOption } from '../types';
import { StampEditor } from './StampEditor';
import { TagsEditor } from './TagsEditor';
import {photoTags,photoDate,uniqueTags,tagKey,serviceSuggestions,orderPhotos} from '../services/organization';
import { CampoCatalogo } from './CampoCatalogo';
import { FaixaCorrecao } from './FaixaCorrecao';
import { registrarValores, CatalogoId } from '../services/catalogos';

interface PhotoListProps {
  photos: PhotoRecord[];
  config: ReportConfig;
  onUpdatePhoto: (updated: PhotoRecord) => void;
  onAddEditedPhoto: (photo: PhotoRecord) => void;
  onDeletePhoto: (id: string) => void;
  onDeletePhotos: (ids: string[]) => void;
  onUpdateConfig?: (updated: Partial<ReportConfig>) => void;
  onAbrirCatalogo?: (c: CatalogoId) => void;
  correcao?:{ids:string[];item:string};onLimparCorrecao?:()=>void;
  onMovePhotos?: (ids: string[], folderId: string) => void;
  onSetPhotoOrder?: (orderedIds: string[]) => void;
  onClearPhotoOrder?: () => void;
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

export const PhotoList: React.FC<PhotoListProps> = ({
  photos,
  config,
  onUpdatePhoto,
  onAddEditedPhoto,
  onDeletePhoto,
  onDeletePhotos,
  onUpdateConfig,
  // onAbrirCatalogo is accepted but not used here: the catalog shortcut switches tabs and
  // would throw away the photo edit in progress.
  onAbrirCatalogo,
  correcao,
  onLimparCorrecao,
  onMovePhotos,
  onSetPhotoOrder,
  onClearPhotoOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteSelection,setDeleteSelection]=useState<Set<string>>(new Set());
  const toggleDelete=(id:string)=>setDeleteSelection(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next;});
  const [dataLote,setDataLote]=useState('');
  const [avisoData,setAvisoData]=useState('');
  useEffect(()=>{if(!avisoData)return;const t=setTimeout(()=>setAvisoData(''),6000);return()=>clearTimeout(t);},[avisoData]);
  const [avisoMove,setAvisoMove]=useState('');
  useEffect(()=>{if(!avisoMove)return;const t=setTimeout(()=>setAvisoMove(''),6000);return()=>clearTimeout(t);},[avisoMove]);
  const [moveDialog,setMoveDialog]=useState<{ids:string[]}|null>(null);
  const [moveTarget,setMoveTarget]=useState('');
  const [showNewFolder,setShowNewFolder]=useState(false);
  const [newFolderName,setNewFolderName]=useState('');
  const [newFolderPeriod,setNewFolderPeriod]=useState('');
  const [stampPhoto, setStampPhoto] = useState<PhotoRecord|null>(null);
  const [tagsPhoto,setTagsPhoto]=useState<PhotoRecord|null>(null);
  const [selectedDay,setSelectedDay]=useState('all');
  const tagCatalog=useMemo(()=>uniqueTags([...(config.tagCatalog||[]),...photos.flatMap(photoTags)]).sort((a,b)=>a.localeCompare(b,'pt-BR')),[config.tagCatalog,photos]);
  const descriptionCatalog=useMemo(()=>[...[...photos].sort((a,b)=>b.timestamp-a.timestamp).map(p=>p.servico||''),...COMMON_SERVICES],[photos]);
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>(
    config.selectedDestinationFolderId || 'all'
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterInclusion, setFilterInclusion] = useState<'all' | 'included' | 'excluded'>('all');
  useEffect(()=>{setDeleteSelection(new Set());},[searchTerm,selectedFolderFilter,selectedCategory,filterInclusion,selectedDay,correcao]);
  // "Corrigir agora" must show every affected record, so the other filters step aside.
  useEffect(()=>{if(correcao){setSelectedFolderFilter('all');setSelectedCategory('all');setFilterInclusion('all');setSearchTerm('');setSelectedDay('all');setReorderMode(false);}},[correcao]);
  useEffect(()=>{setSelectedDay('all');},[selectedFolderFilter]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [reorderMode, setReorderMode] = useState(false);
  const hasManualOrder = photos.some((p) => p.manualOrder !== undefined);
  const hasActiveFilters = selectedFolderFilter !== 'all' || filterInclusion !== 'all' || !!searchTerm.trim() || selectedCategory !== 'all' || selectedDay !== 'all';
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PhotoRecord>>({});
  const serviceIdeas=useMemo(()=>serviceSuggestions(editForm.servico||'',descriptionCatalog,3),[editForm.servico,descriptionCatalog]);

  const availableFolders: DriveFolderOption[] = config.availableFolders || [
    { id: 'folder-jul-2026', name: '07_JULHO_2026', period: 'JULHO/2026', isDefault: true },
    { id: 'folder-jun-2026', name: '06_JUNHO_2026', period: 'JUNHO/2026' },
    { id: 'folder-mai-2026', name: '05_MAIO_2026', period: 'MAIO/2026' },
  ];

  // Effective sequence: manual order when the user reordered, else chronological.
  const orderedPhotos = useMemo(() => orderPhotos(photos), [photos]);

  // Filter and sequence photos (order first, then filter)
  const filteredAndSortedPhotos = useMemo(() => {
    let list = [...orderedPhotos];

    // "Corrigir agora" narrows the list to the records that use a catalog item.
    if (correcao) {
      const alvos = new Set(correcao.ids);
      list = list.filter((p) => alvos.has(p.id));
    }

    // Folder Filter
    if (selectedFolderFilter !== 'all') {
      list = list.filter((p) => (p.folderId || 'folder-jul-2026') === selectedFolderFilter);
    }

    // Inclusion Filter
    if (filterInclusion === 'included') {
      list = list.filter((p) => p.includedInReport !== false);
    } else if (filterInclusion === 'excluded') {
      list = list.filter((p) => p.includedInReport === false);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (p) =>
          (p.servico || '').toLowerCase().includes(term) ||
          (p.data || '').includes(term) ||
          (p.rodovia || '').toLowerCase().includes(term) ||
          (p.trecho || '').toLowerCase().includes(term) ||
          ((p.estaca || '') && p.estaca.toLowerCase().includes(term))
      );
    }

    if(selectedCategory==='none')list=list.filter(p=>photoTags(p).length===0);
    else if(selectedCategory!=='all')list=list.filter(p=>photoTags(p).some(t=>tagKey(t)===selectedCategory.slice(4)));
    if(selectedDay!=='all')list=list.filter(p=>(photoDate(p.data)?.key||'sem-data')===selectedDay);

    if (sortOrder === 'desc' && !reorderMode) list.reverse();

    return list;
  }, [orderedPhotos, photos, selectedFolderFilter, filterInclusion, searchTerm, selectedCategory, sortOrder,selectedDay,reorderMode,correcao]);
  const dayFolders=useMemo(()=>{
    const counts=new Map<string,{label:string;count:number}>();
    photos.filter(p=>selectedFolderFilter==='all'||(p.folderId||'folder-jul-2026')===selectedFolderFilter).forEach(p=>{const date=photoDate(p.data),key=date?.key||'sem-data';const old=counts.get(key);counts.set(key,{label:date?`${date.day} • ${p.data}`:'Sem data válida',count:(old?.count||0)+1});});
    return [...counts.entries()].sort(([a],[b])=>a.localeCompare(b));
  },[photos,selectedFolderFilter]);

  const handleStartEdit = (photo: PhotoRecord) => {
    setViewMode('grid');
    setEditingId(photo.id);
    setEditForm({
      data: photo.data,
      hora: photo.hora,
      rodovia: photo.rodovia,
      trecho: photo.trecho,
      servico: photo.servico,
      estaca: photo.estaca,
      lado: photo.lado,
      categoria: photo.categoria,
      folderId: photo.folderId,
      includedInReport: photo.includedInReport !== false,
    });
  };

  const handleSaveEdit = (id: string) => {
    const original = photos.find((p) => p.id === id);
    if (!original) return;

    const parsed=photoDate(editForm.data||'');
    if(!parsed){alert('Informe uma data válida no formato DD/MM/AAAA.');return;}
    const time=editForm.hora||'00:00';
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)){alert('Informe uma hora válida no formato HH:MM.');return;}
    const [hour,min]=time.split(':').map(Number);
    const timestamp=new Date(parsed.year,parsed.month-1,Number(parsed.day),hour,min).getTime();

    const folderId = editForm.folderId || undefined;
    const updated: PhotoRecord = {
      ...original,
      ...editForm,
      folderId,
      timestamp,
    };
    if (folderId) {
      if (folderId !== original.folderId) updated.folderName = availableFolders.find((f) => f.id === folderId)?.name || original.folderName;
    } else {
      updated.folderName = undefined;
    }

    onUpdatePhoto(updated);
    onUpdateConfig?.({ catalogos: registrarValores(config, [
      ['rodovias', updated.rodovia], ['trechos', updated.trecho], ['estacas', updated.estaca],
      ['lados', updated.lado], ['categorias', updated.categoria], ['servicos', updated.servico],
    ] as [CatalogoId, unknown][]).catalogos });
    setEditingId(null);
    setEditForm({});
  };

  const handleToggleInclude = (photo: PhotoRecord) => {
    const currentStatus = photo.includedInReport !== false;
    onUpdatePhoto({
      ...photo,
      includedInReport: !currentStatus,
    });
  };

  const handleBulkSetInclusion = (include: boolean) => {
    filteredAndSortedPhotos.forEach((photo) => {
      if ((photo.includedInReport !== false) !== include) {
        onUpdatePhoto({
          ...photo,
          includedInReport: include,
        });
      }
    });
  };

  const aplicarDataSelecionadas = () => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataLote || '');
    const data = m ? `${m[3]}/${m[2]}/${m[1]}` : '';
    const parsed = photoDate(data);
    if (!parsed) { alert('Escolha a nova data no formato DD/MM/AAAA.'); return; }
    const alvos = filteredAndSortedPhotos.filter((p) => deleteSelection.has(p.id));
    if (!alvos.length) { alert('Selecione as fotos que devem receber a nova data.'); return; }
    if (!confirm(`Aplicar a data ${data} em ${alvos.length} foto(s) selecionada(s)? As cópias serão remanejadas para a subpasta do novo dia ao salvar.`)) return;
    alvos.forEach((photo) => {
      const [hour, min] = (photo.hora || '00:00').split(':').map(Number);
      const timestamp = new Date(parsed.year, parsed.month - 1, Number(parsed.day), hour || 0, min || 0).getTime();
      onUpdatePhoto({ ...photo, data, timestamp });
    });
    setDeleteSelection(new Set());
    setAvisoData(`Data ${data} aplicada a ${alvos.length} foto(s).`);
  };

  const openMoveDialog = (ids: string[]) => {
    const list = [...new Set(ids)];
    if (!list.length) { alert('Selecione ao menos uma foto para mover.'); return; }
    const sources = new Set(list.map(id => photos.find(p => p.id === id)?.folderId || 'folder-jul-2026'));
    const candidate = availableFolders.find(f => !sources.has(f.id)) || availableFolders[0];
    setMoveTarget(candidate?.id || '');
    setShowNewFolder(false);
    setNewFolderName('');
    setNewFolderPeriod('');
    setMoveDialog({ ids: list });
  };

  const confirmMove = () => {
    if (!onMovePhotos) return;
    const target = availableFolders.find(f => f.id === moveTarget);
    if (!target) { alert('Escolha a pasta de destino.'); return; }
    const ids = (moveDialog?.ids || []).filter(id => {
      const p = photos.find(x => x.id === id);
      return p && (p.folderId || 'folder-jul-2026') !== target.id;
    });
    if (!ids.length) { alert(`As ${moveDialog?.ids.length || 0} foto(s) já estão na pasta "${target.name}".`); return; }
    const alreadyIn = (moveDialog?.ids || []).length - ids.length;
    const msg = `Mover ${ids.length} foto(s) para "${target.name}"?` +
      (alreadyIn ? `\n\n${alreadyIn} foto(s) já estavam nesta pasta e serão mantidas.` : '') +
      '\n\nAs cópias gravadas na pasta "fotos" serão realocadas na próxima gravação automática e os RDOs/relatórios da pasta de destino passarão a considerar estas fotos.';
    if (!confirm(msg)) return;
    onMovePhotos(ids, target.id);
    setDeleteSelection(new Set());
    setMoveDialog(null);
    setAvisoMove(`${ids.length} foto(s) movida(s) para "${target.name}".`);
  };

  const createTargetFolder = () => {
    const name = newFolderName.trim();
    if (!name) { alert('Informe o nome da nova pasta.'); return; }
    if (availableFolders.some(f => f.name.trim().toLowerCase() === name.toLowerCase())) { alert('Já existe uma pasta com este nome.'); return; }
    const created = { id: `folder-${Date.now()}`, name, period: newFolderPeriod.trim() || undefined };
    onUpdateConfig?.({ availableFolders: [created, ...availableFolders] });
    setMoveTarget(created.id);
    setNewFolderName('');
    setNewFolderPeriod('');
    setShowNewFolder(false);
  };

  const movePhotoSequence = (photo: PhotoRecord, target: 'up' | 'down' | 'top' | 'bottom') => {
    if (!onSetPhotoOrder) return;
    const visible = filteredAndSortedPhotos.map((p) => p.id);
    const from = visible.indexOf(photo.id);
    if (from < 0) return;
    let to = from;
    if (target === 'up') to = from - 1;
    else if (target === 'down') to = from + 1;
    else if (target === 'top') to = 0;
    else to = visible.length - 1;
    if (to === from || to < 0 || to >= visible.length) return;
    const reordered = [...visible];
    reordered.splice(to, 0, reordered.splice(from, 1)[0]);
    const global = orderedPhotos.map((p) => p.id);
    const visibleSet = new Set(visible);
    const slots = global.map((id, index) => (visibleSet.has(id) ? index : -1)).filter((index) => index >= 0);
    const next = [...global];
    slots.forEach((slot, index) => { next[slot] = reordered[index]; });
    onSetPhotoOrder(next);
  };

  const restoreChronologicalOrder = () => {
    if (!onClearPhotoOrder) return;
    if (!confirm('Restaurar a ordem cronológica?\n\nAs fotos voltam a aparecer por data e hora e a ordem manual será descartada.')) return;
    onClearPhotoOrder();
    setAvisoMove('Ordem cronológica restaurada.');
  };

  const includedCount = photos.filter((p) => p.includedInReport !== false).length;  const photosPerPage = config.photosPerPage || 4;  const totalPages = Math.ceil(includedCount / photosPerPage) || 1;
  const syncedDriveCount = photos.filter((p) => p.imageUrl.startsWith('data:')).length;

  return (
    <div className="space-y-5">
      {correcao && <FaixaCorrecao quantidade={filteredAndSortedPhotos.length} item={correcao.item} onLimpar={() => onLimparCorrecao?.()} />}
      <div className="flex flex-wrap gap-3 items-center bg-slate-50 border border-slate-200 rounded-xl p-3">
        <strong className="text-slate-800">Seleção em lote</strong>
        <span className="text-xs font-semibold text-slate-700">{filteredAndSortedPhotos.filter(p=>deleteSelection.has(p.id)).length} selecionadas</span>
        <button className="border border-slate-300 bg-white rounded px-3 py-2 text-xs font-semibold" onClick={()=>setDeleteSelection(new Set(filteredAndSortedPhotos.map(p=>p.id)))}>Selecionar todas as exibidas</button>
        <button className="border border-slate-300 bg-white rounded px-3 py-2 text-xs font-semibold" onClick={()=>setDeleteSelection(new Set())}>Limpar seleção</button>
        <span className="flex flex-wrap items-center gap-1.5 border-l border-slate-300 pl-3">
          <label htmlFor="input-data-lote" className="text-xs font-bold text-sky-800">Nova data</label>
          <input
            id="input-data-lote"
            type="date"
            value={dataLote}
            onChange={(e)=>setDataLote(e.target.value)}
            className="px-2 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
          <button
            id="btn-aplicar-data-lote"
            className="bg-sky-700 hover:bg-sky-800 text-white rounded px-3 py-2 text-xs font-semibold disabled:opacity-40"
            disabled={!dataLote||!filteredAndSortedPhotos.some(p=>deleteSelection.has(p.id))}
            onClick={aplicarDataSelecionadas}
          >
            Aplicar data às selecionadas
          </button>
          {avisoData&&<span className="text-xs font-semibold text-emerald-700">{avisoData}</span>}
        </span>
        <span className="flex flex-wrap items-center gap-1.5 border-l border-slate-300 pl-3">
          <button className="bg-rose-700 hover:bg-rose-800 text-white rounded px-3 py-2 text-xs font-semibold disabled:opacity-40" disabled={!filteredAndSortedPhotos.some(p=>deleteSelection.has(p.id))} onClick={()=>{const ids=filteredAndSortedPhotos.filter(p=>deleteSelection.has(p.id)).map(p=>p.id);if(confirm(`Excluir ${ids.length} foto(s) selecionada(s) do projeto e do relatório? As cópias já gravadas na pasta fotos permanecerão no PC.`)){onDeletePhotos(ids);setDeleteSelection(new Set());}}}>Excluir selecionadas</button>
        </span>
        <span className="flex flex-wrap items-center gap-1.5 border-l border-slate-300 pl-3">
          <button className="bg-indigo-700 hover:bg-indigo-800 text-white rounded px-3 py-2 text-xs font-semibold disabled:opacity-40 flex items-center gap-1" disabled={!filteredAndSortedPhotos.some(p=>deleteSelection.has(p.id))} onClick={()=>openMoveDialog(filteredAndSortedPhotos.filter(p=>deleteSelection.has(p.id)).map(p=>p.id))}><FolderInput className="w-3.5 h-3.5" /> Mover selecionadas</button>
          <button className="border border-slate-300 bg-white rounded px-3 py-2 text-xs font-semibold disabled:opacity-40" disabled={!filteredAndSortedPhotos.length} onClick={()=>openMoveDialog(filteredAndSortedPhotos.map(p=>p.id))}>Mover todas as exibidas</button>
          {avisoMove&&<span className="text-xs font-semibold text-indigo-700">{avisoMove}</span>}
        </span>
        <span className="w-full text-[11px] text-slate-500">Dica: filtre pelo dia na seção “Subpastas por dia da foto”, clique em “Selecionar todas as exibidas” e aplique a nova data.</span>
      </div>
      {stampPhoto&&<StampEditor photo={stampPhoto} onClose={()=>setStampPhoto(null)} onSave={onAddEditedPhoto}/>}
      {tagsPhoto&&<TagsEditor photo={tagsPhoto} catalog={tagCatalog} onClose={()=>setTagsPhoto(null)} onSave={tags=>{const current=photos.find(p=>p.id===tagsPhoto.id);if(current){onUpdateConfig?.({tagCatalog:uniqueTags([...tagCatalog,...tags])});onUpdatePhoto({...current,tags});}setTagsPhoto(null);}}/>}
      {moveDialog&&(
        <div className="fixed inset-0 z-50 bg-black/60 p-4 overflow-auto" role="dialog" aria-modal="true" aria-label="Mover fotos para outra pasta">
          <div className="bg-white max-w-md mx-auto rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <FolderInput className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">Mover fotos de pasta</h2>
                <p className="text-xs text-slate-500">{moveDialog.ids.length} foto(s) selecionada(s)</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="select-pasta-destino" className="text-sm font-bold text-slate-800">Pasta de destino</label>
              <select
                id="select-pasta-destino"
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Escolher pasta…</option>
                {availableFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({photos.filter((p) => (p.folderId || 'folder-jul-2026') === f.id).length} fotos)
                  </option>
                ))}
              </select>
            </div>

            {!showNewFolder ? (
              <button
                type="button"
                onClick={() => setShowNewFolder(true)}
                className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
              >
                + Criar nova pasta de destino
              </button>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="nova-pasta-nome" className="text-[10px] font-bold text-slate-500 uppercase">Nome da pasta</label>
                    <input
                      id="nova-pasta-nome"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Ex: 10_OUTUBRO_2026"
                      className="w-full text-xs bg-white border border-slate-300 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <label htmlFor="nova-pasta-periodo" className="text-[10px] font-bold text-slate-500 uppercase">Período</label>
                    <input
                      id="nova-pasta-periodo"
                      value={newFolderPeriod}
                      onChange={(e) => setNewFolderPeriod(e.target.value)}
                      placeholder="Ex: OUTUBRO/2026"
                      className="w-full text-xs bg-white border border-slate-300 rounded p-1.5"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setShowNewFolder(false)} className="text-xs px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 rounded">Cancelar</button>
                  <button type="button" onClick={createTargetFolder} className="text-xs px-3 py-1.5 bg-indigo-700 text-white rounded font-bold hover:bg-indigo-800">Criar e selecionar</button>
                </div>
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              As cópias gravadas na pasta <strong>fotos</strong> serão realocadas para a subpasta da nova pasta na próxima gravação automática. Os RDOs e o relatório da pasta de destino passarão a considerar estas fotos.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMoveDialog(null)}
                className="text-sm px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmMove}
                disabled={!moveTarget || !onMovePhotos}
                className="text-sm px-4 py-2 bg-indigo-700 text-white rounded-lg font-bold hover:bg-indigo-800 disabled:opacity-40 flex items-center gap-1.5"
              >
                <FolderInput className="w-4 h-4" />
                <span>Mover fotos</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 1. Folder Selector for Report (Requested Feature 2) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                1. Escolher Pasta das Fotos que Comporão o Relatório
              </h3>
              <p className="text-xs text-slate-500">
                Filtre e selecione as fotos da pasta de medição do mês desejado.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              {includedCount} de {photos.length} fotos marcadas
            </span>
            {selectedFolderFilter !== 'all' && (
              <button
                type="button"
                onClick={() => openMoveDialog(photos.filter((p) => (p.folderId || 'folder-jul-2026') === selectedFolderFilter).map((p) => p.id))}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-full px-2.5 py-1 transition-colors"
                title="Realocar todas as fotos desta pasta para outra pasta"
              >
                <FolderInput className="w-3.5 h-3.5" />
                <span>Mover toda a pasta</span>
              </button>
            )}
          </div>
        </div>

        {/* Folder filter buttons */}
        <div className="pt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedFolderFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              selectedFolderFilter === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white'
            }`}
          >
            <span>Todas as Pastas ({photos.length})</span>
          </button>

          {availableFolders.map((f) => {
            const countInFolder = photos.filter((p) => (p.folderId || 'folder-jul-2026') === f.id).length;
            const isSelected = selectedFolderFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedFolderFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                    : 'bg-emerald-50/50 text-emerald-900 border-emerald-200 hover:bg-emerald-100/70'
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span>{f.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-emerald-900 text-white' : 'bg-emerald-200/80 text-emerald-900'
                }`}>
                  {countInFolder}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Fotos Marcadas p/ Relatório</span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-800 mt-1">
            {includedCount} <span className="text-xs font-normal text-slate-400">/ {photos.length}</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">Prontas para emissão</span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Páginas DER/PR</span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{totalPages}</div>
          <span className="text-[11px] text-slate-500">{photosPerPage} fotos por página</span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Fotos locais</span>
          <div className="text-xl sm:text-2xl font-bold text-sky-700 mt-1">
            {syncedDriveCount} / {photos.length}
          </div>
          <span className="text-[11px] text-sky-600">Fotos armazenadas</span>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Contrato & Período</span>
          <div className="text-xs sm:text-sm font-bold text-slate-900 mt-1 truncate">{config.contrato}</div>
          <span className="text-[11px] text-slate-500 truncate">{config.mesAno}</span>
        </div>
      </div>

      {/* Control bar: Search, Filter, Bulk Checkbox actions, Sort, Mode */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por serviço, estaca (ex: 4537), CBUQ, concreto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-emerald-500 focus:bg-white"
            />
          </div>

          {/* Bulk Selection Buttons (Requested Feature 2) */}
          <div className="flex items-center gap-1.5">
            <button
              id="btn-select-all-photos"
              type="button"
              onClick={() => handleBulkSetInclusion(true)}
              className="flex items-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg px-2.5 py-2 font-semibold transition-colors"
              title="Marcar todas as fotos visíveis para o relatório"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Marcar Todas</span>
            </button>

            <button
              id="btn-deselect-all-photos"
              type="button"
              onClick={() => handleBulkSetInclusion(false)}
              className="flex items-center gap-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg px-2.5 py-2 font-semibold transition-colors"
              title="Desmarcar todas as fotos visíveis"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Desmarcar</span>
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Inclusion Status Filter */}
            <select
              value={filterInclusion}
              onChange={(e) => setFilterInclusion(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Todas as Fotos</option>
              <option value="included">Apenas Marcadas p/ Relatório</option>
              <option value="excluded">Apenas Não Marcadas</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              aria-label="Filtrar por tag"
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Todas as tags</option>
              <option value="none">Sem tags</option>
              {tagCatalog.map(tag=><option key={tagKey(tag)} value={'tag:'+tagKey(tag)}>{tag}</option>)}
            </select>

            {/* Sort Chronological */}
            <button
              id="btn-toggle-sort"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              disabled={reorderMode}
              className="flex items-center gap-1 text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-2 text-slate-700 font-medium transition-colors disabled:opacity-40 disabled:hover:bg-slate-50"
              title={reorderMode ? 'Inative durante a ordenação manual' : hasManualOrder ? 'Inverter a sequência exibida' : 'Ordem Cronológica'}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {hasManualOrder
                  ? (sortOrder === 'asc' ? 'Ordem definida (início ➔ fim)' : 'Ordem definida invertida')
                  : (sortOrder === 'asc' ? 'Cronológico (Antigas ➔ Recentes)' : 'Recentes ➔ Antigas')}
              </span>
            </button>

            {/* Manual reorder mode */}
            <button
              id="btn-toggle-reorder"
              onClick={() => { const next=!reorderMode; if(next) setSortOrder('asc'); setReorderMode(next); }}
              className={`flex items-center gap-1 text-xs border rounded-lg px-2.5 py-2 font-semibold transition-colors ${
                reorderMode
                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="Reordenar as fotos manualmente (sequência do relatório)"
            >
              <GripVertical className="w-3.5 h-3.5" />
              <span>{reorderMode ? 'Concluir ordenação' : 'Reordenar fotos'}</span>
            </button>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
                title="Grade de Fotos"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md ${viewMode === 'table' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'}`}
                title="Tabela de Dados"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Manual reorder status / instructions */}
      {reorderMode && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3" role="status">
          <p className="text-xs font-semibold text-amber-900">
            Modo de ordenação ativo: use as setas em cada foto para definir a sequência em que elas aparecem nas páginas do relatório fotográfico.
            A nova ordem é gravada automaticamente e vale para o relatório, o RDO e as exportações.
            {hasActiveFilters && ' Com filtros ativos, as setas reordenam apenas as fotos exibidas; as demais mantêm as posições atuais.'}
          </p>
          <button
            type="button"
            onClick={() => setReorderMode(false)}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg px-3 py-2 shrink-0"
          >
            Concluir
          </button>
        </div>
      )}
      {!reorderMode && hasManualOrder && (
        <div className="bg-white border border-indigo-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <p className="text-xs font-semibold text-indigo-900">
            Ordem manual ativa: as fotos aparecem na sequência definida por você (e não mais somente por data e hora).
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReorderMode(true)}
              className="border border-slate-300 bg-white hover:bg-slate-50 rounded-lg px-3 py-2 text-xs font-semibold flex items-center gap-1"
            >
              <GripVertical className="w-3.5 h-3.5" />
              <span>Continuar ordenando</span>
            </button>
            <button
              type="button"
              onClick={restoreChronologicalOrder}
              className="border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg px-3 py-2 text-xs font-semibold"
            >
              Restaurar ordem cronológica
            </button>
          </div>
        </div>
      )}

      {/* Photo List Content */}
      <div className="bg-white border rounded-xl p-4 space-y-3"><h3 className="font-bold">Subpastas por dia da foto</h3><p className="text-xs text-slate-600">A data do cadastro define a subpasta. Alterar a data remaneja a cópia local após salvar, mantendo a pasta principal escolhida.</p><div className="flex flex-wrap gap-2"><button className={`border rounded p-2 ${selectedDay==='all'?'bg-emerald-100':''}`} onClick={()=>setSelectedDay('all')}>Todos os dias</button>{dayFolders.map(([key,day])=><button key={key} className={`border rounded p-2 ${selectedDay===key?'bg-emerald-100':''}`} onClick={()=>setSelectedDay(key)}>📁 {day.label} ({day.count})</button>)}</div></div>
      {filteredAndSortedPhotos.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Nenhuma foto encontrada</h3>
          <p className="text-xs text-slate-500">Tente ajustar os filtros de busca ou selecione outra pasta no seletor acima.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAndSortedPhotos.map((photo, index) => {
            const isIncluded = photo.includedInReport !== false;
            const isEditing = editingId === photo.id;

            return (
              <div
                key={photo.id}
                className={`bg-white rounded-xl border transition-all flex flex-col overflow-hidden shadow-xs ${
                  isIncluded
                    ? 'border-emerald-300 ring-1 ring-emerald-500/20'
                    : 'border-slate-200 opacity-75 hover:opacity-100'
                }`}
              >
                {/* Photo Header with Inclusion Checkbox (Requested Feature 2) */}
                <div className={`p-3 border-b flex items-center justify-between transition-colors ${
                  isIncluded ? 'bg-emerald-50/60 border-emerald-100' : 'bg-slate-50 border-slate-100'
                }`}>
                  {/* Mark/Unmark Checkbox */}
                  <label className="text-sky-700 text-xs flex items-center gap-1 cursor-pointer select-none"><input type="checkbox" aria-label={`Selecionar foto ${index+1} para ação em lote`} checked={deleteSelection.has(photo.id)} onChange={()=>toggleDelete(photo.id)}/> Selecionar</label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isIncluded}
                      onChange={() => handleToggleInclude(photo)}
                      className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className={`text-xs font-bold ${isIncluded ? 'text-emerald-900' : 'text-slate-500'}`}>
                      {isIncluded ? 'No Relatório Oficial' : 'Oculta do Relatório'}
                    </span>
                  </label>

                  <div className="flex items-center gap-1">
                    {reorderMode&&(
                      <span className="flex items-center gap-0.5 pr-1 mr-1 border-r border-amber-300">
                        <button type="button" onClick={()=>movePhotoSequence(photo,'up')} disabled={index===0} className="p-1 text-amber-800 hover:bg-amber-100 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Subir uma posição"><ArrowUp className="w-4 h-4" /></button>
                        <button type="button" onClick={()=>movePhotoSequence(photo,'down')} disabled={index>=filteredAndSortedPhotos.length-1} className="p-1 text-amber-800 hover:bg-amber-100 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Descer uma posição"><ArrowDown className="w-4 h-4" /></button>
                        <button type="button" onClick={()=>movePhotoSequence(photo,'top')} disabled={index===0} className="p-1 text-amber-800 hover:bg-amber-100 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Levar para o início da lista"><ChevronsUp className="w-4 h-4" /></button>
                        <button type="button" onClick={()=>movePhotoSequence(photo,'bottom')} disabled={index>=filteredAndSortedPhotos.length-1} className="p-1 text-amber-800 hover:bg-amber-100 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="Levar para o fim da lista"><ChevronsDown className="w-4 h-4" /></button>
                      </span>
                    )}
                    <span className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                      #{index + 1}
                    </span>

                    <span className="text-xs text-emerald-800">{photo.imageUrl.startsWith('data:') ? 'Local' : 'Reimportar imagem'}</span>
                    {photo.stampEdit&&<span className="text-xs text-amber-800">Cópia editada</span>}

                    <button
                      id={`btn-edit-photo-${index}`}
                      onClick={() => (isEditing ? handleSaveEdit(photo.id) : handleStartEdit(photo))}
                      className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-md transition-colors"
                      title={isEditing ? 'Salvar Alterações' : 'Editar Descrição'}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button className="p-1 text-xs text-emerald-800" onClick={()=>setStampPhoto(photo)}>Editar estampa</button>

                    <button
                      onClick={() => openMoveDialog([photo.id])}
                      className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                      title="Mover foto para outra pasta"
                    >
                      <FolderInput className="w-3.5 h-3.5" />
                    </button>

                    <button
                      id={`btn-delete-photo-${index}`}
                      onClick={() => onDeletePhoto(photo.id)}
                      className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                      title="Excluir Foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Photo Image with NoteCam overlay */}
                <div className="relative aspect-4/3 bg-slate-900 group">
                  <img
                    src={photo.thumbnailUrl || photo.imageUrl}
                    alt={photo.servico}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {photo.latitude && photo.longitude && (
                    <div className="absolute bottom-1.5 left-1.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-mono px-2 py-1 rounded-xs space-y-0.5 border border-white/10">
                      <div>Lat: {photo.latitude} Long: {photo.longitude}</div>
                      <div>Elev: {photo.elevacao || '492m'} • {photo.data} {photo.hora || ''}</div>
                    </div>
                  )}
                </div>

                {/* Photo Data (DER/PR format & Edit Description) */}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Data</label>
                          <input
                            type="text"
                            value={editForm.data || ''}
                            onChange={(e) => setEditForm({ ...editForm, data: e.target.value })}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Hora</label>
                          <input
                            type="text"
                            value={editForm.hora || ''}
                            onChange={(e) => setEditForm({ ...editForm, hora: e.target.value })}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <CampoCatalogo catalogo="estacas" config={config} valor={editForm.estaca || ''} rotulo="Estaca"
                          placeholder="Ex: 4537" inputClassName="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1" rotuloClassName="text-[9px] font-bold text-slate-500 uppercase"
                          onChange={(v) => setEditForm({ ...editForm, estaca: v })} />
                        <CampoCatalogo catalogo="lados" config={config} valor={editForm.lado || ''} rotulo="Lado" maiusculas
                          inputClassName="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1" rotuloClassName="text-[9px] font-bold text-slate-500 uppercase"
                          onChange={(v) => setEditForm({ ...editForm, lado: v })} />
                        <CampoCatalogo catalogo="rodovias" config={config} valor={editForm.rodovia || ''} rotulo="Rodovia"
                          inputClassName="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1" rotuloClassName="text-[9px] font-bold text-slate-500 uppercase"
                          onChange={(v) => setEditForm({ ...editForm, rodovia: v })} />
                        <CampoCatalogo catalogo="trechos" config={config} valor={editForm.trecho || ''} rotulo="Trecho"
                          inputClassName="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1" rotuloClassName="text-[9px] font-bold text-slate-500 uppercase"
                          onChange={(v) => setEditForm({ ...editForm, trecho: v })} />
                        <CampoCatalogo catalogo="categorias" config={config} valor={editForm.categoria || ''} rotulo="Categoria"
                          inputClassName="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1" rotuloClassName="text-[9px] font-bold text-slate-500 uppercase"
                          onChange={(v) => setEditForm({ ...editForm, categoria: v })} />
                      </div>

                      <div>
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Pasta de destino da foto</label>
                        <select
                          value={editForm.folderId || ''}
                          onChange={(e) => setEditForm({ ...editForm, folderId: e.target.value })}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded p-1"
                        >
                          {!photo.folderId && <option value="">Padrão (sem pasta definida)</option>}
                          {availableFolders.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                        <span className="text-[9px] text-slate-500">Ao salvar, a cópia local é movida para a pasta escolhida.</span>
                      </div>

                      <CampoCatalogo catalogo="servicos" config={config} valor={editForm.servico || ''} multiline
                        inputClassName="w-full text-xs bg-white border border-emerald-500 rounded p-1.5 leading-relaxed font-medium text-slate-900"
                        rotuloClassName="text-[9px] font-bold text-slate-500 uppercase flex items-center gap-2 flex-wrap"
                        rotulo={<><span>Editar Descrição do Serviço (Padrão DER/PR)</span><span className="text-emerald-700 font-semibold normal-case">Salvar para atualizar</span></>}
                       
                        onChange={(v) => setEditForm({ ...editForm, servico: v })}
                        sugestoes={serviceIdeas}
                        onEscolherSugestao={(v) => setEditForm({ ...editForm, servico: v })} />

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-2.5 py-1 text-slate-600 hover:bg-slate-100 rounded"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSaveEdit(photo.id)}
                          className="text-xs px-3 py-1 bg-emerald-700 text-white rounded font-bold hover:bg-emerald-800 flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Salvar Descrição</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1 text-xs text-slate-800">
                        <div className="flex items-center justify-between text-slate-600 text-[11px] pb-1 border-b border-slate-100">
                          <span className="font-semibold text-slate-900">Data: {photo.data}</span>
                          <span>Rodovia: {photo.rodovia}</span>
                        </div>
                        <div className="text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700">Trecho:</span> {photo.trecho}
                        </div>
                        <div className="text-xs font-medium text-slate-900 leading-snug pt-1">
                          <span className="font-bold text-slate-800">Serviço:</span> {photo.servico}
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                        <div className="flex flex-wrap gap-1">{photoTags(photo).map(tag=><button key={tagKey(tag)} onClick={()=>setTagsPhoto(photo)} className="text-xs text-emerald-800 bg-emerald-50 px-2 py-1 rounded-full" title="Editar tags desta foto">{tag}</button>)}<button className="text-xs text-emerald-700" onClick={()=>setTagsPhoto(photo)}>+ Tags</button></div>
                        {photo.estaca && (
                          <span className="text-[10px] font-mono text-slate-600 font-semibold">
                            Est: {photo.estaca} {photo.lado ? `(${photo.lado})` : ''}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(photo)}
                          className="text-[10px] text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-0.5"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800 text-white text-[11px] uppercase tracking-wider font-semibold">
                <tr>
                  <th className="p-3 w-10">Incluir</th>
                  <th className="p-3">#</th>
                  <th className="p-3">Selecionar</th>
                  <th className="p-3">Foto</th>
                  <th className="p-3">Data</th>
                  <th className="p-3">Rodovia / Trecho</th>
                  <th className="p-3">Serviço / Descrição Técnica</th>
                  <th className="p-3">Arquivo</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredAndSortedPhotos.map((photo, index) => {
                  const isIncluded = photo.includedInReport !== false;
                  return (
                    <tr
                      key={photo.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isIncluded ? 'bg-white' : 'bg-slate-50/60 opacity-70'
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isIncluded}
                          onChange={() => handleToggleInclude(photo)}
                          className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-500">{index + 1}</td>
                      <td className="p-3"><input type="checkbox" aria-label={`Selecionar foto ${index+1} para ação em lote`} checked={deleteSelection.has(photo.id)} onChange={()=>toggleDelete(photo.id)}/></td>
                      <td className="p-3">
                        <div className="w-14 h-11 rounded bg-slate-900 overflow-hidden shrink-0 border border-slate-200">
                          <img src={photo.thumbnailUrl || photo.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-slate-900 whitespace-nowrap">
                        {photo.data}
                        {photo.hora && <div className="text-[10px] text-slate-400 font-normal">{photo.hora}</div>}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold text-emerald-800">{photo.rodovia}</div>
                        <div className="text-[11px] text-slate-500">{photo.trecho}</div>
                      </td>
                      <td className="p-3 font-medium text-slate-800 max-w-xs">{photo.servico}<div className="flex flex-wrap gap-1 mt-2">{photoTags(photo).map(tag=><button key={tagKey(tag)} className="bg-emerald-50 rounded px-2 py-1" onClick={()=>setTagsPhoto(photo)}>{tag}</button>)}<button onClick={()=>setTagsPhoto(photo)}>+ Tags</button></div></td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="text-xs text-emerald-800">{photo.imageUrl.startsWith('data:') ? 'Local' : 'Reimportar imagem'}</span>
                        {photo.stampEdit&&<span className="block text-xs text-amber-800">Cópia editada</span>}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {reorderMode&&(
                            <span className="flex items-center gap-0.5 pr-1 mr-1 border-r border-amber-300">
                              <button type="button" onClick={()=>movePhotoSequence(photo,'up')} disabled={index===0} className="p-1 text-amber-800 hover:bg-amber-100 rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Subir uma posição"><ArrowUp className="w-4 h-4" /></button>
                              <button type="button" onClick={()=>movePhotoSequence(photo,'down')} disabled={index>=filteredAndSortedPhotos.length-1} className="p-1 text-amber-800 hover:bg-amber-100 rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Descer uma posição"><ArrowDown className="w-4 h-4" /></button>
                              <button type="button" onClick={()=>movePhotoSequence(photo,'top')} disabled={index===0} className="p-1 text-amber-800 hover:bg-amber-100 rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Levar para o início da lista"><ChevronsUp className="w-4 h-4" /></button>
                              <button type="button" onClick={()=>movePhotoSequence(photo,'bottom')} disabled={index>=filteredAndSortedPhotos.length-1} className="p-1 text-amber-800 hover:bg-amber-100 rounded disabled:opacity-30 disabled:hover:bg-transparent" title="Levar para o fim da lista"><ChevronsDown className="w-4 h-4" /></button>
                            </span>
                          )}
                          <button className="p-1 text-xs text-emerald-800" onClick={()=>setStampPhoto(photo)}>Editar estampa</button>
                          <button
                            onClick={() => openMoveDialog([photo.id])}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                            title="Mover para outra pasta"
                          >
                            <FolderInput className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleStartEdit(photo)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded"
                            title="Editar Descrição"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeletePhoto(photo.id)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
