import type {EquipeConfig,EquipeMember} from '../types';

export const SEM_EQUIPE='SEM EQUIPE';
export const normalizarTexto=(v:unknown)=>String(v??'').trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR');
export const chaveMatricula=(v:unknown)=>String(v??'').trim().replace(/^0+(?=.)/,'');
export const mesDe=(data:string)=>data.slice(0,7);

export function funcaoNoMes(m:EquipeMember,mes:string){
 for(const h of m.historicoFuncao||[])if(mes<h.desde)return h.anterior;
 return m.funcao;
}

export const estaAtivo=(m:EquipeMember)=>m.ativo===true;

export function equipeMaisRecente(meses?:Record<string,string>){
 const chaves=Object.keys(meses||{}).sort();
 return chaves.length?meses![chaves[chaves.length-1]]:undefined;
}

export function registrarFuncao(m:EquipeMember,nova:string,desde:string):EquipeMember{
 const funcao=normalizarTexto(nova);
 if(!funcao||funcao===normalizarTexto(m.funcao))return m;
 // A second change in the same month corrects the first one: keep the original "anterior".
 const mesmoMes=(m.historicoFuncao||[]).find(h=>h.desde===desde);
 const anterior=mesmoMes?mesmoMes.anterior:funcaoNoMes(m,desde);
 const historico=(m.historicoFuncao||[]).filter(h=>h.desde<desde);
 return {...m,funcao,historicoFuncao:funcao===anterior?historico:[...historico,{desde,funcao,anterior}]};
}

export function definirEquipeNoMes(cfg:EquipeConfig,id:string,mes:string,equipe:string|null):EquipeConfig{
 return {...cfg,members:cfg.members.map(m=>{
  if(m.id!==id)return m;
  const meses={...(m.meses||{})};
  const valor=equipe?normalizarTexto(equipe):'';
  if(valor)meses[mes]=valor;else delete meses[mes];
  return {...m,meses,equipe:equipeMaisRecente(meses)};
 })};
}

export function contarPresencas(cfg:EquipeConfig,id:string){
 let n=0;for(const dia of Object.values(cfg.efetivo||{}))if(dia?.[id])n++;return n;
}

export function contarPresencasNoMes(cfg:EquipeConfig,id:string,mes:string){
 let n=0;for(const [data,dia] of Object.entries(cfg.efetivo||{}))if(data.startsWith(mes)&&dia?.[id])n++;return n;
}

export function removerMembros(cfg:EquipeConfig,ids:Set<string>):EquipeConfig{
 const efetivo:Record<string,Record<string,number>>={};
 for(const [data,dia] of Object.entries(cfg.efetivo||{})){const novo={...dia};for(const id of ids)delete novo[id];efetivo[data]=novo;}
 return {members:cfg.members.filter(m=>!ids.has(m.id)),efetivo};
}

export function migrarEquipe(cfg:EquipeConfig,mesAtual:string):EquipeConfig{
 if(cfg.members.every(m=>m.meses&&m.ativo!==undefined))return cfg;
 const mesesComPresenca=new Map<string,Set<string>>();
 for(const [data,dia] of Object.entries(cfg.efetivo||{}))for(const [id,v] of Object.entries(dia||{}))if(v){
  const s=mesesComPresenca.get(id)||new Set<string>();s.add(mesDe(data));mesesComPresenca.set(id,s);
 }
 const members=cfg.members.map(m=>{
  // Projects written before this version carry no "ativo": everyone already registered is active.
  const base=m.ativo===undefined?{...m,ativo:true}:m;
  if(base.meses)return base;
  const equipe=normalizarTexto(base.equipe)||SEM_EQUIPE;
  const meses:Record<string,string>={};
  for(const mes of [...(mesesComPresenca.get(base.id)||[])].sort())meses[mes]=equipe;
  if(!Object.keys(meses).length)meses[mesAtual]=equipe;
  return {...base,meses};
 });
 return {...cfg,members};
}

