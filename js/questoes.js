const sid=Number(new URLSearchParams(location.search).get('simulado'));
let sim=null;
let questoes=[];

const el=(id)=>document.getElementById(id);

function formatarDia(d){ return d || ''; }

const AREAS_ENEM_POR_DIA = {
  'Dia 1': [
    'Linguagens, Códigos e suas Tecnologias',
    'Ciências Humanas e suas Tecnologias'
  ],
  'Dia 2': [
    'Ciências da Natureza e suas Tecnologias',
    'Matemática e suas Tecnologias'
  ]
};


const DISCIPLINAS_POR_AREA = {
  'Linguagens, Códigos e suas Tecnologias': [
    'Língua Portuguesa',
    'Literatura',
    'Língua Estrangeira (Inglês)',
    'Artes',
    'Educação Física',
    'Música'
  ],
  'Ciências Humanas e suas Tecnologias': [
    'História',
    'Geografia',
    'Filosofia',
    'Sociologia'
  ],
  'Ciências da Natureza e suas Tecnologias': [
    'Biologia',
    'Física',
    'Química'
  ],
  'Matemática e suas Tecnologias': [
    'Matemática'
  ]
};

function disciplinasDaArea(area){
  return DISCIPLINAS_POR_AREA[area] || [];
}

function renderizarDisciplinas(containerId, area, valor=''){
  const container=el(containerId);
  if(!container) return;
  const selecionadas=(valor||'').split('/').map(x=>x.trim()).filter(Boolean);
  const opcoes=disciplinasDaArea(area);
  if(!opcoes.length){
    container.innerHTML='<div class="discipline-empty">Digite o número da questão para mostrar apenas as disciplinas possíveis.</div>';
    return;
  }
  container.innerHTML=opcoes.map(d=>`<label class="discipline-option"><input type="checkbox" value="${esc(d)}" ${selecionadas.includes(d)?'checked':''}>${esc(d)}</label>`).join('');
}

function atualizarDisciplinasPorArea(areaId, containerId, valor=''){
  renderizarDisciplinas(containerId, el(areaId)?.value || '', valor);
}

const AREAS_APROVA_POR_DIA = {
  'Dia 1': [
    'Sustentabilidade e Meio Ambiente',
    'Tecnologia da Comunicação'
  ],
  'Dia 2': [
    'Física',
    'Matemática e suas Tecnologias',
    'Química e Biologia'
  ]
};

// No padrão ENEM usado pelo sistema, as 180 questões são numeradas em sequência:
// 1–45 Linguagens | 46–90 Humanas | 91–135 Natureza | 136–180 Matemática.
function areaEnemAutomatica(numero){
  const n = Number(numero);
  if(!Number.isFinite(n) || n < 1) return '';
  if(n <= 45) return 'Linguagens, Códigos e suas Tecnologias';
  if(n <= 90) return 'Ciências Humanas e suas Tecnologias';
  if(n <= 135) return 'Ciências da Natureza e suas Tecnologias';
  if(n <= 180) return 'Matemática e suas Tecnologias';
  return '';
}

function atualizarAreaAutomatica(areaId, numeroId){
  const area = el(areaId);
  const numero = el(numeroId);
  if(!area || !numero) return;
  const sugerida = areaEnemAutomatica(numero.value);
  if(!sugerida) return;
  const diaId = numeroId==='numero' ? 'dia' : 'editDia';
  const aprovaId = numeroId==='numero' ? 'areaAprova' : 'editAreaAprova';
  atualizarOpcoesPorDia(el(diaId).value, areaId, aprovaId, sugerida);
  area.value = sugerida;
  atualizarDisciplinasPorArea(areaId, numeroId==='numero'?'disciplinas':'editDisciplinas');
  atualizarIndicacaoDisciplinas(numeroId==='numero'?'hintDisciplinas':'editHintDisciplinas', sugerida, numero.value);
}

function atualizarIndicacaoDisciplinas(hintId, area, numero){
  const hint=el(hintId);
  if(!hint) return;
  const opcoes=disciplinasDaArea(area);
  if(!opcoes.length){ hint.textContent='As disciplinas aparecerão após informar o número da questão.'; return; }
  hint.textContent=`Questão ${numero}: ${opcoes.length===1 ? 'somente' : 'opções válidas'} para ${area.replace(' e suas Tecnologias','')}.`;
}

