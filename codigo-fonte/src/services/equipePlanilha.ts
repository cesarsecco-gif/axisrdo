import {createXlsx} from '../../xlsxWriter';
import type {EquipeConfig,EquipeMember} from '../types';
import {lerPrimeiraAba,Celula} from './xlsxLeitor';
import {normalizarTexto,chaveMatricula,contarPresencas,contarPresencasNoMes,registrarFuncao,equipeMaisRecente,removerMembros,estaAtivo} from './equipe';

const MESES=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
export const rotuloMes=(mes:string)=>`${MESES[Number(mes.slice(5,7))-1]}/${mes.slice(0,4)}`;

export function interpretarMes(c:Celula):string|null{
 if(typeof c==='number'){
  if(c<36526||c>73050)return null;
  return new Date(Date.UTC(1899,11,30)+Math.round(c)*86400000).toISOString().slice(0,7);
 }
 const t=String(c??'').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace('.','');
 let m=t.match(/^([A-Z]{3})[A-Z]*[\/\- ](\d{2}|\d{4})$/);
 if(m){const i=MESES.indexOf(m[1]);if(i>=0){const ano=m[2].length===2?2000+Number(m[2]):Number(m[2]);return `${ano}-${String(i+1).padStart(2,'0')}`;}}
 m=t.match(/^(\d{1,2})\/(\d{4})$/);
 if(m&&Number(m[1])>=1&&Number(m[1])<=12)return `${m[2]}-${m[1].padStart(2,'0')}`;
 m=t.match(/^(\d{4})-(\d{2})$/);
 if(m&&Number(m[2])>=1&&Number(m[2])<=12)return t;
 return null;
}

export type LinhaPlanilha={linha:number;matricula:string;nome:string;funcao:string;ativo?:boolean;meses:Record<string,string>};
export type Recusa={linha:number;motivo:string};
export type PlanilhaEquipe={meses:string[];linhas:LinhaPlanilha[];recusadas:Recusa[];colunasIgnoradas:string[];situacoesIgnoradas:{linha:number;texto:string}[]};

// Excel in Portuguese saves CSV as Windows-1252; UTF-8 decoding then yields U+FFFD.
function decodificarCsv(bytes:Uint8Array){
 const utf8=new TextDecoder('utf-8').decode(bytes);
 return utf8.includes('�')?new TextDecoder('windows-1252').decode(bytes):utf8;
}
function lerCsv(texto:string):Celula[][]{
 const primeira=texto.split(/\r?\n/,1)[0]||'';
 const sep=primeira.split(';').length>primeira.split(',').length?';':',';
 const linhas:Celula[][]=[];let linha:string[]=[];let campo='';let aspas=false;
 for(let i=0;i<texto.length;i++){
  const ch=texto[i];
  if(aspas){if(ch==='"'){if(texto[i+1]==='"'){campo+='"';i++;}else aspas=false;}else campo+=ch;continue;}
  if(ch==='"')aspas=true;
  else if(ch===sep){linha.push(campo);campo='';}
  else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&texto[i+1]==='\n')i++;linha.push(campo);linhas.push(linha);linha=[];campo='';}
  else campo+=ch;
 }
 if(campo||linha.length){linha.push(campo);linhas.push(linha);}
 return linhas.map(l=>l.map(c=>c===''?null:c));
}
const chaveCabecalho=(c:Celula)=>String(c??'').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

const SIM=['SIM','S','1','VERDADEIRO','ATIVO','TRUE'];
const NAO=['NAO','N','0','FALSO','INATIVO','FALSE'];
// Returns no "ativo" when the cell says nothing: the caller must not change the flag.
function interpretarAtivo(c:Celula):{ativo?:boolean;texto?:string}{
 const t=String(c??'').trim();
 if(!t)return {};
 const k=t.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
 if(SIM.includes(k))return {ativo:true};
 if(NAO.includes(k))return {ativo:false};
 return {texto:t};
}

