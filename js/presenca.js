let alunos=[],frequencias={},dataSelecionada='',historicoDatas=[];
let totalRegistrosFrequencia=0;
const hoje=new Date();
const pad=n=>String(n).padStart(2,'0');
const hojeISO=`${hoje.getFullYear()}-${pad(hoje.getMonth()+1)}-${pad(hoje.getDate())}`;
dataAula.value=hojeISO;

async function init(){
  const diag=document.getElementById('diagnosticoFrequencia');
  if(diag) diag.textContent='Conectando ao Supabase...';
  const {data,error}=await db.from('alunos').select('id,nome,presente_na_aba_alunos').eq('presente_na_aba_alunos',true).order('nome');
  if(error){msg.textContent='Erro ao carregar alunos.';return}
  alunos=data||[];
  await carregarData(dataAula.value);
  const {count,error:countError}=await db.from('frequencias').select('id',{count:'exact',head:true});
  if(countError){
    if(diag) diag.textContent='⚠️ Alunos carregados, mas não foi possível consultar a tabela de frequência: '+(countError.message||'erro');
  }else{
    totalRegistrosFrequencia=count||0;
    if(diag) diag.textContent=`✓ Supabase conectado • ${alunos.length} alunos ativos • ${totalRegistrosFrequencia} registros de frequência no banco`;
  }
  await carregarHistorico();
}

async function carregarData(data){
  dataSelecionada=data; frequencias={}; msg.textContent='';
  if(!data){lista.innerHTML=''; resumoPresenca.textContent='Selecione uma data.';return}
  const {data:rows,error}=await db.from('frequencias').select('aluno_id,status,observacao').eq('data_aula',data);
  if(error){console.error(error);msg.textContent='Erro ao consultar public.frequencias: '+(error.message||'verifique RLS e conexão com o Supabase.');lista.innerHTML='';return}
  (rows||[]).forEach(r=>frequencias[r.aluno_id]={status:r.status,observacao:r.observacao||''});
  render(alunos);
}

function resumo(){
  const p=alunos.filter(a=>frequencias[a.id]?.status==='Presente').length;
  const j=alunos.filter(a=>frequencias[a.id]?.status==='Justificado').length;
  const au=alunos.filter(a=>frequencias[a.id]?.status==='Ausente').length;
  const s=p+j+au;
  resumoPresenca.textContent=`${p} presentes • ${au} ausentes • ${j} justificados${s?` • ${s} de ${alunos.length} registrados`:''}`;
}

function render(list){
  resumo();
  lista.innerHTML=list.map(a=>{
    const status=frequencias[a.id]?.status||'';
    return `<div class="attendance-row frequency-row"><div class="student-name">${esc(a.nome)}</div><div class="status-buttons" data-id="${a.id}"><button class="status-btn present ${status==='Presente'?'selected':''}" data-status="Presente">Presente</button><button class="status-btn absent ${status==='Ausente'?'selected':''}" data-status="Ausente">Ausente</button><button class="status-btn justified ${status==='Justificado'?'selected':''}" data-status="Justificado">Justificado</button></div></div>`;
  }).join('')||'<p class="muted">Nenhum aluno encontrado.</p>';
  lista.querySelectorAll('.status-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const id=Number(btn.parentElement.dataset.id); frequencias[id]={...(frequencias[id]||{}),status:btn.dataset.status}; renderFiltered();
  }));
}
function renderFiltered(){const t=norm(busca.value);render(alunos.filter(a=>norm(a.nome).includes(t)))}

busca.addEventListener('input',renderFiltered);
dataAula.addEventListener('change',()=>carregarData(dataAula.value));
if(filtroMes) filtroMes.addEventListener('change',()=>renderHistoricoFiltro());
marcarPresentes.onclick=()=>{alunos.forEach(a=>frequencias[a.id]={...(frequencias[a.id]||{}),status:'Presente'});renderFiltered()};
marcarAusentes.onclick=()=>{alunos.forEach(a=>frequencias[a.id]={...(frequencias[a.id]||{}),status:'Ausente'});renderFiltered()};

salvar.onclick=async()=>{
  if(!dataSelecionada){msg.textContent='Selecione uma data.';return}
  const rows=alunos.filter(a=>frequencias[a.id]?.status).map(a=>({aluno_id:a.id,data_aula:dataSelecionada,status:frequencias[a.id].status,observacao:frequencias[a.id].observacao||null,atualizado_em:new Date().toISOString()}));
  if(!rows.length){msg.textContent='Marque pelo menos um aluno.';return}
  msg.textContent='Salvando...';
  const {error}=await db.from('frequencias').upsert(rows,{onConflict:'aluno_id,data_aula'});
  if(error){console.error(error);msg.textContent='Erro ao salvar. Verifique o SQL de frequência.';return}
  msg.textContent='Frequência salva com sucesso!'; await carregarHistorico();
};

async function carregarHistorico(){
  const {data,error}=await db.from('frequencias').select('data_aula,status').order('data_aula',{ascending:false});
  if(error){historico.innerHTML='<p class="muted">Não foi possível carregar o histórico.</p>';return}
  const mapa={};(data||[]).forEach(r=>{if(!mapa[r.data_aula])mapa[r.data_aula]={p:0,a:0,j:0,s:0,d:0};if(r.status==='Presente')mapa[r.data_aula].p++;if(r.status==='Ausente')mapa[r.data_aula].a++;if(r.status==='Justificado')mapa[r.data_aula].j++;if(r.status==='Sem registro')mapa[r.data_aula].s++;if(r.status==='Desligado')mapa[r.data_aula].d++;});
  historicoDatas=Object.entries(mapa).map(([d,x])=>({d,x})).sort((a,b)=>b.d.localeCompare(a.d));
  renderHistoricoFiltro();
}
function renderHistoricoFiltro(){
  const filtro=filtroMes?.value||'';
  const lista=historicoDatas.filter(x=>!filtro||x.d.startsWith(filtro));
  historico.innerHTML=lista.map(({d,x})=>`<button class="history-item" data-date="${d}"><strong>${formatarData(d)}</strong><span>🟢 ${x.p} &nbsp; 🔴 ${x.a} &nbsp; 🟡 ${x.j}${x.s?` &nbsp; ⚪ ${x.s}`:''}${x.d?` &nbsp; ⚫ ${x.d}`:''}</span></button>`).join('')||'<p class="muted">Nenhuma chamada encontrada para este período.</p>';
  historico.querySelectorAll('.history-item').forEach(b=>b.onclick=()=>{dataAula.value=b.dataset.date;carregarData(b.dataset.date);window.scrollTo({top:0,behavior:'smooth'})});
}
function formatarData(d){const [a,m,dia]=d.split('-');return `${dia}/${m}/${a}`}
init();
