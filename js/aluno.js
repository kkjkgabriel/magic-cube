let todasRespostas = [];
let todasQuestoesSimulados = [];
let chartAlunoAreasEnem = null;
let chartAlunoAreasAprova = null;
let chartAlunoResultados = null;
let chartAlunoEvolucao = null;
let frequenciasAluno = [];
const MESES_FREQ = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const AREAS_ENEM = [
  'Linguagens, Códigos e suas Tecnologias',
  'Ciências Humanas e suas Tecnologias',
  'Ciências da Natureza e suas Tecnologias',
  'Matemática e suas Tecnologias'
];

const AREA_CURTA = {
  'Linguagens, Códigos e suas Tecnologias': 'Linguagens',
  'Ciências Humanas e suas Tecnologias': 'Ciências Humanas',
  'Ciências da Natureza e suas Tecnologias': 'Ciências da Natureza',
  'Matemática e suas Tecnologias': 'Matemática'
};

async function carregarAluno(){
  const id = Number(new URLSearchParams(location.search).get('id'));
  if(!id) return;

  try {
    const {data: aluno, error: e1} = await db.from('alunos').select('id,nome').eq('id',id).single();
    if(e1) throw e1;

    document.getElementById('nomeAluno').textContent = aluno.nome;

    const {data, error} = await db
      .from('respostas')
      .select('resultado,dia,simulado,questao,questao_id,questoes(numero,area_enem,area_aprova,disciplina)')
      .eq('aluno_id',id);
    if(error) throw error;

    const {data: questoesSimulados, error: erroQuestoes} = await db
      .from('questoes')
      .select('id,numero,simulado,dia,tipo_prova')
      .order('simulado', {ascending:true})
      .order('dia', {ascending:true})
      .order('numero', {ascending:true});
    if(erroQuestoes) throw erroQuestoes;
    todasQuestoesSimulados = questoesSimulados || [];

    todasRespostas = (data || []).sort((a,b) => {
      const sa = String(a.simulado).localeCompare(String(b.simulado));
      if(sa !== 0) return sa;
      const da = String(a.dia).localeCompare(String(b.dia), undefined, {numeric:true});
      if(da !== 0) return da;
      return Number(a.questoes?.numero ?? a.questao ?? 0) - Number(b.questoes?.numero ?? b.questao ?? 0);
    });

    renderizarResumo();
    renderizarGraficos();
    renderizarAreas();
    renderizarDisciplinas();
    renderizarSimulados();
    renderizarQuestoes();
    await carregarFrequenciaAluno(id);
    document.getElementById('filtroResultado').addEventListener('change', renderizarQuestoes);
  } catch(e) {
    console.error(e);
    document.getElementById('nomeAluno').textContent = 'Erro ao carregar aluno';
    document.getElementById('resumoAluno').textContent = 'Não foi possível carregar os dados deste aluno.';
  }
}

function renderizarResumo(){
  const rows = todasRespostas;
  const ac = rows.filter(x=>x.resultado==='Acerto').length;
  const er = rows.filter(x=>x.resultado==='Erro').length;
  const br = rows.filter(x=>x.resultado==='Branco').length;
  const total = rows.length;
  const pct = n => total ? (n/total*100).toFixed(1)+'%' : '0,0%';

  setText('acertos', ac); setText('erros', er); setText('brancos', br);
  setText('aproveitamento', total ? (ac/total*100).toFixed(1)+'%' : '0,0%');
  setText('pctAcertos', pct(ac)); setText('pctErros', pct(er)); setText('pctBrancos', pct(br));

  const sims = new Set(rows.map(r=>`${r.simulado}|${r.dia}`));
  const alunosQuestoes = new Set(rows.map(r=>r.questao_id).filter(Boolean));
  setText('resumoAluno', `${total} respostas registradas em ${sims.size} etapa(s) de avaliação`);
  document.getElementById('participacaoResumo').innerHTML = `
    <div><strong>${sims.size}</strong><span>etapas avaliadas</span></div>
    <div><strong>${alunosQuestoes.size || total}</strong><span>questões identificadas</span></div>`;
}