export function lerPlanilhaEquipe(arq:{nome:string;bytes:Uint8Array}):PlanilhaEquipe{
 const ehXlsx=/\.xlsx$/i.test(arq.nome)||(arq.bytes[0]===0x50&&arq.bytes[1]===0x4b);
 const celulas=ehXlsx?lerPrimeiraAba(arq.bytes):lerCsv(decodificarCsv(arq.bytes));
 const iCab=celulas.findIndex(l=>l.some(c=>chaveCabecalho(c)==='MATRICULA')&&l.some(c=>chaveCabecalho(c)==='NOME'));
 if(iCab<0)throw new Error('Não encontrei o cabeçalho com MATRÍCULA e NOME. Use a planilha exportada pelo app como modelo.');
 const cab=celulas[iCab];
 const cMat=cab.findIndex(c=>chaveCabecalho(c)==='MATRICULA');
 const cNome=cab.findIndex(c=>chaveCabecalho(c)==='NOME');
 const cFunc=cab.findIndex(c=>chaveCabecalho(c)==='FUNCAO');
 if(cFunc<0)throw new Error('A planilha não tem a coluna FUNÇÃO.');
 const cAtivo=cab.findIndex(c=>chaveCabecalho(c)==='ATIVO');
 const colMeses:{col:number;mes:string}[]=[];const colunasIgnoradas:string[]=[];
 cab.forEach((c,i)=>{
  if(i===cMat||i===cNome||i===cFunc||i===cAtivo||c===null||c==='')return;
  const mes=interpretarMes(c);
  if(mes&&!colMeses.some(x=>x.mes===mes))colMeses.push({col:i,mes});else colunasIgnoradas.push(String(c));
 });
 if(!colMeses.length)throw new Error('Nenhuma coluna de mês foi reconhecida. Use cabeçalhos como ABR/2026.');
 const lidas:LinhaPlanilha[]=[];const recusadas:Recusa[]=[];const situacoesIgnoradas:{linha:number;texto:string}[]=[];
 for(let i=iCab+1;i<celulas.length;i++){
  const l=celulas[i]||[];
  const matricula=String(l[cMat]??'').trim();const nome=normalizarTexto(l[cNome]);const funcao=normalizarTexto(l[cFunc]);
  const meses:Record<string,string>={};for(const {col,mes} of colMeses)meses[mes]=normalizarTexto(l[col]);
  if(!matricula&&!nome&&!funcao&&Object.values(meses).every(v=>!v))continue;
  if(!matricula){recusadas.push({linha:i+1,motivo:'sem matrícula'});continue;}
  if(!nome){recusadas.push({linha:i+1,motivo:'sem nome'});continue;}
  const sit=cAtivo>=0?interpretarAtivo(l[cAtivo]):{};
  if(sit.texto)situacoesIgnoradas.push({linha:i+1,texto:sit.texto});
  // The key is left out when the sheet says nothing, so nobody's flag changes.
  lidas.push({linha:i+1,matricula,nome,funcao,...(sit.ativo===undefined?{}:{ativo:sit.ativo}),meses});
 }
 const contagem=new Map<string,number>();
 for(const l of lidas)contagem.set(chaveMatricula(l.matricula),(contagem.get(chaveMatricula(l.matricula))||0)+1);
 const linhas=lidas.filter(l=>contagem.get(chaveMatricula(l.matricula))===1);
 for(const l of lidas)if(contagem.get(chaveMatricula(l.matricula))!==1)recusadas.push({linha:l.linha,motivo:`matrícula ${l.matricula} repetida no arquivo`});
 return {meses:colMeses.map(x=>x.mes).sort(),linhas,recusadas:recusadas.sort((a,b)=>a.linha-b.linha),colunasIgnoradas,situacoesIgnoradas};
}

const LEIA_ME=[
 'Não altere a MATRÍCULA de quem já existe: ela liga a pessoa ao histórico de presença.',
 'Preencha a MATRÍCULA de quem estiver sem ela; linhas sem matrícula não são importadas.',
 'Em cada coluna de mês, escreva a EQUIPE da pessoa naquele mês. Célula vazia = não esteve na obra no mês.',
 'Nova pessoa: acrescente uma linha com matrícula, nome, função e as equipes dos meses.',
 'Novo mês: acrescente uma coluna com o cabeçalho no formato MMM/AAAA (ex.: JUL/2026).',
 'Para mudar a função, edite a coluna FUNÇÃO; o app pergunta a partir de qual mês ela vale.',
 'Coluna ATIVO: SIM para quem está à disposição, NÃO para quem está de férias, afastado ou desligado.',
 'A coluna ATIVO só afeta o preenchimento automático do efetivo; presenças já marcadas nunca mudam.',
 'Se o cadastro foi alterado no app, exporte de novo antes de editar esta planilha.',
];