export function membrosDoMes(cfg:EquipeConfig,mes:string){
 const comPresenca=new Set<string>();
 for(const [data,dia] of Object.entries(cfg.efetivo||{}))if(data.startsWith(mes))for(const [id,v] of Object.entries(dia||{}))if(v)comPresenca.add(id);
 return cfg.members
  .filter(m=>m.meses?.[mes]||comPresenca.has(m.id))
  .map(m=>({membro:m,equipe:m.meses?.[mes]||SEM_EQUIPE,semEquipeNoMes:!m.meses?.[mes]}))
  .sort((a,b)=>a.equipe.localeCompare(b.equipe,'pt-BR')||a.membro.nome.localeCompare(b.membro.nome,'pt-BR'));
}

export const membrosAtivosDoMes=(cfg:EquipeConfig,mes:string)=>membrosDoMes(cfg,mes).filter(x=>estaAtivo(x.membro));

// A pergunta fica aqui, e nao no componente, porque e ela que torna a acao
// consciente: a lista e do MES, entao quem entrou ou saiu no meio do mes nao e
// distinguido pelo app. Marcar presenca de quem nao trabalhou e o pior erro
// possivel num documento oficial, logo o usuario confirma sempre.
export function perguntaUsarEfetivo(r:{ativos:number;inativos:string[];tinhaMarca:boolean},dataBr:string){
 const partes=[`Marcar ${r.ativos} pessoa(s) como presentes em ${dataBr} e levar esse total para o RDO?`,
  'A lista usada e a da equipe do mes: confira quem entrou ou saiu no meio do mes.'];
 if(r.tinhaMarca)partes.push('As presencas ja marcadas neste dia serao substituidas.');
 if(r.inativos.length)partes.push(`${r.inativos.length} pessoa(s) inativa(s) nao serao marcadas: ${r.inativos.join(', ')}.`);
 return partes.join('\n\n');
}

export type MarcacaoDoDia={cfg:EquipeConfig;marcados:number;inativos:string[];tinhaMarca:boolean};
// Marks every active member of that day's month as present on that single day.
// The RDO's "Profissionais em atividade" is the report of this fact, so the caller
// writes the number back from `marcados` instead of asking the user to guess it.
export function marcarAtivosNoDia(cfg:EquipeConfig,data:string):MarcacaoDoDia{
 const doMes=membrosDoMes(cfg,mesDe(data));
 const ativos=doMes.filter(x=>estaAtivo(x.membro));
 const inativos=doMes.filter(x=>!estaAtivo(x.membro)).map(x=>x.membro.nome);
 const tinhaMarca=Object.values(cfg.efetivo?.[data]||{}).some(v=>v);
 if(!ativos.length)return {cfg,marcados:0,inativos,tinhaMarca};
 const dia:Record<string,number>={};
 for(const x of ativos)dia[x.membro.id]=1;
 return {cfg:{...cfg,efetivo:{...cfg.efetivo,[data]:dia}},marcados:ativos.length,inativos,tinhaMarca};
}

