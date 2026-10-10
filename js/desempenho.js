let simulados=[], alunos=[], questoes=[], respostasAtuais=new Map();
const el=id=>document.getElementById(id);
const areasDia={
  'Dia 1':['Linguagens, Códigos e suas Tecnologias','Ciências Humanas e suas Tecnologias'],
  'Dia 2':['Ciências da Natureza e suas Tecnologias','Matemática e suas Tecnologias']
};
const escv=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function percentual(a,total){return total?((a/total)*100).toFixed(1).replace('.',',')+'%':'0%';}
async function init(){
  const [s,a]=await Promise.all([
    db.from('simulados').select('id,codigo,nome,data_dia1,data_dia2').order('id'),
    db.from('alunos').select('id,nome,presente_na_aba_alunos').eq('presente_na_aba_alunos',true).order('nome')
  ]);
  if(s.error||a.error){console.error(s.error||a.error);el('selectionMsg').textContent='Não foi possível carregar os dados.';return;}
  simulados=s.data||[]; alunos=a.data||[];
  el('simulado').innerHTML='<option value="">Selecione...</option>'+simulados.map(x=>`<option value="${x.id}">${escv(x.nome)} (${escv(x.codigo)})</option>`).join('');
  el('aluno').innerHTML='<option value="">Selecione...</option>'+alunos.map(x=>`<option value="${x.id}">${escv(x.nome)}</option>`).join('');
  el('simulado').addEventListener('change',async()=>{await carregarQuestoes(); await carregarHistorico();});
  el('dia').addEventListener('change',async()=>{await carregarQuestoes(); await carregarHistorico();});
  el('aluno').addEventListener('change',async()=>{await carregarResultadoAluno(); await carregarHistorico();});
  el('salvarResultado').addEventListener('click',salvarResultado);
  el('limparResultado').addEventListener('click',limparLancamento);
}
function simSelecionado(){return simulados.find(x=>String(x.id)===String(el('simulado').value));}
async function carregarQuestoes(){
  const s=simSelecionado(), dia=el('dia').value;
  if(!s){el('resultadoPanel').style.display='none';return;}
  const {data,error}=await db.from('questoes').select('id,numero,dia,area_enem,disciplina,area_aprova').eq('simulado',s.codigo).eq('dia',dia).order('numero');
  if(error){console.error(error);el('selectionMsg').textContent='Erro ao carregar as questões.';return;}
  questoes=data||[]; respostasAtuais=new Map(); renderQuestoes();
  if(el('aluno').value) await carregarResultadoAluno();
}
function renderQuestoes(){
  const s=simSelecionado();
  if(!s){el('resultadoPanel').style.display='none';return;}
  el('resultadoPanel').style.display='block';
  const nomeAluno=el('aluno').selectedOptions[0]?.text||'Aluno';
  el('tituloResultado').textContent=`${nomeAluno} • ${s.nome} • ${el('dia').value}`;
  el('subtituloResultado').textContent=`${questoes.length} questões mapeadas. Selecione Acerto, Erro ou Branco somente nas questões que o aluno realizou. Questões sem seleção não serão registradas nem contarão no resultado.`;
  if(!questoes.length){el('questoesResultado').innerHTML='<div class="empty-state">Nenhuma questão foi mapeada para este simulado e dia. Cadastre as questões em <b>Simulados → Questões</b>.</div>'; atualizarResumo();return;}
  el('questoesResultado').innerHTML=questoes.map((q,i)=>`<article class="result-question" data-qid="${q.id}"><div class="question-number">${String(q.numero).padStart(2,'0')}</div><div class="question-info"><strong>${escv(q.disciplina||'Disciplina não informada')}</strong><small>${escv(q.area_enem||'')} • ${escv(q.area_aprova||'')}</small></div><div class="result-buttons"><button type="button" class="result-btn correct" data-status="Acerto">✓ Acerto</button><button type="button" class="result-btn wrong" data-status="Erro">✕ Erro</button><button type="button" class="result-btn blank" data-status="Branco">○ Branco</button></div></article>`).join('');
  el('questoesResultado').querySelectorAll('.result-btn').forEach(btn=>btn.addEventListener('click',()=>{const row=btn.closest('.result-question'); const qid=Number(row.dataset.qid); const status=btn.dataset.status; if(respostasAtuais.get(qid)===status){respostasAtuais.delete(qid);}else{respostasAtuais.set(qid,status);} atualizarSelecao(row); atualizarResumo();}));
  aplicarMapaNaTela(); atualizarResumo();
}
function atualizarSelecao(row){const st=respostasAtuais.get(Number(row.dataset.qid)); row.querySelectorAll('.result-btn').forEach(b=>b.classList.toggle('selected',b.dataset.status===st));}
function aplicarMapaNaTela(){el('questoesResultado').querySelectorAll('.result-question').forEach(r=>atualizarSelecao(r));}
function atualizarResumo(){let a=0,e=0,b=0; respostasAtuais.forEach(v=>v==='Acerto'?a++:v==='Erro'?e++:b++); el('sumAcertos').textContent=a;el('sumErros').textContent=e;el('sumBrancos').textContent=b;el('sumPercent').textContent=percentual(a,a+e+b);}
async function carregarResultadoAluno(){
  const s=simSelecionado(), alunoId=el('aluno').value, dia=el('dia').value;
  if(!s||!alunoId||!questoes.length){if(!alunoId) respostasAtuais=new Map(); renderQuestoes();return;}
  const {data,error}=await db.from('respostas').select('id,aluno_id,questao_id,resultado').eq('aluno_id',alunoId).eq('simulado',s.codigo).eq('dia',dia).order('id');
  if(error){console.error(error);el('saveMsg').textContent='Erro ao carregar resultado salvo.';return;}
  respostasAtuais=new Map();(data||[]).forEach(r=>respostasAtuais.set(Number(r.questao_id),r.resultado));
  renderQuestoes();
}
async function salvarResultado(){
  const s=simSelecionado(), alunoId=Number(el('aluno').value), dia=el('dia').value;
  if(!s||!alunoId){el('saveMsg').textContent='Selecione o simulado e o aluno.';return;}
  if(!questoes.length){el('saveMsg').textContent='Não há questões para lançar.';return;}
  const h=el('tempoHoras').value, m=el('tempoMinutos').value;
  let totalTempo=null;
  if(h!==''||m!==''){totalTempo=(Number(h)||0)*60+(Number(m)||0);if(totalTempo<=0||Number(m)>59||Number(h)<0||Number(m)<0){el('saveMsg').textContent='Informe um tempo válido (minutos de 0 a 59).';return;}}
  el('saveMsg').textContent='Salvando...';
  const del=await db.from('respostas').delete().eq('aluno_id',alunoId).eq('simulado',s.codigo).eq('dia',dia);
  if(del.error){console.error(del.error);el('saveMsg').textContent='Não foi possível substituir o lançamento anterior. Execute o SQL de desempenho.';return;}
  const payload=questoes.filter(q=>respostasAtuais.has(Number(q.id))).map(q=>({aluno_id:alunoId,questao_id:q.id,questao:q.numero,resultado:respostasAtuais.get(Number(q.id)),dia,simulado:s.codigo}));
  if(payload.length){const ins=await db.from('respostas').insert(payload);if(ins.error){console.error(ins.error);el('saveMsg').textContent='Erro ao salvar as respostas.';return;}}
  if(totalTempo!==null){
    const td=await db.from('tempos_prova').delete().eq('aluno_id',alunoId).eq('simulado',s.codigo).eq('dia',dia);
    if(td.error){console.error(td.error);el('saveMsg').textContent='Respostas salvas, mas não foi possível atualizar o tempo.';return;}
    const tr=await db.from('tempos_prova').insert({aluno_id:alunoId,simulado:s.codigo,dia,tempo_minutos:totalTempo,origem:'lançamento no sistema'});
    if(tr.error){console.error(tr.error);el('saveMsg').textContent='Respostas salvas, mas não foi possível salvar o tempo.';return;}
  }
  el('saveMsg').textContent=`Resultado salvo: ${payload.length} questão(ões) registrada(s). Questões sem seleção foram deixadas fora do cálculo.`; await carregarHistorico();
}
function limparLancamento(){respostasAtuais=new Map();renderQuestoes();el('saveMsg').textContent='Lançamento limpo. Você ainda precisa salvar para alterar o banco.';}
async function carregarHistorico(){
  const s=simSelecionado(), alunoId=el('aluno').value, dia=el('dia').value;
  if(s&&alunoId){const tr=await db.from('tempos_prova').select('tempo_minutos').eq('aluno_id',alunoId).eq('simulado',s.codigo).eq('dia',dia).limit(1);if(!tr.error&&tr.data?.length){const n=Number(tr.data[0].tempo_minutos)||0;el('tempoHoras').value=Math.floor(n/60);el('tempoMinutos').value=n%60;}else{el('tempoHoras').value='';el('tempoMinutos').value='';}}
  if(!s||!alunoId){el('resumoAluno').style.display='none';return;}
  const {data,error}=await db.from('respostas').select('dia,resultado,questao_id').eq('aluno_id',alunoId).eq('simulado',s.codigo);
  if(error){console.error(error);return;}
  const grupos={};(data||[]).forEach(r=>{if(!grupos[r.dia])grupos[r.dia]={a:0,e:0,b:0,total:0};grupos[r.dia].total++;if(r.resultado==='Acerto')grupos[r.dia].a++;if(r.resultado==='Erro')grupos[r.dia].e++;if(r.resultado==='Branco')grupos[r.dia].b++;});
  const dias=['Dia 1','Dia 2'].filter(d=>grupos[d]);
  el('resumoAluno').style.display='block';
  el('historicoAluno').innerHTML=dias.length?dias.map(d=>{const g=grupos[d];return `<div class="history-result"><div><strong>${d}</strong><span>${g.total} respostas registradas</span></div><div class="history-metrics"><b class="good">${g.a} acertos</b><b class="bad">${g.e} erros</b><b class="neutral">${g.b} brancos</b><b>${percentual(g.a,g.total)}</b></div></div>`}).join(''):'<div class="empty-state">Nenhum resultado lançado para este aluno neste simulado.</div>';
}
init();