function mesesDaPlanilha(cfg:EquipeConfig,mesAtual:string){
 const todos=[...cfg.members.flatMap(m=>Object.keys(m.meses||{})),mesAtual].sort();
 const fim=todos[todos.length-1];const meses:string[]=[];
 let ano=Number(todos[0].slice(0,4)),mes=Number(todos[0].slice(5,7));
 for(;;){const k=`${ano}-${String(mes).padStart(2,'0')}`;meses.push(k);if(k>=fim)break;mes++;if(mes>12){mes=1;ano++;}}
 return meses;
}

export function gerarPlanilhaEquipe(cfg:EquipeConfig,mesAtual:string){
 const meses=mesesDaPlanilha(cfg,mesAtual);
 const rows=[...cfg.members].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')).map(m=>[m.matricula||'',m.nome,m.funcao,estaAtivo(m)?'SIM':'NÃO',...meses.map(k=>m.meses?.[k]||'')]);
 return createXlsx([
  {name:'Equipe',headers:['MATRÍCULA','NOME','FUNÇÃO','ATIVO',...meses.map(rotuloMes)],rows},
  {name:'Leia-me',headers:['Como usar esta planilha'],rows:LEIA_ME.map(t=>[t])},
 ]);
}

// A pessoa nova nasce inativa quando a planilha nada diz (ver novoMembro): a prévia
// precisa anunciar isso, senão o desligamento acontece em silêncio.
export const rotuloPessoaNova=(l:LinhaPlanilha)=>
 `${l.matricula} — ${l.nome} (${l.funcao||'sem função'})`+(l.ativo===true?'':' — entra INATIVA');

export type Par={linha:LinhaPlanilha;membro:EquipeMember;porNome:boolean};
export type Alteracao={tipo:'matricula'|'nome'|'funcao'|'ativa'|'inativa'|'entrada'|'transferencia'|'saida'|'saidaRecusada';matricula:string;nome:string;mes?:string;de?:string;para?:string;porNome:boolean;presencas?:number};
export type Previa={meses:string[];pares:Par[];novas:LinhaPlanilha[];alteracoes:Alteracao[];equipesNovas:string[];foraDaPlanilha:{membro:EquipeMember;presencas:number}[];recusadas:Recusa[];colunasIgnoradas:string[];situacoesIgnoradas:{linha:number;texto:string}[];mesFuncaoPadrao:string};
export type EscolhasImportacao={mesFuncao:string;desvincular:Set<string>;remover:Set<string>};

