function norm(v){return(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function fmtDate(v){if(!v)return '—'; const [y,m,d]=String(v).slice(0,10).split('-'); return `${d}/${m}/${y}`}
function navActive(page){document.querySelectorAll('.nav-item').forEach(a=>a.classList.toggle('active',a.dataset.page===page))}
document.getElementById('menuBtn')?.addEventListener('click',()=>document.getElementById('sidebar')?.classList.toggle('open'));
