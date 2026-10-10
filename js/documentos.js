let alunos=[],simulados=[],questoes=[],respostas=[],frequencias=[],temposProva=[];
const $=id=>document.getElementById(id);
const pct=(a,t)=>t?((a/t)*100).toFixed(1).replace('.',',')+'%':'0,0%';
const nomeSim=c=>simulados.find(s=>s.codigo===c)?.nome||c||'Simulado';
function norm(rows){return rows.filter(r=>alunos.some(a=>Number(a.id)===Number(r.aluno_id)&&a.presente_na_aba_alunos!==false));}
function metric(rows){let a=0,e=0,b=0;rows.forEach(r=>r.resultado==='Acerto'?a++:r.resultado==='Erro'?e++:b++);return {a,e,b,t:a+e+b,p:pct(a,a+e+b)};}
function freqMetric(id){const rows=frequencias.filter(r=>Number(r.aluno_id)===Number(id)&&!['Sem registro','Desligado'].includes(r.status));const p=rows.filter(r=>r.status==='Presente').length,j=rows.filter(r=>r.status==='Justificado').length,f=rows.filter(r=>r.status==='Ausente').length;return {p,j,f,t:p+j+f,percent:pct(p+j,p+j+f)};}
function studentRows(id){return respostas.filter(r=>Number(r.aluno_id)===Number(id));}
function enriched(){return respostas.map(r=>({...r,q:questoes.find(q=>Number(q.id)===Number(r.questao_id))||{numero:r.questao,disciplina:'',area_enem:'',area_aprova:''},aluno:alunos.find(a=>Number(a.id)===Number(r.aluno_id))}));}
function groupArea(rows,key='area_aprova'){const g={};rows.forEach(r=>{const n=r.q?.[key]||'Sem área';(g[n]??=[]).push(r);});return Object.entries(g).map(([nome,v])=>({nome,m:metric(v)})).sort((a,b)=>b.m.a/(b.m.t||1)-a.m.a/(a.m.t||1));}
function groupDisc(rows){const g={};rows.forEach(r=>{const n=r.q?.disciplina||'Sem disciplina';(g[n]??=[]).push(r);});return Object.entries(g).map(([nome,v])=>({nome,m:metric(v)})).sort((a,b)=>a.m.a/(a.m.t||1)-b.m.a/(b.m.t||1));}

function chartBars(title, labels, values, maxValue=100){
  // Gráfico construído com tabelas e células coloridas: Word/WPS preservam esse formato
  // ao contrário de SVG ou imagens data-URI em documentos .doc baseados em HTML.
  const max=Math.max(maxValue,...values.map(Number),1);
  const rows=labels.map((label,i)=>{
    const v=Math.max(0,Number(values[i])||0), w=Math.max(0,Math.min(100,v/max*100));
    return `<tr style="page-break-inside:avoid"><td style="width:32%;padding:5px 8px;border:0;font-size:10pt">${esc(label)}</td><td style="width:58%;padding:5px 0;border:0"><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse"><tr><td style="background:#edf2f7;height:16px;padding:0;border:0"><table cellpadding="0" cellspacing="0" style="width:${w}%;border-collapse:collapse"><tr><td style="background:#147fa8;height:16px;padding:0;border:0;font-size:1px">&nbsp;</td></tr></table></td></tr></table></td><td style="width:10%;padding:5px 6px;border:0;font-size:10pt;text-align:right">${v.toFixed(1).replace('.',',')}%</td></tr>`;
  }).join('');
  return `<section class="chart-block" style="margin:18px 0 24px;page-break-inside:avoid"><h2>${esc(title)}</h2><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:0"><tbody>${rows}</tbody></table></section>`;
}
function chartFromGroups(title, groups){return chartBars(title,groups.map(x=>x.nome),groups.map(x=>parseFloat(x.m?.p)||0));}
function chartMinutes(title,labels,values){const max=Math.max(1,...values.map(Number));const rows=labels.map((label,i)=>{const v=Number(values[i])||0,w=Math.max(0,Math.min(100,v/max*100));return `<tr style="page-break-inside:avoid"><td style="width:32%;padding:5px 8px;border:0;font-size:10pt">${esc(label)}</td><td style="width:58%;padding:5px 0;border:0"><table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse"><tr><td style="background:#edf2f7;height:16px;padding:0;border:0"><table cellpadding="0" cellspacing="0" style="width:${w}%;border-collapse:collapse"><tr><td style="background:#147fa8;height:16px;padding:0;border:0;font-size:1px">&nbsp;</td></tr></table></td></tr></table></td><td style="width:10%;padding:5px 6px;border:0;font-size:10pt;text-align:right">${fmtTempo(v)}</td></tr>`;}).join('');return `<section class="chart-block"><h2>${esc(title)}</h2><table style="width:100%;border-collapse:collapse;border:0"><tbody>${rows}</tbody></table></section>`;}

