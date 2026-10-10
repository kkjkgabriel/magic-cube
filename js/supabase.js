/*
 * APROVA ICET - modo local temporário
 *
 * Enquanto a API pública do Supabase não estiver resolvendo o hostname,
 * o sistema usa uma cópia local dos dados importados do banco.
 *
 * Para voltar ao Supabase depois, altere MODO_LOCAL para false e restaure
 * a criação do cliente Supabase indicada no final deste arquivo.
 */
const MODO_LOCAL = false;
const SUPABASE_URL = "https://uqpvbxctorvhnxsrhuuh.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_QIGrT3XaGr9OSIHsGzvg7A_-tGs-uLb";

// Cliente remoto: usado quando MODO_LOCAL = false.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const LOCAL_TABLES = ['alunos','simulados','questoes','respostas','frequencias','tempos_prova'];
const localDB = {};
let localLoaded = false;
let localLoading = null;

function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }

async function loadLocalDB(){
  if(localLoaded) return localDB;
  if(localLoading) return localLoading;
  localLoading = (async()=>{
    for(const table of LOCAL_TABLES){
      const saved = localStorage.getItem('aprova_icet_'+table);
      if(saved){
        try { localDB[table] = JSON.parse(saved); continue; } catch(_){}
      }
      if(table === 'frequencias' || table === 'tempos_prova') { localDB[table] = []; continue; }
      const r = await fetch('data/'+table+'.json', {cache:'no-store'});
      if(!r.ok) throw new Error('Não foi possível carregar data/'+table+'.json');
      localDB[table] = await r.json();
    }
    localLoaded = true;
    return localDB;
  })();
  return localLoading;
}

function persist(table){
  localStorage.setItem('aprova_icet_'+table, JSON.stringify(localDB[table]||[]));
}

function nextId(table){
  return (localDB[table]||[]).reduce((m,r)=>Math.max(m,Number(r.id)||0),0)+1;
}

function parseSelect(columns){
  if(!columns || columns==='*') return null;
  return columns.split(',').map(s=>s.trim()).filter(Boolean);
}

function projectRow(row, fields){
  if(!fields) return clone(row);
  const out={};
  for(const f of fields){
    const rel = f.match(/^(alunos|questoes)\((.*)\)$/);
    if(rel){
      const [name, inner] = [rel[1],rel[2]];
      const source = localDB[name]||[];
      let found = null;
      if(name==='alunos') found = source.find(x=>Number(x.id)===Number(row.aluno_id));
      if(name==='questoes') found = source.find(x=>Number(x.id)===Number(row.questao_id));
      const innerFields = inner.split(',').map(x=>x.trim()).filter(Boolean);
      out[name] = found ? projectRow(found, innerFields) : null;
    }else{
      out[f]=clone(row[f]);
    }
  }
  return out;
}

