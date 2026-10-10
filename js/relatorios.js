let todosRegistros=[];
let idsAlunosAtivos=new Set();
let simuladosRelatorio=[];
let chartAreas=null, chartFaixas=null, chartEvolucao=null;
let frequenciasRelatorio=[];
let temposRelatorio=[];
let nomesAlunosRelatorio={};
const el=id=>document.getElementById(id);
const escR=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const pct=(a,t)=>t?((a/t)*100).toFixed(1).replace('.',',')+'%':'0,0%';

async function buscarTodasRespostas(){
  const tamanho=1000; let inicio=0; const resultado=[];
  while(true){
    const {data,error}=await db.from('respostas').select('id,aluno_id,questao_id,questao,resultado,dia,simulado,alunos(nome),questoes(numero,area_enem,disciplina,area_aprova)').order('id',{ascending:true}).range(inicio,inicio+tamanho-1);
    if(error) throw error;
    const lote=data||[]; resultado.push(...lote);
    if(lote.length<tamanho) break;
    inicio+=tamanho;
  }
  return resultado;
}

function deduplicar(rows){
  const mapa=new Map();
  rows.forEach(r=>{
    const chave=[r.aluno_id,r.questao_id,r.simulado,r.dia].join('|');
    const anterior=mapa.get(chave);
    if(!anterior || Number(r.id)>Number(anterior.id)) mapa.set(chave,r);
  });
  return [...mapa.values()];
}

function filtros(){
  const sim=el('filtroSimulado').value, dia=el('filtroDia').value;
  return todosRegistros.filter(r=>(!sim||r.simulado===sim)&&(!dia||r.dia===dia));
}

function metricas(rows){
  const a=rows.filter(r=>r.resultado==='Acerto').length;
  const e=rows.filter(r=>r.resultado==='Erro').length;
  const b=rows.filter(r=>r.resultado==='Branco').length;
  return {a,e,b,t:rows.length,p:a/rows.length*100||0};
}

function renderResumoAplicacoes(rows){
  const grupos={};
  rows.forEach(r=>{const k=r.simulado+'|'+r.dia;(grupos[k]??=[]).push(r);});
  const lista=Object.entries(grupos).map(([k,v])=>{const [sim,dia]=k.split('|');return {sim,dia,m:metricas(v),alunos:new Set(v.map(r=>r.aluno_id)).size};}).sort((a,b)=>a.sim.localeCompare(b.sim)||a.dia.localeCompare(b.dia));
  el('resumoAplicacoes').innerHTML=lista.length?lista.map(x=>`<article class="application-card"><div class="application-top"><div><span>${escR(x.dia)}</span><h3>${escR(nomeSimulado(x.sim))}</h3></div><strong>${pct(x.m.a,x.m.t)}</strong></div><div class="progress"><i style="width:${Math.min(100,x.m.p)}%"></i></div><div class="application-stats"><span><b>${x.m.a}</b> acertos</span><span><b>${x.m.e}</b> erros</span><span><b>${x.m.b}</b> brancos</span><span><b>${x.alunos}</b> alunos</span></div></article>`).join(''):'<div class="empty-state">Não há respostas para o filtro selecionado.</div>';
}

function renderRanking(rows){
  const grupos={};
  rows.forEach(r=>(grupos[r.aluno_id]??=[]).push(r));
  const lista=Object.entries(grupos).map(([id,v])=>{const m=metricas(v);return {id,nome:v[0].alunos?.nome||'Aluno não identificado',...m};}).sort((a,b)=>a.p-b.p||a.a-b.a||a.nome.localeCompare(b.nome));
  if(!lista.length){el('rankingTurma').innerHTML='<tr><td colspan="7" class="empty-cell">Sem dados para o filtro selecionado.</td></tr>';return;}
  let pos=0, ultimo=null;
  el('rankingTurma').innerHTML=lista.map((x,i)=>{const mesma=ultimo!==null&&Math.abs(x.p-ultimo)<0.0001; if(!mesma)pos=i+1; ultimo=x.p; return `<tr><td><span class="rank-number">${pos}º</span></td><td><strong>${escR(x.nome)}</strong></td><td>${x.a}</td><td>${x.e}</td><td>${x.b}</td><td>${x.t}</td><td><strong class="rank-percent">${pct(x.a,x.t)}</strong></td></tr>`;}).join('');
}