function atualizarOpcoesPorDia(dia, areaId, aprovaId, areaForcada=null){
  const area = el(areaId);
  const aprova = el(aprovaId);
  if(!area || !aprova) return;

  const valorArea = areaForcada || area.value;
  const valorAprova = aprova.value;
  area.innerHTML = '<option value=\"\">Selecione...</option>';
  (AREAS_ENEM_POR_DIA[dia] || []).forEach(op => {
    const option = document.createElement('option');
    option.value = op;
    option.textContent = op;
    area.appendChild(option);
  });
  if((AREAS_ENEM_POR_DIA[dia] || []).includes(valorArea)) area.value = valorArea;

  aprova.innerHTML = '<option value=\"\">Selecione...</option>';
  (AREAS_APROVA_POR_DIA[dia] || []).forEach(op => {
    const option = document.createElement('option');
    option.value = op;
    option.textContent = op;
    aprova.appendChild(option);
  });
  if((AREAS_APROVA_POR_DIA[dia] || []).includes(valorAprova)) aprova.value = valorAprova;
}

function configurarFiltrosPorDia(){
  atualizarOpcoesPorDia(el('dia').value, 'areaEnem', 'areaAprova');
  atualizarOpcoesPorDia(el('editDia').value, 'editAreaEnem', 'editAreaAprova');
  renderizarDisciplinas('disciplinas', el('areaEnem').value);
  renderizarDisciplinas('editDisciplinas', el('editAreaEnem').value);
}

async function init(){
  if(!sid){ el('titulo').textContent='Simulado não informado'; return; }
  const {data,error}=await db.from('simulados').select('id,codigo,nome,data_dia1,data_dia2').eq('id',sid).single();
  if(error){ console.error(error); el('titulo').textContent='Simulado não encontrado'; return; }
  sim=data;
  el('titulo').textContent=`Questões — ${sim.nome}`;
  el('subtitulo').textContent=`Código: ${sim.codigo} • ${sim.data_dia1?'Dia 1: '+formatarData(sim.data_dia1):'Dia 1 sem data'} • ${sim.data_dia2?'Dia 2: '+formatarData(sim.data_dia2):'Dia 2 sem data'}`;
  await carregar();
}

function formatarData(value){
  if(!value) return '';
  const [y,m,d]=value.split('-');
  return `${d}/${m}/${y}`;
}

async function carregar(){
  const {data,error}=await db.from('questoes')
    .select('id,numero,dia,area_enem,disciplina,area_aprova')
    .eq('simulado',sim.codigo)
    .order('dia',{ascending:true})
    .order('numero',{ascending:true});
  if(error){
    console.error(error);
    el('lista').innerHTML='<p class="muted">Erro ao carregar as questões.</p>';
    return;
  }
  questoes=data||[];
  atualizarContadores();
  renderizar();
}

function atualizarContadores(){
  const d1=questoes.filter(q=>q.dia==='Dia 1').length;
  const d2=questoes.filter(q=>q.dia==='Dia 2').length;
  el('contador').textContent=`${questoes.length} questões cadastradas • Dia 1: ${d1} • Dia 2: ${d2}`;
}

function renderizar(){
  const filtro=el('filtroDia').value;
  const lista=questoes.filter(q=>filtro==='Todos'||q.dia===filtro);
  if(!lista.length){
    el('lista').innerHTML='<p class="muted">Nenhuma questão cadastrada neste filtro.</p>';
    return;
  }
  el('lista').innerHTML=lista.map(q=>`<div class="row-card">
    <div class="question-main">
      <strong>Questão ${q.numero} • ${esc(q.dia)}</strong>
      <small>${esc(q.area_enem||'Área ENEM não informada')}${q.disciplina?' • '+esc(q.disciplina):''}${q.area_aprova?' • '+esc(q.area_aprova):''}</small>
    </div>
    <div class="admin-actions">
      <button class="btn secondary small" type="button" onclick="editarQuestao(${q.id})">Editar</button>
      <button class="btn danger small" type="button" onclick="excluir(${q.id})">Excluir</button>
    </div>
  </div>`).join('');
}

function selecionarDisciplinas(containerId, valor){
  const selecionadas = (valor || '').split('/').map(x=>x.trim()).filter(Boolean);
  document.querySelectorAll(`#${containerId} input[type=checkbox]`).forEach(cb=>cb.checked=selecionadas.includes(cb.value));
}

function obterDisciplinas(containerId){
  return [...document.querySelectorAll(`#${containerId} input[type=checkbox]:checked`)].map(cb=>cb.value).join('/');
}

function preencherFormulario(q){
  el('editId').value=q.id;
  el('editNumero').value=q.numero;
  el('editDia').value=q.dia;
  atualizarOpcoesPorDia(q.dia, 'editAreaEnem', 'editAreaAprova');
  el('editAreaEnem').value=q.area_enem||'';
  renderizarDisciplinas('editDisciplinas', q.area_enem||'', q.disciplina);
  el('editAreaAprova').value=q.area_aprova||'';
  el('editMsg').textContent='';
  el('modalEditar').classList.add('open');
}

function editarQuestao(id){
  const q=questoes.find(x=>x.id===id);
  if(q) preencherFormulario(q);
}

function fecharEdicao(){ el('modalEditar').classList.remove('open'); }