function mostMissed(rows,limit=10){const g={};rows.forEach(r=>{const n=r.q?.numero??r.questao??'?';const k=[r.simulado,r.dia,n].join('|');(g[k]??=[]).push(r);});return Object.entries(g).map(([k,v])=>{const [sim,dia,q]=k.split('|');const m=metric(v);return {sim,dia,q,m,disc:v[0].q?.disciplina||'',area:v[0].q?.area_aprova||''};}).sort((a,b)=>(b.m.e/(b.m.t||1))-(a.m.e/(a.m.t||1))||b.m.e-a.m.e).slice(0,limit);}
function fmtTempo(n){n=Number(n)||0;return `${Math.floor(n/60)}h ${n%60}min`;}
function tempoRows(id=null,sim=null){return temposProva.filter(t=>(id==null||Number(t.aluno_id)===Number(id))&&(!sim||t.simulado===sim));}
function tempoStats(rows){const vals=rows.map(x=>Number(x.tempo_minutos)).filter(x=>x>0);if(!vals.length)return null;return {avg:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length),min:Math.min(...vals),max:Math.max(...vals),count:vals.length};}
function studentReport(id, exportMode=false){const a=alunos.find(x=>Number(x.id)===Number(id));const rows=enriched().filter(r=>Number(r.aluno_id)===Number(id));const m=metric(rows);const fq=freqMetric(id);const areas=groupArea(rows),discs=groupDisc(rows);const sims={};rows.forEach(r=>{const k=r.simulado+'|'+r.dia;(sims[k]??=[]).push(r);});const tempos=tempoRows(id);const resumo=`<h1>APROVA ICET — RELATÓRIO DE DESEMPENHO</h1><h2>${esc(a?.nome||'Aluno')}</h2><p><b>Desempenho geral:</b> ${m.p} &nbsp; <b>Acertos:</b> ${m.a} &nbsp; <b>Erros:</b> ${m.e} &nbsp; <b>Brancos:</b> ${m.b} &nbsp; <b>Questões:</b> ${m.t}</p>`;if(!exportMode)return `${resumo}<h2>Frequência</h2><p>Presenças: ${fq.p} | Faltas: ${fq.f} | Justificadas: ${fq.j} | Total: ${fq.t} | Frequência: <b>${fq.percent}</b></p><h2>Desempenho por área do Aprova ICET</h2>${table(['Área','Acertos','Erros','Brancos','Questões','Desempenho'],areas.map(x=>[x.nome,x.m.a,x.m.e,x.m.b,x.m.t,x.m.p]))}<h2>Desempenho por disciplina</h2>${table(['Disciplina','Acertos','Erros','Brancos','Questões','Desempenho'],discs.map(x=>[x.nome,x.m.a,x.m.e,x.m.b,x.m.t,x.m.p]))}${chartFromGroups('Desempenho por área',areas)}${chartFromGroups('Desempenho por disciplina',discs)}<h2>Desempenho por simulado e dia</h2>${table(['Simulado','Dia','Acertos','Erros','Brancos','Questões','Desempenho'],Object.entries(sims).map(([k,v])=>{const [s,d]=k.split('|'),m=metric(v);return[nomeSim(s),d,m.a,m.e,m.b,m.t,m.p]}))}<h2>Análise de tempo de prova</h2>${tempoStats(tempos)?`<p>Tempo médio: ${fmtTempo(tempoStats(tempos).avg)} • Menor: ${fmtTempo(tempoStats(tempos).min)} • Maior: ${fmtTempo(tempoStats(tempos).max)}</p>`:'<p>Não há tempos registrados.</p>'}${table(['Simulado','Dia','Tempo'],tempos.map(t=>[nomeSim(t.simulado),t.dia,fmtTempo(t.tempo_minutos)]))}`;return `${resumo}<h2>Desempenho médio por área</h2>${table(['Área','Desempenho'],areas.map(x=>[x.nome,x.m.p]))}${chartFromGroups('Gráfico de desempenho por área',areas)}<h2>Análise de tempo de prova</h2>${tempoStats(tempos)?`<p>Tempo médio: ${fmtTempo(tempoStats(tempos).avg)} • Menor: ${fmtTempo(tempoStats(tempos).min)} • Maior: ${fmtTempo(tempoStats(tempos).max)}</p>`:'<p>Não há tempos registrados.</p>'}${table(['Simulado','Dia','Tempo'],tempos.map(t=>[nomeSim(t.simulado),t.dia,fmtTempo(t.tempo_minutos)]))}<h2>Desempenho por simulado</h2>${table(['Simulado','Dia','Acertos','Erros','Brancos','Total','Desempenho'],Object.entries(sims).map(([k,v])=>{const [s,d]=k.split('|'),z=metric(v);return[nomeSim(s),d,z.a,z.e,z.b,z.t,z.p]}))}`;}
function classReport(exportMode=false){const rows=enriched();const active=alunos.filter(a=>a.presente_na_aba_alunos!==false);const groups={};rows.forEach(r=>{const k=r.simulado+'|'+r.dia;(groups[k]??=[]).push(r);});const apps=Object.entries(groups).map(([k,v])=>{const [s,d]=k.split('|');return[nomeSim(s),d,new Set(v.map(r=>r.aluno_id)).size,metric(v).a,metric(v).e,metric(v).b,metric(v).t,metric(v).p]});const rank=active.map(a=>{const m=metric(rows.filter(r=>Number(r.aluno_id)===Number(a.id)));return[a.nome,m.a,m.e,m.b,m.t,m.p]}).filter(x=>x[4]).sort((a,b)=>parseFloat(b[5])-parseFloat(a[5]));const area=groupArea(rows);const ts=tempoStats(temposProva);const tempoSec=`<h2>Análise de tempo de prova</h2>${ts?`<p>Alunos com tempo: ${ts.count} • Média: ${fmtTempo(ts.avg)} • Menor: ${fmtTempo(ts.min)} • Maior: ${fmtTempo(ts.max)}</p>`:'<p>Não há tempos registrados.</p>'}${chartMinutes('Tempo médio por aluno',alunos.filter(a=>temposProva.some(t=>Number(t.aluno_id)===Number(a.id))).map(a=>a.nome),alunos.filter(a=>temposProva.some(t=>Number(t.aluno_id)===Number(a.id))).map(a=>Math.round(tempoStats(tempoRows(a.id))?.avg||0)))}`;const head=`<h1>APROVA ICET — RELATÓRIO DA TURMA</h1><p><b>Alunos:</b> ${active.length} &nbsp; <b>Aproveitamento geral:</b> ${metric(rows).p}</p>`;if(exportMode)return `${head}${tempoSec}<h2>Desempenho médio por área</h2>${table(['Área','Aproveitamento'],area.map(x=>[x.nome,x.m.p]))}${chartFromGroups('Gráfico de desempenho da turma',area)}<h2>Ranking — aproveitamento</h2>${table(['Aluno','Aproveitamento'],rank.slice(0,15).map(x=>[x[0],x[5]]))}`;return `${head}${tempoSec}<h2>Aplicações</h2>${table(['Simulado','Dia','Alunos','Acertos','Erros','Brancos','Questões','Aproveitamento'],apps)}<h2>Ranking da turma</h2>${table(['Aluno','Acertos','Erros','Brancos','Questões','Aproveitamento'],rank)}<h2>Média por área Aprova ICET</h2>${table(['Área','Acertos','Erros','Brancos','Questões','Aproveitamento'],area.map(x=>[x.nome,x.m.a,x.m.e,x.m.b,x.m.t,x.m.p]))}${chartFromGroups('Desempenho médio por área',area)}<h2>Desempenho geral dos alunos</h2>${chartBars('Ranking — aproveitamento',rank.slice(0,15).map(x=>x[0]),rank.slice(0,15).map(x=>parseFloat(x[5])||0))}`;}
function allStudents(exportMode=false){return alunos.filter(a=>a.presente_na_aba_alunos!==false&&respostas.some(r=>Number(r.aluno_id)===Number(a.id))).map(a=>studentReport(a.id,exportMode)).join('<div class="page-break"></div>');}
function areaReport(area,sim,exportMode=false){let rows=enriched().filter(r=>r.q?.area_aprova===area&&(!sim||r.simulado===sim));const rank=alunos.filter(a=>a.presente_na_aba_alunos!==false).map(a=>{const m=metric(rows.filter(r=>Number(r.aluno_id)===Number(a.id)));return[a.nome,m.a,m.e,m.b,m.t,m.p]}).filter(x=>x[4]).sort((a,b)=>parseFloat(b[5])-parseFloat(a[5]));const q=mostMissed(rows);const title=`<h1>APROVA ICET — ANÁLISE POR ÁREA</h1><h2>${esc(area)}${sim?' — '+esc(nomeSim(sim)):''}</h2><p><b>Média da área:</b> ${pct(rows.filter(r=>r.resultado==='Acerto').length,rows.length)}</p>`;if(exportMode)return `${title}${chartBars('Desempenho dos alunos na área',rank.slice(0,15).map(x=>x[0]),rank.slice(0,15).map(x=>parseFloat(x[5])||0))}<h2>Questões mais erradas</h2>${table(['Questão','Disciplina','Erros','% erro'],q.map(x=>[x.q,x.disc,x.m.e,pct(x.m.e,x.m.t)]))}`;return `${title}<h2>Ranking</h2>${table(['Aluno','Acertos','Erros','Brancos','Questões','Desempenho'],rank)}<h2>Questões mais erradas</h2>${table(['Questão','Simulado','Dia','Disciplina','Erros','Total','% erro'],q.map(x=>[x.q,nomeSim(x.sim),x.dia,x.disc,x.m.e,x.m.t,pct(x.m.e,x.m.t)]))}${chartBars('Desempenho dos alunos na área',rank.slice(0,15).map(x=>x[0]),rank.slice(0,15).map(x=>parseFloat(x[5])||0))}`;}
function areaComparative(area){const sims=simulados.map(s=>s.codigo).filter(s=>enriched().some(r=>r.q?.area_aprova===area&&r.simulado===s));const rows=sims.map(s=>{const v=enriched().filter(r=>r.q?.area_aprova===area&&r.simulado===s);return[nomeSim(s),v.length,metric(v).a,metric(v).e,metric(v).b,metric(v).p]});return `<h1>APROVA ICET — COMPARATIVO DE ÁREA</h1><h2>${esc(area)}</h2>${table(['Simulado','Questões','Acertos','Erros','Brancos','Aproveitamento'],rows)}${chartBars('Evolução do aproveitamento',rows.map(x=>x[0]),rows.map(x=>parseFloat(x[5])||0))}`;}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function wrap(title,body){return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:28px;font-size:11px}h1{font-size:20px;margin:0 0 8px}h2{font-size:14px;margin:22px 0 8px;border-bottom:1px solid #dce4ee;padding-bottom:4px}p{line-height:1.5}.chart-block{margin:18px 0 24px;page-break-inside:avoid}.chart-block svg{max-width:100%;height:auto}.chart-block h2{margin-bottom:10px}table{width:100%;border-collapse:collapse;margin:8px 0 14px}th,td{border:1px solid #dce4ee;padding:6px;text-align:left}th{background:#edf5fa}.page-break{page-break-before:always}@media print{body{margin:15mm}.page-break{page-break-before:always}}</style></head><body>${body}<p style="margin-top:30px;font-size:9px;color:#64748b">Aprova ICET • Relatório gerado pelo sistema web</p></body></html>`;}
async function downloadDoc(title,body){
  // Os gráficos são tabelas HTML com barras coloridas, compatíveis com Word/WPS.
  const source=wrap(title,body);
  const parsed=new DOMParser().parseFromString(source,'text/html');
  const exportBody=parsed.body;
  const style=parsed.head.querySelector('style')?.textContent||'';
  const finalHtml=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${style}
  body{font-family:Arial,sans-serif;color:#172033;background:#fff;margin:24px;font-size:11pt}
  h1{text-align:center;font-size:22pt;margin:24pt 0 8pt}h2{font-size:14pt;margin:16pt 0 8pt;color:#17365d}
  table{page-break-inside:auto}tr{page-break-inside:avoid}img{page-break-inside:avoid}
  .page-break{break-before:page;page-break-before:always}
  @page{size:A4;margin:1.5cm}
  </style></head><body>${exportBody.innerHTML}</body></html>`;
  const blob=new Blob(['\ufeff',finalHtml],{type:'application/msword;charset=utf-8'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=title.replace(/[^a-z0-9áéíóúãõç -]/gi,'_')+'.doc';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function show(title,body){$('previewTitle').textContent=title;$('docPreview').innerHTML=wrap(title,body);$('docMsg').textContent='Prévia gerada. Você pode baixar pelo botão correspondente ou imprimir.';}
function currentArea(){return $('docArea').value;}
function currentSim(){return $('docSimulado').value;}
function csvDisc(){const rows=enriched();const d=groupDisc(rows);const csv=[['Disciplina','Acertos','Erros','Brancos','Questões','Aproveitamento'],...d.map(x=>[x.nome,x.m.a,x.m.e,x.m.b,x.m.t,x.m.p.replace('%','')])].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');const b=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='desempenho_por_disciplina.csv';a.click();}
function withTimeout(promise, ms, label){
  return Promise.race([promise, new Promise((_, reject)=>setTimeout(()=>reject(new Error(`Tempo esgotado ao carregar ${label}. Verifique a conexão e as permissões do Supabase.`)), ms))]);
}
function setDocStatus(message, error=false){
  const el=$('docStatus'); el.textContent=message; el.classList.toggle('error',!!error);
}
async function init(){
  const started=Date.now();
  setDocStatus('Conectando ao Supabase…');
  $('docMsg').textContent='';
  try{
    // Carrega primeiro os dados leves para liberar os filtros rapidamente.
    const [a,s]=await withTimeout(Promise.all([
      db.from('alunos').select('id,nome,presente_na_aba_alunos').order('nome'),
      db.from('simulados').select('id,codigo,nome').order('id')
    ]),20000,'alunos e simulados');
    if(a.error) throw a.error; if(s.error) throw s.error;
    alunos=a.data||[]; simulados=s.data||[];
    $('docAluno').innerHTML='<option value="">Selecione um aluno</option>'+alunos.filter(x=>x.presente_na_aba_alunos!==false).map(x=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('');
    $('docSimulado').innerHTML='<option value="">Todos os simulados</option>'+simulados.map(x=>`<option value="${esc(x.codigo)}">${esc(x.nome)}</option>`).join('');
    setDocStatus('Filtros carregados • buscando respostas e questões…');

    const [q,r,f,tp]=await withTimeout(Promise.all([
      fetchAll('questoes','id,numero,simulado,dia,area_enem,disciplina,area_aprova'),
      fetchAll('respostas','id,aluno_id,questao_id,questao,resultado,dia,simulado'),
      fetchAll('frequencias','id,aluno_id,data_aula,status,observacao'),
      fetchAll('tempos_prova','id,aluno_id,simulado,dia,tempo_minutos')
    ]),60000,'questões, respostas e frequências');
    questoes=q; respostas=r; frequencias=f; temposProva=tp;
    const areas=[...new Set(questoes.map(x=>x.area_aprova).filter(Boolean))].sort();
    $('docArea').innerHTML='<option value="">Selecione uma área</option>'+areas.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
    $('docStatus').classList.remove('error');
    setDocStatus(`${alunos.length} alunos • ${respostas.length} respostas • ${questoes.length} questões • ${frequencias.length} frequências • ${temposProva.length} tempos • pronto em ${((Date.now()-started)/1000).toFixed(1)}s`);
    $('btnIndividual').onclick=()=>{const id=Number($('docAluno').value);if(!id){$('docMsg').textContent='Selecione um aluno.';return;}const body=studentReport(id);show('Relatório individual',body);downloadDoc('Relatorio - '+(alunos.find(x=>Number(x.id)===id)?.nome||'Aluno'),studentReport(id,true));};
    $('btnTurma').onclick=()=>{const body=classReport();show('Relatório da turma',body);downloadDoc('Relatorio da Turma',classReport(true));};
    $('btnTodos').onclick=()=>{const body=allStudents();show('Relatório de todos os alunos',body);downloadDoc('Relatorio Geral - Todos os Alunos',allStudents(true));};
    $('btnArea').onclick=()=>{const area=currentArea();if(!area){$('docMsg').textContent='Selecione uma área.';return;}const body=areaReport(area,currentSim());show('Relatório por área',body);downloadDoc('Relatorio - '+area,areaReport(area,currentSim(),true));};
    $('btnAreaComparativo').onclick=()=>{const area=currentArea();if(!area){$('docMsg').textContent='Selecione uma área.';return;}const body=areaComparative(area);show('Comparativo da área',body);downloadDoc('Comparativo - '+area,body);};
    $('btnDisciplinas').onclick=csvDisc;
    $('btnImprimir').onclick=()=>{if(!$('docPreview').querySelector('body')){$('docMsg').textContent='Gere uma prévia primeiro.';return;}const w=window.open('','_blank');if(!w){$('docMsg').textContent='Permita pop-ups para imprimir.';return;}w.document.write($('docPreview').innerHTML);w.document.close();w.focus();setTimeout(()=>w.print(),300);};
  }catch(e){
    console.error('Documentos: falha ao carregar',e);
    setDocStatus('Falha ao carregar dados',true);
    $('docMsg').textContent=`Não foi possível carregar os dados: ${e?.message||e}. Confira a conexão do Supabase, a chave e as permissões de leitura (RLS).`;
  }
}
async function fetchAll(table,fields){const out=[];let from=0;while(true){const {data,error}=await db.from(table).select(fields).order('id',{ascending:true}).range(from,from+999);if(error)throw error;const x=data||[];out.push(...x);if(x.length<1000)break;from+=1000;}return out;}
init();
