let sims=[];

const el = (id) => document.getElementById(id);

function formatarData(value){
  if(!value) return 'Data não informada';
  const [y,m,d] = value.split('-');
  return `${d}/${m}/${y}`;
}

async function carregar(){
  const {data,error}=await db.from('simulados')
    .select('id,codigo,nome,data_dia1,data_dia2')
    .order('id',{ascending:true});
  if(error){
    console.error(error);
    el('lista').innerHTML='<p class="muted">Erro ao carregar simulados. Verifique se o SQL de melhorias foi executado.</p>';
    return;
  }
  sims=data||[];
  await render();
}

async function render(){
  if(!sims.length){el('lista').innerHTML='<p class="muted">Nenhum simulado cadastrado.</p>';return;}
  const html=await Promise.all(sims.map(async s=>{
    const {count}=await db.from('questoes').select('id',{count:'exact',head:true}).eq('simulado',s.codigo);
    const datas=[];
    if(s.data_dia1) datas.push(`Dia 1: ${formatarData(s.data_dia1)}`);
    if(s.data_dia2) datas.push(`Dia 2: ${formatarData(s.data_dia2)}`);
    const dataTexto=datas.length?datas.join(' • '):'Datas não informadas';
    return `<article class="simulado-admin">
      <div class="simulado-info">
        <span class="section-label">${esc(s.codigo)}</span>
        <h3>${esc(s.nome)}</h3>
        <p>${dataTexto}</p>
        <small>${count??0} questões mapeadas</small>
      </div>
      <div class="admin-actions">
        <button class="btn secondary" type="button" onclick="abrirQuestoes(${s.id})">Questões</button>
        <button class="btn secondary" type="button" onclick="editarSimulado(${s.id})">Editar</button>
        <button class="btn danger" type="button" onclick="excluirSimulado(${s.id})">Excluir</button>
      </div>
    </article>`;
  }));
  el('lista').innerHTML=html.join('');
}

el('formSimulado').addEventListener('submit',async e=>{
  e.preventDefault();
  el('msg').textContent='Criando...';
  const payload={
    codigo:el('codigo').value.trim(),
    nome:el('nome').value.trim(),
    data_dia1:el('dataDia1').value||null,
    data_dia2:el('dataDia2').value||null
  };
  if(!payload.codigo || !payload.nome){el('msg').textContent='Preencha código e nome.';return;}
  const {error}=await db.from('simulados').insert(payload);
  if(error){
    console.error(error);
    if(error.code==='23505') el('msg').textContent='Esse código já existe.';
    else if(error.code==='23502') el('msg').textContent='O banco ainda não está configurado para gerar o ID automaticamente. Execute o SQL da V4.';
    else el('msg').textContent='Não foi possível criar o simulado.';
    return;
  }
  el('formSimulado').reset();
  el('msg').textContent='Simulado criado com sucesso!';
  await carregar();
});

async function editarSimulado(id){
  const s=sims.find(x=>x.id===id);
  if(!s)return;
  el('editId').value=s.id;
  el('editCodigo').value=s.codigo;
  el('editNome').value=s.nome||'';
  el('editDia1').value=s.data_dia1||'';
  el('editDia2').value=s.data_dia2||'';
  el('editMsg').textContent='';
  el('modalEditar').classList.add('open');
}

function fecharEdicao(){el('modalEditar').classList.remove('open');}

el('formEditar').addEventListener('submit',async e=>{
  e.preventDefault();
  const id=Number(el('editId').value);
  const payload={
    nome:el('editNome').value.trim(),
    data_dia1:el('editDia1').value||null,
    data_dia2:el('editDia2').value||null
  };
  if(!payload.nome){el('editMsg').textContent='Informe o nome do simulado.';return;}
  el('editMsg').textContent='Salvando...';
  const {error}=await db.from('simulados').update(payload).eq('id',id);
  if(error){console.error(error);el('editMsg').textContent='Não foi possível salvar as alterações.';return;}
  fecharEdicao();
  await carregar();
});

async function excluirSimulado(id){
  const s=sims.find(x=>x.id===id);
  if(!s)return;
  if(!confirm(`Excluir o simulado "${s.nome}"?`))return;
  const {error}=await db.from('simulados').delete().eq('id',id);
  if(error){
    console.error(error);
    alert('Não foi possível excluir. Verifique se existem questões, respostas ou presenças vinculadas.');
    return;
  }
  await carregar();
}

function abrirQuestoes(id){location.href=`questoes.html?simulado=${id}`;}

el('modalEditar').addEventListener('click',e=>{if(e.target===el('modalEditar'))fecharEdicao();});

carregar();
