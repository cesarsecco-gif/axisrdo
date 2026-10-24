import React,{useEffect,useRef,useState} from 'react';
import {createWorker,Worker} from 'tesseract.js';
import {PhotoRecord} from '../types';
import {Region,renderStamp} from '../services/stamp';

export function StampEditor({photo,onClose,onSave}:{photo:PhotoRecord;onClose:()=>void;onSave:(p:PhotoRecord)=>void}) {
  const [mode,setMode]=useState<'band'|'replace'>('band');
  const [text,setText]=useState(photo.servico||'');
  const [size,setSize]=useState(28),[region,setRegion]=useState<Region>({x:1,y:1,width:200,height:100});
  const [preview,setPreview]=useState(''),[before,setBefore]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const [ready,setReady]=useState(false);
  const img=useRef<HTMLImageElement|null>(null),worker=useRef<Worker|null>(null),alive=useRef(true),start=useRef<{x:number;y:number}|null>(null);
  useEffect(()=>{alive.current=true;const image=new Image();image.onload=()=>{if(!alive.current)return;img.current=image;setSize(Math.max(12,Math.round(image.naturalWidth/50)));setRegion({x:1,y:1,width:Math.floor(image.naturalWidth*.8),height:Math.floor(image.naturalHeight*.4)});setReady(true);};image.onerror=()=>setError('Não foi possível abrir a foto. Reimporte o arquivo local.');image.src=photo.imageUrl;return()=>{alive.current=false;void worker.current?.terminate();};},[photo.imageUrl]);
  useEffect(()=>{setPreview('');setError('');},[mode,text,size,region]);
  function point(e:React.PointerEvent<HTMLDivElement>){const b=e.currentTarget.getBoundingClientRect(),i=img.current!;return {x:Math.max(1,Math.min(i.naturalWidth-2,Math.round((e.clientX-b.left)/b.width*i.naturalWidth))),y:Math.max(1,Math.min(i.naturalHeight-2,Math.round((e.clientY-b.top)/b.height*i.naturalHeight)))};}
  async function readText(){setError('');setBusy('Preparando leitura offline…');try{
    if(!worker.current)worker.current=await createWorker('por',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',workerBlobURL:false,logger:m=>{if(alive.current)setBusy(`Leitura offline: ${Math.round((m.progress||0)*100)}%`);}});
    if(!alive.current){await worker.current.terminate();return;}
    const c=document.createElement('canvas');c.width=region.width;c.height=region.height;c.getContext('2d')!.drawImage(img.current!,region.x,region.y,region.width,region.height,0,0,region.width,region.height);
    const result=await worker.current.recognize(c);
    if(alive.current){if(!result.data.text.trim())setError('Nenhum texto detectado. Ajuste a seleção ou digite a correção.');else setText(result.data.text.trim());}
  }catch(e){if(alive.current)setError('Falha na leitura local: '+(e instanceof Error?e.message:String(e)));}finally{if(alive.current)setBusy('');}}
  function generate(){try{setError('');setPreview(renderStamp(img.current!,mode,text,region,size));setBefore(false);}catch(e){setError(e instanceof Error?e.message:String(e));}}
  function save(){onSave({...photo,id:crypto.randomUUID(),imageUrl:preview,thumbnailUrl:undefined,originalImageUrl:photo.originalImageUrl||photo.imageUrl,sourcePhotoId:photo.id,includedInReport:false,stampEdit:{mode,text,region,editedAt:new Date().toISOString(),method:mode==='band'?'external-band':'local-boundary-interpolation'},driveFileId:undefined,driveViewLink:undefined,driveDownloadLink:undefined,driveStatus:'pending',sheetsStatus:'pending'});onClose();}
  return <div className="fixed inset-0 z-50 bg-black/60 p-3 overflow-auto" role="dialog" aria-modal="true" aria-label="Editar estampa">
    <div className="max-w-6xl mx-auto bg-white rounded-xl p-5 space-y-4">
      <div className="flex justify-between"><h2 className="text-xl font-bold">Editar estampa • assistente offline</h2><button onClick={onClose}>Fechar</button></div>
      <p>O original será preservado. A edição será salva como outra foto, inicialmente fora do relatório. No modo faixa externa, a estampa existente permanece na imagem.</p>
      <div className="flex gap-4 flex-wrap"><label><input type="radio" checked={mode==='band'} onChange={()=>setMode('band')}/> Faixa externa — preserva a foto inteira</label><label><input type="radio" checked={mode==='replace'} onChange={()=>setMode('replace')}/> Substituir estampa — fundo aproximado</label></div>
      <p className="text-sm text-slate-600">Arraste sobre a foto para selecionar o texto a ler{mode==='replace'?' e a área a substituir':''}. A seleção deve ficar dentro das bordas.</p>
      {mode==='replace'&&<p className="bg-amber-50 p-3 text-amber-900">A área selecionada inteira será reconstruída por interpolação local. Isso pode apagar detalhes e gerar manchas; não recupera o fundo original. A IA lê o texto; a reconstrução não usa um modelo generativo.</p>}
      <div className="grid md:grid-cols-2 gap-5">
        <div>{ready&&<div className="relative touch-none select-none" style={{cursor:'crosshair'}} onPointerDown={e=>{if(busy)return;start.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!start.current)return;const p=point(e),s=start.current;setRegion({x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.max(1,Math.abs(s.x-p.x)),height:Math.max(1,Math.abs(s.y-p.y))});}} onPointerUp={()=>{start.current=null;}} onPointerCancel={()=>{start.current=null;}}>
          <img src={photo.imageUrl} alt="Original: arraste para selecionar a estampa" draggable={false} className="w-full"/>
          <div className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none" style={{left:`${region.x/img.current!.naturalWidth*100}%`,top:`${region.y/img.current!.naturalHeight*100}%`,width:`${region.width/img.current!.naturalWidth*100}%`,height:`${region.height/img.current!.naturalHeight*100}%`}}/>
        </div>}
        <button className="border rounded p-2 my-3 disabled:opacity-40" disabled={!ready||!!busy} onClick={readText}>Ler texto da seleção com IA (offline)</button><p role="status">{busy}</p></div>
        <div className="space-y-3"><label className="block">Descrição corrigida<textarea className="w-full border rounded p-2 h-40" value={text} maxLength={3000} disabled={!!busy} onChange={e=>setText(e.target.value)}/></label>
          <p className="text-sm">Revise a leitura antes de salvar, especialmente datas e coordenadas. A legenda não altera os campos do cadastro.</p>
          <label>Tamanho da fonte (pixels) <input className="border rounded p-1 w-24" type="number" min="8" max="200" value={size} onChange={e=>setSize(Math.max(8,Math.min(200,Number(e.target.value)||8)))}/></label>
          <div><button disabled={!ready||!!busy||!text.trim()} className="bg-emerald-700 text-white rounded p-3 disabled:opacity-40" onClick={generate}>Gerar prévia</button></div>
          {error&&<p role="alert" className="text-red-700">{error}</p>}
          {preview&&<><button className="border rounded p-2" onClick={()=>setBefore(v=>!v)}>{before?'Mostrar depois':'Mostrar antes'}</button><img src={before?photo.imageUrl:preview} alt={before?'Antes da edição':'Prévia da cópia editada'} className="w-full"/><button className="bg-emerald-700 text-white rounded p-3" onClick={save}>Salvar cópia editada</button></>}
        </div>
      </div>
    </div>
  </div>;
}