export function montarPrevia(cfg:EquipeConfig,planilha:PlanilhaEquipe):Previa{
 const porMatricula=new Map<string,EquipeMember>();const semMatricula=new Map<string,EquipeMember[]>();
 for(const m of cfg.members){
  if(m.matricula)porMatricula.set(chaveMatricula(m.matricula),m);
  else{const k=normalizarTexto(m.nome);semMatricula.set(k,[...(semMatricula.get(k)||[]),m]);}
 }
 const nomesNaPlanilha=new Map<string,number>();
 for(const l of planilha.linhas)nomesNaPlanilha.set(l.nome,(nomesNaPlanilha.get(l.nome)||0)+1);
 const usados=new Set<string>();const pares:Par[]=[];const novas:LinhaPlanilha[]=[];const alteracoes:Alteracao[]=[];
 for(const linha of planilha.linhas){
  let membro=porMatricula.get(chaveMatricula(linha.matricula));let porNome=false;
  if(!membro&&nomesNaPlanilha.get(linha.nome)===1){const homonimos=semMatricula.get(linha.nome)||[];if(homonimos.length===1){membro=homonimos[0];porNome=true;}}
  if(!membro||usados.has(membro.id)){novas.push(linha);continue;}
  usados.add(membro.id);pares.push({linha,membro,porNome});
  const base={matricula:linha.matricula,nome:linha.nome,porNome};
  if(porNome)alteracoes.push({...base,tipo:'matricula',de:'',para:linha.matricula});
  if(linha.nome!==normalizarTexto(membro.nome))alteracoes.push({...base,tipo:'nome',de:membro.nome,para:linha.nome});
  if(linha.funcao&&linha.funcao!==normalizarTexto(membro.funcao))alteracoes.push({...base,tipo:'funcao',de:membro.funcao,para:linha.funcao});
  if(linha.ativo!==undefined&&linha.ativo!==estaAtivo(membro))alteracoes.push({...base,tipo:linha.ativo?'ativa':'inativa'});
  for(const mes of planilha.meses){
   const antes=membro.meses?.[mes]||'';const depois=linha.meses[mes]||'';
   if(antes===depois)continue;
   if(!antes)alteracoes.push({...base,tipo:'entrada',mes,para:depois});
   else if(depois)alteracoes.push({...base,tipo:'transferencia',mes,de:antes,para:depois});
   else{const presencas=contarPresencasNoMes(cfg,membro.id,mes);alteracoes.push({...base,tipo:presencas?'saidaRecusada':'saida',mes,de:antes,presencas});}
  }
 }
 const existentes=new Set(cfg.members.flatMap(m=>Object.values(m.meses||{})));
 const equipesNovas=[...new Set(planilha.linhas.flatMap(l=>Object.values(l.meses).filter(Boolean)))].filter(e=>!existentes.has(e)).sort();
 const foraDaPlanilha=cfg.members.filter(m=>!usados.has(m.id)).map(m=>({membro:m,presencas:contarPresencas(cfg,m.id)}));
 return {meses:planilha.meses,pares,novas,alteracoes,equipesNovas,foraDaPlanilha,recusadas:planilha.recusadas,colunasIgnoradas:planilha.colunasIgnoradas,situacoesIgnoradas:planilha.situacoesIgnoradas||[],mesFuncaoPadrao:planilha.meses[planilha.meses.length-1]};
}

function novoMembro(l:LinhaPlanilha):EquipeMember{
 const meses:Record<string,string>={};for(const [mes,eq] of Object.entries(l.meses))if(eq)meses[mes]=eq;
 // Written explicitly: an absent flag would be turned back on by migrarEquipe.
 return {id:crypto.randomUUID(),matricula:l.matricula,nome:l.nome,funcao:l.funcao,ativo:l.ativo===true,meses,equipe:equipeMaisRecente(meses)};
}

export function aplicarPrevia(cfg:EquipeConfig,previa:Previa,escolhas:EscolhasImportacao):EquipeConfig{
 const atualizados=new Map<string,EquipeMember>();const adicionados:EquipeMember[]=[];
 for(const par of previa.pares){
  if(par.porNome&&escolhas.desvincular.has(chaveMatricula(par.linha.matricula))){adicionados.push(novoMembro(par.linha));continue;}
  const m=par.membro;
  let r:EquipeMember={...m,matricula:par.linha.matricula,nome:par.linha.nome,...(par.linha.ativo===undefined?{}:{ativo:par.linha.ativo})};
  if(par.linha.funcao)r=registrarFuncao(r,par.linha.funcao,escolhas.mesFuncao);
  const meses={...(m.meses||{})};
  for(const mes of previa.meses){
   const depois=par.linha.meses[mes]||'';
   if(depois)meses[mes]=depois;
   else if(meses[mes]&&contarPresencasNoMes(cfg,m.id,mes)===0)delete meses[mes];
  }
  atualizados.set(m.id,{...r,meses,equipe:equipeMaisRecente(meses)});
 }
 for(const l of previa.novas)adicionados.push(novoMembro(l));
 const resultado={...cfg,members:[...cfg.members.map(m=>atualizados.get(m.id)||m),...adicionados]};
 return escolhas.remover.size?removerMembros(resultado,escolhas.remover):resultado;
}
