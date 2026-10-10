let alunos=[];
let mostrarInativos=false;
const selecionados=new Set();

async function carregar(){
  const {data,error}=await db.from('alunos').select('id,nome,presente_na_aba_alunos').order('nome');
  if(error){console.error(error);contadorAlunos.textContent='Erro ao carregar.';return}
  alunos=data||[];
  selecionados.clear();
  atualizarContador();
  renderAtual();
}

function ativos(){ return alunos.filter(a=>a.presente_na_aba_alunos !== false); }
function inativos(){ return alunos.filter(a=>a.presente_na_aba_alunos === false); }
function listaBase(){ return mostrarInativos ? inativos() : ativos(); }

function atualizarContador(){
  const a=ativos().length, r=inativos().length;
  contadorAlunos.textContent=`${a} alunos ativos${r?` • ${r} removidos da lista`:''}`;
  mostrarRemovidos.textContent=mostrarInativos?'Mostrar ativos':'Mostrar removidos';
}

function renderAtual(){
  const t=norm(busca.value);
  const base=listaBase().filter(a=>norm(a.nome).includes(t));
  render(base);
  atualizarBotoes();
}

function render(list){
  if(!list.length){
    lista.innerHTML=`<div class="empty-state"><p class="muted">${mostrarInativos?'Nenhum aluno removido da lista.':'Nenhum aluno encontrado.'}</p></div>`;
    return;
  }
  lista.innerHTML=list.map(a=>{
    const checked=selecionados.has(Number(a.id))?'checked':'';
    const acao=mostrarInativos
      ? `<button class="btn secondary small restore-one" data-id="${a.id}" type="button">Restaurar</button>`
      : `<a class="mini-link" href="aluno.html?id=${a.id}">Ver desempenho →</a>`;
    return `<div class="row-card student-row">
      <label class="student-check"><input type="checkbox" class="aluno-check" data-id="${a.id}" ${checked}><span></span></label>
      <div class="student-info"><strong>${esc(a.nome)}</strong><small>ID ${a.id}${mostrarInativos?' • removido da lista':''}</small></div>
      <div class="student-actions">${acao}</div>
    </div>`;
  }).join('');

  lista.querySelectorAll('.aluno-check').forEach(cb=>cb.addEventListener('change',()=>{
    const id=Number(cb.dataset.id);
    if(cb.checked) selecionados.add(id); else selecionados.delete(id);
    atualizarBotoes();
  }));
  lista.querySelectorAll('.restore-one').forEach(btn=>btn.addEventListener('click',()=>restaurar([Number(btn.dataset.id)])));
}

function atualizarBotoes(){
  const n=selecionados.size;
  removerSelecionados.disabled=mostrarInativos || n===0;
  restaurarSelecionados.disabled=!mostrarInativos || n===0;
  const visiveis=listaBase().filter(a=>norm(a.nome).includes(norm(busca.value)));
  selecionarTodos.checked=visiveis.length>0 && visiveis.every(a=>selecionados.has(Number(a.id)));
  selecionarTodos.indeterminate=visiveis.some(a=>selecionados.has(Number(a.id))) && !selecionarTodos.checked;
}

selecionarTodos.addEventListener('change',()=>{
  const t=norm(busca.value);
  const visiveis=listaBase().filter(a=>norm(a.nome).includes(t));
  visiveis.forEach(a=>selecionarTodos.checked?selecionados.add(Number(a.id)):selecionados.delete(Number(a.id)));
  renderAtual();
});

busca.addEventListener('input',renderAtual);
mostrarRemovidos.addEventListener('click',()=>{
  mostrarInativos=!mostrarInativos;
  selecionados.clear();
  atualizarContador();
  renderAtual();
});

formAluno.addEventListener('submit',async e=>{
  e.preventDefault();
  msgAluno.textContent='Cadastrando...';
  const nome=nomeAlunoNovo.value.trim();
  if(!nome){msgAluno.textContent='Informe o nome do aluno.';return}
  const duplicado=alunos.some(a=>norm(a.nome)===norm(nome) && a.presente_na_aba_alunos!==false);
  if(duplicado){msgAluno.textContent='Já existe um aluno ativo com esse nome.';return}
  const {error}=await db.from('alunos').insert({nome,presente_na_aba_alunos:true});
  if(error){console.error(error);msgAluno.textContent=`Não foi possível cadastrar: ${error.message||'erro no banco'}`;return}
  nomeAlunoNovo.value='';
  msgAluno.textContent='Aluno cadastrado com sucesso!';
  mostrarInativos=false;
  await carregar();
});

async function restaurar(ids){
  if(!ids.length)return;
  msgLista.textContent='Restaurando...';
  for(const id of ids){
    const r=await db.from('alunos').update({presente_na_aba_alunos:true}).eq('id',id);
    if(r.error){console.error(r.error);msgLista.textContent='Não foi possível restaurar todos os alunos.';return;}
  }
  msgLista.textContent=`${ids.length} aluno(s) restaurado(s).`;
  await carregar();
}

async function remover(ids){
  if(!ids.length)return;
  const nomes=alunos.filter(a=>ids.includes(Number(a.id))).map(a=>a.nome).slice(0,4);
  const extra=ids.length>4?` e mais ${ids.length-4}`:'';
  const ok=confirm(`Remover ${ids.length} aluno(s) da lista ativa?\n\n${nomes.join('\n')}${extra}\n\nAs respostas e o histórico serão preservados. O aluno poderá ser restaurado depois.`);
  if(!ok)return;
  msgLista.textContent='Removendo da lista...';
  for(const id of ids){
    const r=await db.from('alunos').update({presente_na_aba_alunos:false}).eq('id',id);
    if(r.error){console.error(r.error);msgLista.textContent='Não foi possível remover todos os alunos.';return;}
  }
  selecionados.clear();
  msgLista.textContent=`${ids.length} aluno(s) removido(s) da lista. Histórico preservado.`;
  mostrarInativos=false;
  await carregar();
}

removerSelecionados.addEventListener('click',()=>remover([...selecionados]));
restaurarSelecionados.addEventListener('click',()=>restaurar([...selecionados]));

carregar();