function agruparAreas(rows){
  const grupos={};
  rows.forEach(r=>{const area=r.questoes?.area_aprova||'Sem área definida';(grupos[area]??=[]).push(r);});
  return Object.entries(grupos).map(([nome,v])=>({nome,m:metricas(v),alunos:new Set(v.map(r=>r.aluno_id)).size})).sort((a,b)=>a.m.p-b.m.p);
}

function renderAreas(rows){
  const lista=agruparAreas(rows);
  el('areasAprova').innerHTML=lista.length?lista.map((x,i)=>`<article class="area-report-card"><div class="area-report-head"><div><span class="area-position">${i+1}º maior dificuldade</span><h3>${escR(x.nome)}</h3></div><strong>${pct(x.m.a,x.m.t)}</strong></div><div class="progress"><i style="width:${Math.min(100,x.m.p)}%"></i></div><div class="area-report-meta"><span><b>${x.m.a}</b> acertos</span><span><b>${x.m.e}</b> erros</span><span><b>${x.m.b}</b> brancos</span><span><b>${x.alunos}</b> alunos</span></div></article>`).join(''):'<div class="empty-state">Nenhuma área disponível.</div>';
}

function renderQuestoesCriticas(rows){
  const grupos={};
  rows.forEach(r=>{const q=r.questoes?.numero??r.questao??'?'; const chave=[r.simulado,r.dia,q].join('|'); (grupos[chave]??=[]).push(r);});
  const lista=Object.entries(grupos).map(([k,v])=>{const [sim,dia,q]=k.split('|');const m=metricas(v);return {sim,dia,q,m,disc:v[0].questoes?.disciplina||'Disciplina não informada',area:v[0].questoes?.area_aprova||'Sem área'};}).sort((a,b)=>b.m.e/b.m.t-a.m.e/a.m.t||b.m.e-a.m.e).slice(0,20);
  el('questoesCriticas').innerHTML=lista.length?lista.map((x,i)=>`<article class="question-report-card"><div class="question-rank">${i+1}</div><div class="question-report-main"><div class="question-report-title"><strong>Questão ${String(x.q).padStart(2,'0')}</strong><span>${escR(x.dia)} • ${escR(nomeSimulado(x.sim))}</span></div><b>${escR(x.disc)}</b><small>${escR(x.area)}</small><div class="question-bar"><i style="width:${Math.min(100,x.m.e/x.m.t*100)}%"></i></div><div class="question-report-meta"><span><b>${x.m.e}</b> erros de ${x.m.t}</span><span><b>${pct(x.m.e,x.m.t)}</b> erraram</span><span>${x.m.a} acertos</span><span>${x.m.b} brancos</span></div></div></article>`).join(''):'<div class="empty-state">Nenhuma questão encontrada.</div>';
}

function renderDisciplinas(rows){
  const grupos={};
  rows.forEach(r=>{const d=r.questoes?.disciplina||'Disciplina não informada';(grupos[d]??=[]).push(r);});
  const lista=Object.entries(grupos).map(([nome,v])=>({nome,m:metricas(v)})).sort((a,b)=>a.m.p-b.m.p);
  el('disciplinasRelatorio').innerHTML=lista.length?lista.map((x,i)=>`<article class="discipline-report-card"><div><span>${i+1}º menor aproveitamento</span><h3>${escR(x.nome)}</h3></div><strong>${pct(x.m.a,x.m.t)}</strong><div class="progress"><i style="width:${Math.min(100,x.m.p)}%"></i></div><p>${x.m.a} acertos · ${x.m.e} erros · ${x.m.b} brancos · ${x.m.t} questões</p></article>`).join(''):'<div class="empty-state">Nenhuma disciplina disponível.</div>';
}