function renderizarGraficos(){
  if(typeof Chart === 'undefined') return;

  const areaEnem = {};
  const areaAprova = {};
  const resultados = {Acerto:0, Erro:0, Branco:0};
  const aplicacoes = {};
  // A evolução é agrupada por simulado (não por dia). O total vem de questoes,
  // portanto inclui os dois dias mesmo quando o aluno só fez um ou nenhum.
  todasQuestoesSimulados.forEach(q=>{
    if(!q.simulado) return;
    if(!aplicacoes[q.simulado]) aplicacoes[q.simulado]={simulado:q.simulado,total:0,acertos:0};
    aplicacoes[q.simulado].total++;
  });

  todasRespostas.forEach(r=>{
    const resultado = r.resultado;
    if(resultados[resultado] !== undefined) resultados[resultado]++;

    const enem = r.questoes?.area_enem || 'Área não informada';
    if(!areaEnem[enem]) areaEnem[enem] = {total:0,acertos:0};
    areaEnem[enem].total++;
    if(resultado === 'Acerto') areaEnem[enem].acertos++;

    const aprova = r.questoes?.area_aprova || 'Área não informada';
    if(!areaAprova[aprova]) areaAprova[aprova] = {total:0,acertos:0};
    areaAprova[aprova].total++;
    if(resultado === 'Acerto') areaAprova[aprova].acertos++;

    if(resultado === 'Acerto' && aplicacoes[r.simulado]) aplicacoes[r.simulado].acertos++;
  });

  const ordenarAreasEnem = [...AREAS_ENEM, ...Object.keys(areaEnem).filter(a=>!AREAS_ENEM.includes(a))]
    .filter(a=>areaEnem[a]);
  const dadosEnem = ordenarAreasEnem.map(a=>({nome:AREA_CURTA[a] || a, p:areaEnem[a].total ? areaEnem[a].acertos/areaEnem[a].total*100 : 0}));

  const dadosAprova = Object.entries(areaAprova)
    .map(([nome,v])=>({nome,p:v.total ? v.acertos/v.total*100 : 0}))
    .sort((a,b)=>b.p-a.p);

  const dadosAplicacoes = Object.values(aplicacoes).filter(x=>x.total>0).sort((a,b)=>{
    const ordem={'jun/26':1,'ago/26':2,'set/26':3};
    return (ordem[a.simulado]||99)-(ordem[b.simulado]||99) || String(a.simulado).localeCompare(String(b.simulado));
  });

  const pct = v => Number(v.toFixed(1));
  const commonScales = {y:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'},grid:{color:'#edf2f7'}},x:{grid:{display:false},ticks:{font:{size:10}}}};

  destroyAlunoChart(chartAlunoAreasEnem);
  destroyAlunoChart(chartAlunoAreasAprova);
  destroyAlunoChart(chartAlunoResultados);
  destroyAlunoChart(chartAlunoEvolucao);

  const c1=document.getElementById('graficoAlunoAreasEnem');
  if(c1){
    chartAlunoAreasEnem=new Chart(c1,{type:'bar',data:{labels:dadosEnem.map(x=>x.nome),datasets:[{label:'Aproveitamento',data:dadosEnem.map(x=>pct(x.p)),borderWidth:0,borderRadius:7}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`}}},scales:{x:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'},grid:{color:'#edf2f7'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});
  }

  const c2=document.getElementById('graficoAlunoAreasAprova');
  if(c2){
    chartAlunoAreasAprova=new Chart(c2,{type:'bar',data:{labels:dadosAprova.map(x=>x.nome),datasets:[{label:'Aproveitamento',data:dadosAprova.map(x=>pct(x.p)),borderWidth:0,borderRadius:7}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`}}},scales:{x:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'},grid:{color:'#edf2f7'}},y:{grid:{display:false},ticks:{font:{size:10}}}}}});
  }

  const c3=document.getElementById('graficoAlunoResultados');
  if(c3){
    chartAlunoResultados=new Chart(c3,{type:'doughnut',data:{labels:['Acertos','Erros','Brancos'],datasets:[{data:[resultados.Acerto,resultados.Erro,resultados.Branco],borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'bottom',labels:{boxWidth:12,font:{size:10},padding:12}},tooltip:{callbacks:{label:c=>` ${c.label}: ${c.raw} questão${c.raw===1?'':'ões'}`}}}}});
  }

  const c4=document.getElementById('graficoAlunoEvolucao');
  if(c4){
    chartAlunoEvolucao=new Chart(c4,{type:'line',data:{labels:dadosAplicacoes.map(x=>formatSimulado(x.simulado).replace('Simulado — ','')),datasets:[{label:'Aproveitamento',data:dadosAplicacoes.map(x=>pct(x.total?x.acertos/x.total*100:0)),tension:.3,pointRadius:5,pointHoverRadius:7,borderWidth:3,fill:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.raw.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`}}},scales:commonScales}});
  }
}

function destroyAlunoChart(chart){if(chart){try{chart.destroy();}catch(_){}}}

function renderizarAreas(){
  const mapa = {};
  todasRespostas.forEach(r=>{
    const area = r.questoes?.area_enem || 'Área não informada';
    if(!mapa[area]) mapa[area] = {total:0,acertos:0,erros:0,brancos:0};
    mapa[area].total++;
    if(r.resultado==='Acerto') mapa[area].acertos++;
    if(r.resultado==='Erro') mapa[area].erros++;
    if(r.resultado==='Branco') mapa[area].brancos++;
  });

  const ordem = [...AREAS_ENEM, ...Object.keys(mapa).filter(a=>!AREAS_ENEM.includes(a))];
  const html = ordem.filter(a=>mapa[a]).map(area=>{
    const v = mapa[area], p = v.total ? v.acertos/v.total*100 : 0;
    return `<article class="area-card">
      <div class="area-card-head"><div><span class="area-index">${esc(AREA_CURTA[area] || area)}</span><h3>${esc(area)}</h3></div><strong>${p.toFixed(1)}%</strong></div>
      <div class="progress"><i style="width:${Math.max(0,Math.min(100,p))}%"></i></div>
      <div class="area-numbers"><span><b>${v.acertos}</b> acertos</span><span><b>${v.erros}</b> erros</span><span><b>${v.brancos}</b> brancos</span><span><b>${v.total}</b> questões</span></div>
    </article>`;
  }).join('');
  document.getElementById('areasEnem').innerHTML = html || empty('Nenhum dado de área disponível.');
}

function renderizarDisciplinas(){
  const mapa = {};
  todasRespostas.forEach(r=>{
    const disciplinas = normalizarDisciplinas(r.questoes?.disciplina);
    disciplinas.forEach(d=>{
      if(!mapa[d]) mapa[d] = {total:0,acertos:0,erros:0,brancos:0};
      mapa[d].total++;
      if(r.resultado==='Acerto') mapa[d].acertos++;
      if(r.resultado==='Erro') mapa[d].erros++;
      if(r.resultado==='Branco') mapa[d].brancos++;
    });
  });

  const arr = Object.entries(mapa).sort((a,b)=>b[1].total-a[1].total || a[0].localeCompare(b[0]));
  document.getElementById('disciplinas').innerHTML = arr.length ? arr.map(([nome,v])=>{
    const p=v.total ? v.acertos/v.total*100 : 0;
    return `<article class="discipline-card">
      <div class="discipline-title"><h3>${esc(nome)}</h3><strong>${p.toFixed(1)}%</strong></div>
      <div class="progress"><i style="width:${Math.max(0,Math.min(100,p))}%"></i></div>
      <div class="discipline-meta"><span>${v.acertos} acertos</span><span>${v.erros} erros</span><span>${v.brancos} brancos</span><span>${v.total} questões</span></div>
    </article>`;
  }).join('') : empty('Nenhum dado de disciplina disponível.');
}

function renderizarSimulados(){
  const mapa = {};
  todasRespostas.forEach(r=>{
    const key = `${r.simulado}|${r.dia}`;
    if(!mapa[key]) mapa[key]={simulado:r.simulado,dia:r.dia,total:0,acertos:0,erros:0,brancos:0};
    mapa[key].total++;
    if(r.resultado==='Acerto') mapa[key].acertos++;
    if(r.resultado==='Erro') mapa[key].erros++;
    if(r.resultado==='Branco') mapa[key].brancos++;
  });
  const arr = Object.values(mapa);
  document.getElementById('simulados').innerHTML = arr.length ? arr.map(v=>{
    const p=v.total ? v.acertos/v.total*100 : 0;
    return `<article class="simulado-card">
      <div class="simulado-card-title"><div><span>${esc(formatSimulado(v.simulado))}</span><h3>${esc(v.dia)}</h3></div><strong>${p.toFixed(1)}%</strong></div>
      <div class="simulado-stats"><div><b>${v.acertos}</b><span>Acertos</span></div><div><b>${v.erros}</b><span>Erros</span></div><div><b>${v.brancos}</b><span>Brancos</span></div><div><b>${v.total}</b><span>Registradas</span></div></div>
    </article>`;
  }).join('') : empty('Nenhum simulado registrado para este aluno.');
}

function renderizarQuestoes(){
  const filtro = document.getElementById('filtroResultado')?.value || 'todos';
  const rows = filtro==='todos' ? todasRespostas : todasRespostas.filter(r=>r.resultado===filtro);
  const grupos = {};
  rows.forEach(r=>{
    const key=`${r.simulado}|${r.dia}`;
    if(!grupos[key]) grupos[key]={simulado:r.simulado,dia:r.dia,rows:[]};
    grupos[key].rows.push(r);
  });
  const html = Object.values(grupos).map(g=>{
    const cards = g.rows.map(r=>{
      const n=r.questoes?.numero ?? r.questao ?? '—';
      const disciplina = r.questoes?.disciplina || 'Disciplina não informada';
      const area = AREA_CURTA[r.questoes?.area_enem] || r.questoes?.area_enem || 'Área não informada';
      return `<div class="question-result-card"><div class="question-result-number">${esc(n)}</div><div class="question-result-info"><strong>${esc(disciplina)}</strong><span>${esc(area)}</span></div><b class="result-badge ${resultClass(r.resultado)}">${esc(r.resultado)}</b></div>`;
    }).join('');
    return `<section class="question-group"><div class="question-group-head"><div><span>${esc(formatSimulado(g.simulado))}</span><h3>${esc(g.dia)}</h3></div><small>${g.rows.length} registro(s)</small></div><div class="question-result-list">${cards}</div></section>`;
  }).join('');
  document.getElementById('questoesResumo').innerHTML = html || empty('Nenhuma questão encontrada para o filtro selecionado.');
}

async function carregarFrequenciaAluno(alunoId){
  const {data,error}=await db.from('frequencias').select('id,aluno_id,data_aula,status,observacao,atualizado_em').eq('aluno_id',alunoId).order('data_aula');
  if(error){console.error(error);setText('frequenciaStatusAluno','Não foi possível carregar a frequência.');return;}
  frequenciasAluno=data||[];
  renderizarFrequenciaAluno();
}
function freqLabel(status){
  return status==='Presente'?'Presente':status==='Ausente'?'Falta':status==='Justificado'?'Falta justificada':status==='Desligado'?'Desligado':'Sem registro';
}
function freqClass(status){return String(status||'Sem registro').replace(/\s+/g,'-');}
function renderizarFrequenciaAluno(){
  const validos=frequenciasAluno.filter(r=>r.status!=='Sem registro'&&r.status!=='Desligado');
  const pres=frequenciasAluno.filter(r=>r.status==='Presente').length;
  const falt=frequenciasAluno.filter(r=>r.status==='Ausente').length;
  const just=frequenciasAluno.filter(r=>r.status==='Justificado').length;
  const total=pres+falt+just;
  const pct=total?((pres+just)/total*100).toFixed(1).replace('.',',')+'%':'0,0%';
  const resumo=document.getElementById('frequenciaResumoAluno');
  if(resumo) resumo.innerHTML=`<div class="frequency-stat"><span>Presenças</span><strong>${pres}</strong><small>dias marcados como presente</small></div><div class="frequency-stat"><span>Faltas</span><strong>${falt}</strong><small>faltas não justificadas</small></div><div class="frequency-stat"><span>Justificadas</span><strong>${just}</strong><small>faltas justificadas</small></div><div class="frequency-stat"><span>Frequência</span><strong>${pct}</strong><small>${total} dias com situação registrada</small></div>`;
  const topo=document.getElementById('participacaoResumo');
  if(topo){const anterior=topo.querySelector('[data-frequencia-topo]');if(anterior)anterior.remove();topo.insertAdjacentHTML('beforeend',`<div data-frequencia-topo><strong>${pct}</strong><span>frequência geral</span></div>`);}
  const cont=document.getElementById('frequenciaPorMes'); if(!cont)return;
  const grupos={};
  frequenciasAluno.forEach(r=>{const d=String(r.data_aula);const mes=d.slice(0,7);(grupos[mes]??=[]).push(r);});
  const meses=Object.keys(grupos).sort();
  cont.innerHTML=meses.length?meses.map(m=>{
    const rows=grupos[m].sort((a,b)=>String(a.data_aula).localeCompare(String(b.data_aula)));
    const [ano,mm]=m.split('-'); const nomeMes=MESES_FREQ[Number(mm)-1]||mm;
    const p=rows.filter(r=>r.status==='Presente').length, f=rows.filter(r=>r.status==='Ausente').length, j=rows.filter(r=>r.status==='Justificado').length;
    const body=rows.map(r=>`<tr><td>${formatarDataFreq(r.data_aula)}</td><td><select class="frequency-status status-${freqClass(r.status)}" data-freq-id="${r.id}"><option value="Presente" ${r.status==='Presente'?'selected':''}>Presente</option><option value="Ausente" ${r.status==='Ausente'?'selected':''}>Falta</option><option value="Justificado" ${r.status==='Justificado'?'selected':''}>Falta justificada</option><option value="Sem registro" ${r.status==='Sem registro'?'selected':''}>Sem registro</option><option value="Desligado" ${r.status==='Desligado'?'selected':''}>Desligado</option></select></td><td><input class="frequency-observation" data-obs-id="${r.id}" value="${esc(r.observacao||'')}" placeholder="Observação (opcional)"></td><td><button class="btn secondary small frequency-save" data-save-id="${r.id}" type="button">Salvar</button></td></tr>`).join('');
    return `<div class="frequency-month"><div class="frequency-month-head"><div><h3>${nomeMes} de ${ano}</h3><span>${rows.length} dias registrados</span></div><span>🟢 ${p} &nbsp; 🔴 ${f} &nbsp; 🟡 ${j}</span></div><div style="overflow:auto"><table class="frequency-table"><thead><tr><th>Data</th><th>Situação</th><th>Observação</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>`;
  }).join(''):'<div class="empty-state">Nenhum registro de frequência encontrado para este aluno.</div>';
  cont.querySelectorAll('.frequency-save').forEach(btn=>btn.addEventListener('click',()=>salvarFrequenciaIndividual(Number(btn.dataset.saveId))));
  cont.querySelectorAll('.frequency-status').forEach(s=>s.addEventListener('change',()=>s.className='frequency-status status-'+freqClass(s.value)));
}
async function salvarFrequenciaIndividual(id){
  const select=document.querySelector(`[data-freq-id="${id}"]`); const obs=document.querySelector(`[data-obs-id="${id}"]`);
  if(!select)return;
  const {error}=await db.from('frequencias').update({status:select.value,observacao:obs?.value?.trim()||null,atualizado_em:new Date().toISOString()}).eq('id',id);
  if(error){console.error(error);setText('frequenciaStatusAluno','Erro ao salvar a frequência.');return;}
  const row=frequenciasAluno.find(x=>Number(x.id)===id); if(row){row.status=select.value;row.observacao=obs?.value?.trim()||null;}
  setText('frequenciaStatusAluno','Frequência atualizada.'); renderizarFrequenciaAluno();
  setTimeout(()=>setText('frequenciaStatusAluno',''),2500);
}
function formatarDataFreq(v){const [a,m,d]=String(v).split('-');return `${d}/${m}/${a}`;}
function normalizarDisciplinas(v){
  if(!v) return ['Sem disciplina'];
  return String(v).split('/').map(x=>x.trim()).filter(Boolean);
}
function formatSimulado(v){
  const s=String(v||'');
  if(s==='jun/26') return 'Simulado — Junho 2026';
  if(s==='ago/26') return 'Simulado — Agosto 2026';
  if(s==='set/26') return 'Simulado — Setembro 2026';
  return s;
}
function resultClass(v){return v==='Acerto'?'result-ok':v==='Erro'?'result-bad':'result-blank';}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function empty(msg){return `<div class="empty-state">${esc(msg)}</div>`;}
function esc(v){return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

carregarAluno();