export type DiaRdo={date:string;professionals:number|null};
export type ResumoSyncRdo={
 preenchidos:number;   // dias gravados com presença
 zerados:number;       // dias gravados vazios porque o RDO informou zero
 marcacoes:number;     // presenças gravadas no total
 semNumero:string[];   // datas puladas: RDO sem "Profissionais em atividade"
 mantidos:number;      // dias já marcados à mão que ficaram intactos
 substituidos:number;  // dias já marcados à mão que foram regravados
 semMembros:boolean;   // não há ninguém na lista do mês
 inativos:number;      // pessoas da lista do mês puladas por estarem inativas
 semAtivos:boolean;    // o mês tem gente, mas nenhuma está ativa
};
// Monta as duas perguntas do auto-preenchimento. Fica aqui, e nao no componente,
// because the first question is skipped when every day already has marks: inline,
// the inactive warning would vanish exactly when overwriting would erase them.
export function perguntasSyncRdo(res:ResumoSyncRdo,rotulo:string,nomesInativos:string,formatarDatas:(d:string[])=>string){
 const avisoInativos=res.inativos?`${res.inativos} pessoa(s) não serão marcadas por estarem inativas: ${nomesInativos}`:'';
 const partes:string[]=[];
 if(avisoInativos)partes.push(avisoInativos);
 if(res.preenchidos)partes.push(`${res.preenchidos} dia(s) com ${res.marcacoes} presença(s)`);
 if(res.zerados)partes.push(`${res.zerados} dia(s) zerado(s) no RDO`);
 if(res.semNumero.length)partes.push(`${res.semNumero.length} dia(s) sem "Profissionais em atividade" serão ignorados: ${formatarDatas(res.semNumero)}`);
 if(res.mantidos)partes.push(`${res.mantidos} dia(s) já marcado(s) à mão`);
 const confirmar=(res.preenchidos||res.zerados)
  ?`Preencher ${rotulo} com base no número de profissionais informados no RDO?\n\n${partes.join('\n')}`
  :null;
 const sobrescrever=res.mantidos
  ?`${res.mantidos} dia(s) de ${rotulo} já têm marcações manuais. Sobrescrever com o número do RDO?`
   +(avisoInativos?`\n\nAtenção: ${avisoInativos}. Sobrescrever apaga as presenças que elas tenham nesses dias.`:'')
   +`\n\nCancelar = manter as marcações manuais e completar apenas os dias vazios.`
  :null;
 return {confirmar,sobrescrever};
}

// Preenche o efetivo do mês com o total de profissionais de cada RDO.
// Dias sem número não são tocados: gravar `{}` apagaria marcações manuais
// e faria o botão parecer que não fez nada.

export function preencherEfetivoComRdo(cfg:EquipeConfig,dias:DiaRdo[],mes:string,sobrescrever:boolean){
 const doMesTodos=membrosDoMes(cfg,mes);
 const ids=membrosAtivosDoMes(cfg,mes).map(x=>x.membro.id);
 const efetivo:Record<string,Record<string,number>>={...cfg.efetivo};
 const res:ResumoSyncRdo={preenchidos:0,zerados:0,marcacoes:0,semNumero:[],mantidos:0,substituidos:0,
  semMembros:!doMesTodos.length,inativos:doMesTodos.length-ids.length,semAtivos:!!doMesTodos.length&&!ids.length};
 const doMes=dias.filter(d=>d.date.startsWith(mes)).sort((a,b)=>a.date.localeCompare(b.date));
 for(const dia of doMes){
  if(dia.professionals===null){res.semNumero.push(dia.date);continue;}
  if(!ids.length)continue;
  const atual=efetivo[dia.date]||{};
  const tinhaMarca=Object.values(atual).some(v=>v);
  if(tinhaMarca&&!sobrescrever){res.mantidos++;continue;}
  const novo:Record<string,number>={};
  const n=Math.min(dia.professionals,ids.length);
  for(let i=0;i<n;i++)novo[ids[i]]=1;
  efetivo[dia.date]=novo;
  if(n)res.preenchidos++;else res.zerados++;
  res.marcacoes+=n;
  if(tinhaMarca)res.substituidos++;
 }
 return {efetivo,res};
}

export type LinhaHistograma={equipe:string;funcao:string;porData:Record<string,number>};
export function histogramaPorEquipe(cfg:EquipeConfig,datas:string[]):LinhaHistograma[]{
 const linhas=new Map<string,LinhaHistograma>();
 for(const m of cfg.members)for(const data of datas){
  const mes=mesDe(data);const presente=cfg.efetivo?.[data]?.[m.id]?1:0;
  if(!presente&&!m.meses?.[mes])continue;
  const equipe=m.meses?.[mes]||SEM_EQUIPE;const funcao=funcaoNoMes(m,mes)||'SEM FUNÇÃO';
  const chave=equipe+'\u0000'+funcao;
  const l=linhas.get(chave)||{equipe,funcao,porData:{}};
  l.porData[data]=(l.porData[data]||0)+presente;linhas.set(chave,l);
 }
 return [...linhas.values()].sort((a,b)=>a.equipe.localeCompare(b.equipe,'pt-BR')||a.funcao.localeCompare(b.funcao,'pt-BR'));
}