function metricasFrequencia(rows){
  const pres=rows.filter(r=>r.status==='Presente').length;
  const falt=rows.filter(r=>r.status==='Ausente').length;
  const just=rows.filter(r=>r.status==='Justificado').length;
  const total=pres+falt+just;
  return {pres,falt,just,total,pct:total?(pres+just)/total*100:0};
}

function formatarTempoRelatorio(minutos){const n=Math.round(Number(minutos)||0);return `${Math.floor(n/60)}h ${String(n%60).padStart(2,'0')}min`; }

function renderTempoMedioRelatorio(){
  const sim=el('filtroSimulado').value, dia=el('filtroDia').value;
  const rows=temposRelatorio.filter(t=>(!sim||t.simulado===sim)&&(!dia||t.dia===dia)&&Number(t.tempo_minutos)>0);
  const media=rows.length?rows.reduce((s,t)=>s+Number(t.tempo_minutos),0)/rows.length:null;
  el('rTempoMedio').textContent=media===null?'—':formatarTempoRelatorio(media);
}

function renderFrequenciaRelatorio(){
  const porAluno={};
  frequenciasRelatorio.filter(r=>idsAlunosAtivos.has(Number(r.aluno_id))).forEach(r=>(porAluno[r.aluno_id]??=[]).push(r));
  const nomes=nomesAlunosRelatorio;
  const lista=Object.entries(porAluno).map(([id,v])=>({id,nome:nomes[id]||'Aluno',...metricasFrequencia(v)})).sort((a,b)=>a.pct-b.pct||a.nome.localeCompare(b.nome));
  const elF=el('frequenciaTurma');
  if(!elF)return;
  elF.innerHTML=lista.length?lista.map(x=>`<tr><td><strong>${escR(x.nome)}</strong></td><td>${x.pres}</td><td>${x.falt}</td><td>${x.just}</td><td><strong>${pct(x.pres+x.just,x.total)}</strong></td></tr>`).join(''):'<tr><td colspan="5" class="empty-cell">Nenhum registro de frequência encontrado.</td></tr>';
  const media=lista.length?lista.reduce((s,x)=>s+x.pct,0)/lista.length:0;
  el('rFrequencia').textContent=pct(media,100);
}

function destroyChart(chart){if(chart){try{chart.destroy();}catch(_){}}}