function validarNumeroEDia(numero, dia){
  const n = Number(numero);
  if(!Number.isInteger(n) || n < 1 || n > 180){
    return 'Use um número de questão entre 1 e 180.';
  }
  if(dia === 'Dia 1' && n > 90){
    return 'No Dia 1, use questões de 1 a 90.';
  }
  if(dia === 'Dia 2' && n < 91){
    return 'No Dia 2, use questões de 91 a 180.';
  }
  return '';
}

el('filtroDia').addEventListener('change',renderizar);
el('numero').addEventListener('input',()=>atualizarAreaAutomatica('areaEnem','numero'));
el('dia').addEventListener('change',()=>{
  atualizarOpcoesPorDia(el('dia').value,'areaEnem','areaAprova');
  atualizarAreaAutomatica('areaEnem','numero');
});
el('areaEnem').addEventListener('change',()=>{
  atualizarDisciplinasPorArea('areaEnem','disciplinas');
  atualizarIndicacaoDisciplinas('hintDisciplinas', el('areaEnem').value, el('numero').value);
});
el('editDia').addEventListener('change',()=>{
  atualizarOpcoesPorDia(el('editDia').value,'editAreaEnem','editAreaAprova');
  if(el('editNumero').value) atualizarAreaAutomatica('editAreaEnem','editNumero');
});
el('editNumero').addEventListener('input',()=>atualizarAreaAutomatica('editAreaEnem','editNumero'));
el('editAreaEnem').addEventListener('change',()=>{
  atualizarDisciplinasPorArea('editAreaEnem','editDisciplinas');
  atualizarIndicacaoDisciplinas('editHintDisciplinas', el('editAreaEnem').value, el('editNumero').value);
});
el('btnAreaAutomatica').addEventListener('click',()=>atualizarAreaAutomatica('editAreaEnem','editNumero'));

configurarFiltrosPorDia();
if(el('numero')?.value) atualizarAreaAutomatica('areaEnem','numero');


el('formQuestao').addEventListener('submit',async e=>{
  e.preventDefault();
  el('msg').textContent='Salvando...';
  const erroNumero = validarNumeroEDia(el('numero').value, el('dia').value);
  if(erroNumero){ el('msg').textContent=erroNumero; return; }
  if(!el('areaEnem').value || !obterDisciplinas('disciplinas') || !el('areaAprova').value){ el('msg').textContent='Preencha área ENEM, pelo menos uma disciplina e área Aprova.'; return; }
  const payload={
    numero:Number(el('numero').value),
    simulado:sim.codigo,
    dia:el('dia').value,
    area_enem:el('areaEnem').value.trim()||null,
    disciplina:obterDisciplinas('disciplinas')||null,
    area_aprova:el('areaAprova').value.trim()||null
  };
  const {error}=await db.from('questoes').insert(payload);
  if(error){
    console.error(error);
    el('msg').textContent=error.code==='23505'?'Essa questão já existe neste simulado e dia.':'Não foi possível salvar a questão.';
    return;
  }
  el('formQuestao').reset();
  el('dia').value='Dia 1';
  el('areaEnem').innerHTML='<option value="">Digite o número...</option>';
  renderizarDisciplinas('disciplinas','');
  el('msg').textContent='Questão adicionada!';
  await carregar();
});

el('formEditar').addEventListener('submit',async e=>{
  e.preventDefault();
  const id=Number(el('editId').value);
  const erroNumero = validarNumeroEDia(el('editNumero').value, el('editDia').value);
  if(erroNumero){ el('editMsg').textContent=erroNumero; return; }
  const payload={
    numero:Number(el('editNumero').value),
    dia:el('editDia').value,
    area_enem:el('editAreaEnem').value||null,
    disciplina:obterDisciplinas('editDisciplinas')||null,
    area_aprova:el('editAreaAprova').value||null
  };
  if(!payload.numero||!payload.dia||!payload.area_enem||!payload.disciplina||!payload.area_aprova){ el('editMsg').textContent='Preencha número, dia, área ENEM, disciplina e área Aprova.'; return; }
  el('editMsg').textContent='Salvando...';
  const {error}=await db.from('questoes').update(payload).eq('id',id);
  if(error){
    console.error(error);
    el('editMsg').textContent=error.code==='23505'?'Já existe outra questão com esse número neste dia.':'Não foi possível salvar as alterações.';
    return;
  }
  fecharEdicao();
  await carregar();
});

async function excluir(id){
  const q=questoes.find(x=>x.id===id);
  if(!q)return;
  if(!confirm(`Excluir a questão ${q.numero} do ${q.dia}?`))return;
  const {error}=await db.from('questoes').delete().eq('id',id);
  if(error){
    console.error(error);
    alert('Não foi possível excluir. Se esta questão já possui respostas registradas, edite-a em vez de excluir.');
    return;
  }
  await carregar();
}

el('modalEditar').addEventListener('click',e=>{if(e.target===el('modalEditar'))fecharEdicao();});

init();