class LocalQuery {
  constructor(table){
    this.table=table; this.operation='select'; this.fields=null; this.opts={};
    this.filters=[]; this.orders=[]; this._limit=null; this._range=null; this._single=false;
    this.payload=null; this.conflict=null;
  }
  select(columns='*', options={}){ this.operation='select'; this.fields=parseSelect(columns); this.opts=options||{}; return this; }
  eq(field,value){ this.filters.push([field,value]); return this; }
  order(field, options={}){ this.orders.push([field, options?.ascending!==false]); return this; }
  limit(n){ this._limit=Number(n); return this; }
  range(a,b){ this._range=[Number(a),Number(b)]; return this; }
  single(){ this._single=true; return this; }
  insert(payload){ this.operation='insert'; this.payload=Array.isArray(payload)?payload:[payload]; return this; }
  update(payload){ this.operation='update'; this.payload=payload; return this; }
  delete(){ this.operation='delete'; return this; }
  upsert(payload, options={}){ this.operation='upsert'; this.payload=Array.isArray(payload)?payload:[payload]; this.conflict=options.onConflict||''; return this; }
  async execute(){
    try{
      await loadLocalDB();
      if(!localDB[this.table]) localDB[this.table]=[];
      const table=localDB[this.table];
      if(this.operation==='insert'){
        const added=this.payload.map(p=>{ const x=clone(p); if(this.table!=='respostas' && x.id==null) x.id=nextId(this.table); if(this.table==='respostas' && x.id==null) x.id=nextId(this.table); return x; });
        table.push(...added); persist(this.table); return {data:clone(added),error:null,count:added.length};
      }
      if(this.operation==='update'){
        const matches=table.filter(r=>this.filters.every(([f,v])=>String(r[f])===String(v)));
        matches.forEach(r=>Object.assign(r,clone(this.payload))); persist(this.table);
        return {data:clone(matches),error:null,count:matches.length};
      }
      if(this.operation==='delete'){
        const before=table.length;
        localDB[this.table]=table.filter(r=>!this.filters.every(([f,v])=>String(r[f])===String(v)));
        persist(this.table); return {data:null,error:null,count:before-localDB[this.table].length};
      }
      if(this.operation==='upsert'){
        const keys=(this.conflict||'').split(',').map(s=>s.trim()).filter(Boolean);
        const changed=[];
        for(const p0 of this.payload){
          const p=clone(p0); let idx=-1;
          if(keys.length) idx=table.findIndex(r=>keys.every(k=>String(r[k])===String(p[k])));
          if(idx>=0){ Object.assign(table[idx],p); changed.push(table[idx]); }
          else { if(p.id==null) p.id=nextId(this.table); table.push(p); changed.push(p); }
        }
        persist(this.table); return {data:clone(changed),error:null,count:changed.length};
      }

      let rows=table.filter(r=>this.filters.every(([f,v])=>String(r[f])===String(v)));
      for(const [field,ascending] of this.orders){
        rows.sort((a,b)=>{
          const av=a[field],bv=b[field];
          if(av===bv)return 0;
          if(av==null)return ascending?-1:1;
          if(bv==null)return ascending?1:-1;
          const na=Number(av),nb=Number(bv);
          let c=(!Number.isNaN(na)&&!Number.isNaN(nb)) ? na-nb : String(av).localeCompare(String(bv),'pt-BR');
          return ascending?c:-c;
        });
      }
      const total=rows.length;
      if(this._range) rows=rows.slice(this._range[0],this._range[1]+1);
      if(this._limit!=null) rows=rows.slice(0,this._limit);
      const data=rows.map(r=>projectRow(r,this.fields));
      const count=this.opts?.count==='exact'?total:null;
      if(this.opts?.head) return {data:null,error:null,count};
      if(this._single){
        if(data.length!==1) return {data:null,error:{message:data.length?'Mais de um registro encontrado':'Nenhum registro encontrado'},count};
        return {data:data[0],error:null,count};
      }
      return {data,error:null,count};
    }catch(error){ return {data:null,error,count:null}; }
  }
  then(resolve,reject){ return this.execute().then(resolve,reject); }
  catch(reject){ return this.execute().catch(reject); }
  finally(fn){ return this.execute().finally(fn); }
}

const localDBClient = {
  from(table){ return new LocalQuery(table); }
};

const db = MODO_LOCAL ? localDBClient : supabaseClient;
window.APROVA_ICET_LOCAL = MODO_LOCAL;
window.APROVA_ICET_DB = db;

if(MODO_LOCAL){
  document.addEventListener('DOMContentLoaded',()=>{
    const banner=document.createElement('div');
    banner.textContent='MODO DE DESENVOLVIMENTO: dados locais temporários — o Supabase será reconectado depois.';
    banner.style.cssText='position:fixed;bottom:10px;right:10px;z-index:9999;background:#fff7d6;color:#6b5200;border:1px solid #ead27a;border-radius:10px;padding:8px 12px;font:12px Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.12)';
    document.body.appendChild(banner);
  });
}