function renderGraficos(rows){
  if(typeof Chart==='undefined') return;
  const areas=agruparAreas(rows);
  const areaCanvas=el('graficoAreas'), faixaCanvas=el('graficoFaixas'), evolCanvas=el('graficoEvolucao');
  destroyChart(chartAreas); destroyChart(chartFaixas); destroyChart(chartEvolucao);

  chartAreas=new Chart(areaCanvas,{type:'bar',data:{labels:areas.map(x=>x.nome),datasets:[{label:'Aproveitamento',data:areas.map(x=>Number(x.m.p.toFixed(1))),borderWidth:0,borderRadius:7}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`}}},scales:{x:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'},grid:{color:'#edf2f7'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});

  const grupos={baixo:0,medio:0,alto:0,excelente:0};
  const alunos={};
  rows.forEach(r=>(alunos[r.aluno_id]??=[]).push(r));
  Object.values(alunos).forEach(v=>{const p=metricas(v).p;if(p<30)grupos.baixo++;else if(p<50)grupos.medio++;else if(p<70)grupos.alto++;else grupos.excelente++;});
  chartFaixas=new Chart(faixaCanvas,{type:'doughnut',data:{labels:['0–29%','30–49%','50–69%','70–100%'],datasets:[{data:Object.values(grupos),borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:10},padding:12}},tooltip:{callbacks:{label:c=>` ${c.label}: ${c.raw} aluno${c.raw===1?'':'s'}`}}}}});

  const apps={};
  rows.forEach(r=>{const key=r.simulado+'|'+r.dia;(apps[key]??=[]).push(r);});
  const lista=Object.entries(apps).map(([key,v])=>{const [sim,dia]=key.split('|');return {label:nomeSimulado(sim)+' — '+dia,p:metricas(v).p,ord:sim+'|'+dia};}).sort((a,b)=>a.ord.localeCompare(b.ord));
  chartEvolucao=new Chart(evolCanvas,{type:'line',data:{labels:lista.map(x=>x.label),datasets:[{label:'Aproveitamento',data:lista.map(x=>Number(x.p.toFixed(1))),tension:.3,pointRadius:5,pointHoverRadius:7,borderWidth:3,fill:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`}}},scales:{y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'},grid:{color:'#edf2f7'}},x:{grid:{display:false},ticks:{font:{size:10},maxRotation:35,minRotation:0}}}}});
}

function nomeSimulado(codigo){return simuladosRelatorio.find(s=>s.codigo===codigo)?.nome||codigo||'Simulado';}

function render(){
  const rows=filtros(), m=metricas(rows); const alunos=new Set(rows.map(r=>r.aluno_id));
  el('rAlunos').textContent=alunos.size; el('rRespostas').textContent=m.t; el('rAcertos').textContent=m.a; el('rAproveitamento').textContent=pct(m.a,m.t);
  renderResumoAplicacoes(rows); renderRanking(rows); renderFrequenciaRelatorio(); renderTempoMedioRelatorio(); renderAreas(rows); renderQuestoesCriticas(rows); renderDisciplinas(rows); renderGraficos(rows);
  const sim=el('filtroSimulado').value||'todos os simulados', dia=el('filtroDia').value||'todos os dias';
  el('reportStatus').textContent=`${alunos.size} alunos • ${rows.length} respostas • ${sim} • ${dia}`;
}

async function init(){
  try{
    const [s,r,a,fq,tp]=await Promise.all([db.from('simulados').select('id,codigo,nome').order('id'),buscarTodasRespostas(),db.from('alunos').select('id,nome,presente_na_aba_alunos'),db.from('frequencias').select('aluno_id,data_aula,status'),db.from('tempos_prova').select('aluno_id,simulado,dia,tempo_minutos')]);
    if(s.error||a.error||fq.error||tp.error)throw (s.error||a.error||fq.error||tp.error);
    idsAlunosAtivos=new Set((a.data||[]).filter(x=>x.presente_na_aba_alunos!==false).map(x=>Number(x.id)));
    frequenciasRelatorio=fq.data||[];
    temposRelatorio=tp.data||[];
    nomesAlunosRelatorio=Object.fromEntries((a.data||[]).map(x=>[Number(x.id),x.nome]));
    frequenciasRelatorio=fq.data||[];
    nomesAlunosRelatorio=Object.fromEntries((a.data||[]).map(x=>[Number(x.id),x.nome]));
    simuladosRelatorio=s.data||[]; todosRegistros=deduplicar((r||[]).filter(x=>idsAlunosAtivos.has(Number(x.aluno_id))));
    el('filtroSimulado').innerHTML='<option value="">Todos os simulados</option>'+simuladosRelatorio.map(s=>`<option value="${escR(s.codigo)}">${escR(s.nome)}</option>`).join('');
    el('filtroSimulado').addEventListener('change',render); el('filtroDia').addEventListener('change',render); el('btnAtualizar').addEventListener('click',render);
    render();
  }catch(e){console.error(e);el('reportStatus').textContent='Erro ao carregar os dados'; document.querySelectorAll('#resumoAplicacoes,#areasAprova,#questoesCriticas,#disciplinasRelatorio').forEach(x=>x.innerHTML='<div class="empty-state">Não foi possível carregar o relatório. Verifique a conexão com o Supabase.</div>');}
}
init();
