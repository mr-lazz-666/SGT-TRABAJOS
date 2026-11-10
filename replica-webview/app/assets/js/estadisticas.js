const dbStats=dbLoad(); let chartCat=null,chartJ=null,chartTrend=null,chartActiveTrend=null,chartResolvedTrend=null,chartEstados=null,chartPrioridades=null,chartCategoriasPie=null,chartLineasComparadas=null,chartRadar=null;
const allS=Object.values(dbStats.solicitudes).filter(s=>!s.eliminada); const juntas=dbStats.juntas;
const cleanCat=s=>String(s||'Sin categoría').replace(/^\d+\.\s*/, '');
const countBy=(arr,fn)=>arr.reduce((o,x)=>{const k=fn(x)||'Sin dato';o[k]=(o[k]||0)+1;return o;},{});
const topEntry=o=>Object.entries(o).sort((a,b)=>b[1]-a[1])[0]||['Sin datos',0];
function parseFecha(v){if(!v)return null;let m=String(v).match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);if(m)return new Date(+m[3],+m[2]-1,+m[1]);let d=new Date(v);return isNaN(d)?null:d}
function daysOld(s){const d=parseFecha(s.fecha);return d?Math.max(0,Math.floor((Date.now()-d)/86400000)):0}
function opts(id,vals,label){document.getElementById(id).innerHTML=`<option value="">${label}</option>`+vals.map(([v,t])=>`<option value="${String(v).replace(/"/g,'&quot;')}">${t}</option>`).join('')}
opts('fJunta',Object.values(juntas).sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(j=>[j.id,j.nombre]),'Todas las juntas');opts('fCategoria',[...new Set(allS.map(s=>s.categoria).filter(Boolean))].sort().map(x=>[x,cleanCat(x)]),'Todas las categorías');opts('fDepartamento',[...new Set(allS.map(s=>s.departamento).filter(Boolean))].sort().map(x=>[x,x]),'Todos los departamentos');
['fJunta','fCategoria','fDepartamento'].forEach(id=>document.getElementById(id).onchange=render);document.getElementById('limpiar').onclick=()=>{['fJunta','fCategoria','fDepartamento'].forEach(id=>document.getElementById(id).value='');render()};
function filtered(){const j=document.getElementById('fJunta').value,c=document.getElementById('fCategoria').value,d=document.getElementById('fDepartamento').value;return allS.filter(s=>(!j||s.juntaId===j)&&(!c||s.categoria===c)&&(!d||s.departamento===d))}
function sugerenciaCategoria(cat){const c=cleanCat(cat).toLowerCase();if(c.includes('seguridad ciudadana'))return 'Evaluar coordinación con Seguridad Ciudadana municipal y Carabineros, priorizando los casos de mayor gravedad y antigüedad.';if(c.includes('iluminación'))return 'Evaluar operativo focalizado de alumbrado y revisión de puntos repetidos con el área responsable.';if(c.includes('tránsito'))return 'Evaluar inspección en terreno y coordinación con Tránsito para medidas de seguridad vial.';if(c.includes('medioambiente')||c.includes('residuos'))return 'Evaluar operativo territorial con Medioambiente, Aseo y Ornato en los puntos de mayor recurrencia.';if(c.includes('infraestructura'))return 'Priorizar inspección técnica y consolidar requerimientos repetidos para programación de obras.';if(c.includes('emergencias'))return 'Escalar revisión preventiva con el área de emergencias y priorizar los casos críticos.';return 'Revisar los casos agrupados con el departamento responsable y definir una acción territorial conjunta.'}
function render(){const arr=filtered(), active=arr.filter(s=>!esSolicitudResuelta(s)),res=arr.filter(esSolicitudResuelta),crit=active.filter(s=>normalizarEstado(s.estado).key==='critica'||String(s.prioridad).toLowerCase()==='alta'),old=active.filter(s=>daysOld(s)>=30);document.getElementById('kpis').innerHTML=`<div class="col"><div class="stat-card blue"><div class="stat-label">Activas</div><div class="stat-value">${active.length}</div><div class="stat-sub">requieren seguimiento</div></div></div><div class="col"><div class="stat-card red"><div class="stat-label">Alta / crítica</div><div class="stat-value">${crit.length}</div><div class="stat-sub">prioridad de gestión</div></div></div><div class="col"><div class="stat-card orange"><div class="stat-label">Pendientes +30 días</div><div class="stat-value">${old.length}</div><div class="stat-sub">posible rezago</div></div></div><div class="col"><div class="stat-card green"><div class="stat-label">Resueltas</div><div class="stat-value">${res.length}</div><div class="stat-sub">histórico filtrado</div></div></div>`;
renderHeatmap(arr);renderAlerts(active);renderTrendCharts(arr,active,res);renderCharts(active);renderExtraCharts(arr,active,res);renderStats(arr,active,res);renderDept(active);renderAge(active);renderTable(active)}
function renderAlerts(active){let alerts=[];Object.values(juntas).forEach(j=>{const a=active.filter(s=>s.juntaId===j.id);if(!a.length)return;const [cat,n]=topEntry(countBy(a,s=>s.categoria));const hi=a.filter(s=>normalizarEstado(s.estado).key==='critica'||String(s.prioridad).toLowerCase()==='alta').length;const old=a.filter(s=>daysOld(s)>=30).length;if(n>=3||hi>=2||old>=3)alerts.push({j,cat,n,total:a.length,hi,old,score:n+hi*2+old,action:sugerenciaCategoria(cat)})});alerts.sort((a,b)=>b.score-a.score);document.getElementById('alertCount').textContent=`${alerts.length} alertas`;document.getElementById('alertas').innerHTML=alerts.slice(0,8).map(x=>`<div class="decision-alert ${x.hi>=3?'high':'medium'}"><h6>${x.j.nombre}</h6><div class="metric"><b>${x.n}</b> casos de ${cleanCat(x.cat)} · ${x.total} activas · ${x.hi} alta/crítica${x.old?` · ${x.old} con +30 días`:''}</div><div class="action"><b>Acción sugerida:</b> ${x.action}</div></div>`).join('')||'<div class="text-muted">No se detectan concentraciones suficientes para generar alertas con los datos actuales.</div>'}
function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthLabel(k){const [y,m]=k.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('es-CL',{month:'short',year:'2-digit'}).replace('.','')}
function monthRange(arr){const ds=arr.map(s=>parseFecha(s.fecha)).filter(Boolean).sort((a,b)=>a-b);const end=ds.length?new Date(ds[ds.length-1].getFullYear(),ds[ds.length-1].getMonth(),1):new Date(new Date().getFullYear(),new Date().getMonth(),1);let start=ds.length?new Date(ds[0].getFullYear(),ds[0].getMonth(),1):new Date(end.getFullYear(),end.getMonth()-5,1);const maxMonths=18;const diff=(end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth()+1;if(diff>maxMonths)start=new Date(end.getFullYear(),end.getMonth()-maxMonths+1,1);const out=[];for(let d=new Date(start);d<=end;d.setMonth(d.getMonth()+1))out.push(monthKey(d));return out}
function seriesByMonths(arr,months){const c={};arr.forEach(s=>{const d=parseFecha(s.fecha);if(d)c[monthKey(d)]=(c[monthKey(d)]||0)+1});return months.map(k=>c[k]||0)}
function linearTrend(values){const n=values.length;if(n<2)return {values:[...values],slope:0};const sx=(n-1)*n/2,sy=values.reduce((a,b)=>a+b,0),sxx=(n-1)*n*(2*n-1)/6,sxy=values.reduce((a,y,x)=>a+x*y,0);const den=n*sxx-sx*sx;const slope=den?(n*sxy-sx*sy)/den:0,intercept=(sy-slope*sx)/n;return {slope,values:values.map((_,x)=>Math.max(0,+(intercept+slope*x).toFixed(2)))}}
function trendText(slope){if(slope>0.15)return {text:'↗ Tendencia al alza',cls:'up'};if(slope<-0.15)return {text:'↘ Tendencia a la baja',cls:'down'};return {text:'→ Tendencia estable',cls:'flat'}}
function setTrendBadge(id,slope){const e=document.getElementById(id),t=trendText(slope);e.textContent=t.text;e.className=`trend-pill ${t.cls}`}
function trendDataset(label,data){return {type:'line',label,data,borderWidth:3,pointRadius:0,pointHoverRadius:3,tension:0,fill:false}}
function barDataset(label,data){return {type:'bar',label,data,borderWidth:0,borderRadius:5}}
function commonTrendOptions(){return {responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{y:{beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{position:'bottom'}}}}
function renderTrendCharts(arr,active,res){
 const months=monthRange(arr),labels=months.map(monthLabel),incoming=seriesByMonths(arr,months);
 // La fecha de cierre debe existir; de lo contrario NO se atribuye al mes de ingreso.
 const closed=res.map(s=>({...s,fecha:s.fechaResolucion||s.fecha_resolucion||s.fechaCierre||s.fecha_cierre||s.fechaResuelta||null})).filter(s=>parseFecha(s.fecha));
 const resolved=seriesByMonths(closed,months);
 const ctx=document.getElementById('chartTendenciaGeneral');if(chartTrend)chartTrend.destroy();
 chartTrend=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Ingresadas',data:incoming,borderColor:'#419fce',backgroundColor:'#419fce',tension:.25,borderWidth:3},{label:'Resueltas (fecha de cierre)',data:resolved,borderColor:'#2a9d71',backgroundColor:'#2a9d71',tension:.25,borderWidth:3}]},options:commonTrendOptions()});
 const badge=document.getElementById('trendGeneral');if(badge){badge.textContent=closed.length===res.length?'Ingresos vs. cierres':'Cierres sin fecha: '+(res.length-closed.length);badge.className='trend-pill flat'}
}
function renderCharts(active){
 const departments=Object.entries(countBy(active,s=>s.departamento||'Sin departamento')).sort((a,b)=>b[1]-a[1]).slice(0,10).map(x=>x[0]);
 const critical=departments.map(d=>active.filter(s=>(s.departamento||'Sin departamento')===d&&heatPriority(s)==='Crítica').length);
 const high=departments.map(d=>active.filter(s=>(s.departamento||'Sin departamento')===d&&heatPriority(s)==='Alta').length);
 if(chartCat)chartCat.destroy();chartCat=new Chart(document.getElementById('chartCategorias'),{type:'bar',data:{labels:departments,datasets:[{label:'Críticas',data:critical,backgroundColor:'#d75656'},{label:'Altas',data:high,backgroundColor:'#eea04a'}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true,beginAtZero:true,ticks:{precision:0}},y:{stacked:true}},plugins:{legend:{position:'bottom'}}}});
 const labels=['0–7 días','8–15 días','16–30 días','31–60 días','Más de 60 días'];const buckets=[0,0,0,0,0];active.forEach(s=>{const d=daysOld(s);buckets[d<=7?0:d<=15?1:d<=30?2:d<=60?3:4]++});
 if(chartJ)chartJ.destroy();chartJ=new Chart(document.getElementById('chartJuntas'),{type:'bar',data:{labels,datasets:[{label:'Solicitudes abiertas',data:buckets,backgroundColor:['#7cb6dc','#91b8cc','#e5c86d','#eea04a','#d75656']}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{display:false}}}});
}
function renderDept(active){const ds=Object.entries(countBy(active,s=>s.departamento||'Sin departamento')).sort((a,b)=>b[1]-a[1]).slice(0,8),max=ds[0]?.[1]||1;document.getElementById('departamentos').innerHTML=ds.map(([n,v])=>`<div class="bar-row"><div class="bar-label"><span>${n}</span><b>${v}</b></div><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div></div>`).join('')||'<div class="text-muted">Sin datos.</div>'}
function renderAge(active){const a=[0,0,0];active.forEach(s=>{const d=daysOld(s);if(d<15)a[0]++;else if(d<30)a[1]++;else a[2]++});document.getElementById('antiguedad').innerHTML=`<div class="age-boxes"><div class="age-box"><b>${a[0]}</b><span>0–14 días</span></div><div class="age-box"><b>${a[1]}</b><span>15–29 días</span></div><div class="age-box"><b>${a[2]}</b><span>30+ días</span></div></div><p class="small text-muted mt-3">Los casos de 30 días o más se muestran como señal de posible rezago para revisión.</p>`}
function renderTable(active){let rows=Object.values(juntas).map(j=>{const a=active.filter(s=>s.juntaId===j.id);if(!a.length)return null;const [cat,n]=topEntry(countBy(a,s=>s.categoria));const hi=a.filter(s=>normalizarEstado(s.estado).key==='critica'||String(s.prioridad).toLowerCase()==='alta').length;const [dep,dn]=topEntry(countBy(a,s=>s.departamento||'Sin departamento'));return {j,a,cat,n,hi,dep,dn}}).filter(Boolean).sort((a,b)=>b.a.length-a.a.length);document.getElementById('tablaDecision').innerHTML=rows.map(x=>`<tr><td><b>${x.j.nombre}</b></td><td>${x.a.length}</td><td>${cleanCat(x.cat)} (${x.n})</td><td>${x.hi}</td><td>${x.dep} (${x.dn})</td><td class="reading">${x.n>=3?`Concentración de ${cleanCat(x.cat)}. ${sugerenciaCategoria(x.cat)}`:'Carga distribuida; mantener seguimiento de los casos activos.'}</td></tr>`).join('')||'<tr><td colspan="6" class="text-center text-muted py-3">Sin solicitudes activas para los filtros seleccionados.</td></tr>'}
// El primer render se ejecuta al terminar de declarar el heatmap y sus controles.

function median(vals){if(!vals.length)return 0;const a=[...vals].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
function mean(vals){return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0}
function stddev(vals){if(vals.length<2)return 0;const m=mean(vals);return Math.sqrt(vals.reduce((a,v)=>a+(v-m)**2,0)/vals.length)}
function pct(n,d){return d?Math.round(n/d*100):0}
function renderStats(arr,active,res){
 const ages=active.map(daysOld), byJ=Object.values(countBy(active,s=>juntas[s.juntaId]?.nombre||'Sin junta'));
 const catCounts=Object.values(countBy(active,s=>cleanCat(s.categoria))).sort((a,b)=>b-a);
 const concentration=active.length&&catCounts.length?pct(catCounts[0],active.length):0;
 const vals=[
  ['Promedio activas / junta',byJ.length?mean(byJ).toFixed(1):'0','carga territorial media'],
  ['Mediana antigüedad',`${Math.round(median(ages))} días`,'caso activo típico'],
  ['Desviación antigüedad',`${Math.round(stddev(ages))} días`,'dispersión del rezago'],
  ['Tasa resuelta',`${pct(res.length,arr.length)}%`,'sobre registros filtrados'],
  ['Concentración principal',`${concentration}%`,'peso de la categoría líder'],
  ['Máxima carga por junta',byJ.length?Math.max(...byJ):0,'activas en una sola junta']
 ];
 document.getElementById('statsResumen').innerHTML=vals.map(([v,n,s])=>`<div class="mini-stat"><span>${v}</span><b>${n}</b><small>${s}</small></div>`).join('');
}
function renderExtraCharts(arr,active,res){
 [chartEstados,chartPrioridades,chartLineasComparadas].forEach(c=>c&&c.destroy());
 const estado=Object.entries(countBy(arr,s=>s.estado||'Sin estado')).sort((a,b)=>b[1]-a[1]);
 const prio=Object.entries(countBy(active,s=>s.prioridad||'Sin prioridad')).sort((a,b)=>b[1]-a[1]);
 const doughnutOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:12}}}};
 chartEstados=new Chart(document.getElementById('chartEstados'),{type:'doughnut',data:{labels:estado.map(x=>x[0]),datasets:[{data:estado.map(x=>x[1])}]},options:doughnutOpts});
 chartPrioridades=new Chart(document.getElementById('chartPrioridades'),{type:'pie',data:{labels:prio.map(x=>x[0]),datasets:[{data:prio.map(x=>x[1])}]},options:doughnutOpts});
 
 const months=monthRange(arr),labels=months.map(monthLabel);
 const backlog=months.map(m=>{const end=new Date(+m.slice(0,4),+m.slice(5,7),0,23,59,59);return arr.filter(s=>{const start=parseFecha(s.fecha);if(!start||start>end)return false;const closed=esSolicitudResuelta(s)?parseFecha(s.fechaResolucion||s.fecha_resolucion||s.fechaCierre||s.fecha_cierre||s.fechaResuelta):null;return !closed||closed>end}).length});
 chartLineasComparadas=new Chart(document.getElementById('chartLineasComparadas'),{type:'line',data:{labels,datasets:[{label:'Abiertas estimadas al cierre del mes',data:backlog,borderColor:'#d99d41',backgroundColor:'rgba(217,157,65,.15)',fill:true,borderWidth:3,tension:.25}]},options:commonTrendOptions()});
 const note=document.getElementById('backlogNote');if(note)note.textContent='Estimación: solicitudes resueltas sin fecha de cierre permanecen contabilizadas hasta que exista una fecha de resolución.';

}

// FIX9R: prioridad, estado y categoría, con detalle por folio.
const heatMode=document.getElementById('heatMode');let heatPage=1;const heatSearch=document.getElementById('heatSearch'),heatRisk=document.getElementById('heatRisk'),heatSize=document.getElementById('heatSize'),heatSort=document.getElementById('heatSort');[heatSearch,heatRisk,heatSize,heatSort].forEach(el=>el.addEventListener(el===heatSearch?'input':'change',()=>{heatPage=1;renderHeatmap(filtered())}));
heatMode.addEventListener('change',()=>{heatPage=1;renderHeatmap(filtered())});
function heatEscape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function heatPriority(s){
 const p=String(s.prioridad||'').trim().toLowerCase();
 const e=normalizarEstado(s.estado).key;
 if(p.includes('crit')||e==='critica')return 'Crítica';
 if(p==='alta'||p==='alto')return 'Alta';
 if(p==='media'||p==='medio')return 'Media';
 if(p==='baja'||p==='bajo')return 'Baja';
 return 'Sin prioridad';
}
function heatStatus(s){
 if(esSolicitudResuelta(s))return 'Resuelta';
 const e=normalizarEstado(s.estado).key;
 if(e==='critica')return 'Crítica (estado)';
 if(e==='proceso'||e==='en_proceso')return 'En proceso';
 return 'Pendiente';
}
function renderHeatmap(arr){
 const mode=heatMode.value, active=arr.filter(s=>!esSolicitudResuelta(s));
 const data=mode==='estado'?arr:active;
 const cols=mode==='prioridad'?['Crítica','Alta','Media','Baja','Sin prioridad']:
 mode==='estado'?['Pendiente','En proceso','Crítica (estado)','Resuelta']:
 [...new Set(data.map(s=>cleanCat(s.categoria)))].sort((x,y)=>x.localeCompare(y,'es'));
 const getValue=mode==='prioridad'?heatPriority:mode==='estado'?heatStatus:s=>cleanCat(s.categoria);
 const grouped=new Map();data.forEach(s=>{const list=grouped.get(s.juntaId)||[];list.push(s);grouped.set(s.juntaId,list)});
 const term=heatSearch.value.trim().toLocaleLowerCase('es');
 const js=Object.values(juntas).filter(j=>{const cases=grouped.get(j.id)||[];if(!cases.length)return false;if(term&&!String(j.nombre+' '+(j.codigo||'')+' '+(j.folio||'')).toLocaleLowerCase('es').includes(term))return false;if(heatRisk.value==='critical'&&!cases.some(s=>!esSolicitudResuelta(s)&&heatPriority(s)==='Crítica'))return false;if(heatRisk.value==='high'&&!cases.some(s=>!esSolicitudResuelta(s)&&['Crítica','Alta'].includes(heatPriority(s))))return false;return true});
 const score=j=>{const cases=grouped.get(j.id)||[];return cases.filter(s=>!esSolicitudResuelta(s)&&heatPriority(s)==='Crítica').length*10000+cases.filter(s=>!esSolicitudResuelta(s)&&heatPriority(s)==='Alta').length*100+cases.length};
 js.sort((a,b)=>heatSort.value==='name'?a.nombre.localeCompare(b.nombre,'es'):heatSort.value==='volume'?(grouped.get(b.id)||[]).length-(grouped.get(a.id)||[]).length||a.nombre.localeCompare(b.nombre,'es'):score(b)-score(a)||a.nombre.localeCompare(b.nombre,'es'));
 const size=+heatSize.value,totalPages=Math.max(1,Math.ceil(js.length/size));heatPage=Math.min(heatPage,totalPages);const pageJuntas=js.slice((heatPage-1)*size,heatPage*size);
 const root=document.getElementById('heatmap'),detail=document.getElementById('heatDetail'),legend=document.getElementById('heatLegend');
 detail.innerHTML='';
 legend.textContent=mode==='prioridad'?'Rojo: crítica · Naranja: alta · Amarillo: media · Verde: baja · Gris: sin casos. El color representa la gravedad, no el volumen.':
 mode==='estado'?'Amarillo: pendiente · Azul: en proceso · Rojo: estado crítico · Verde: resuelta · Gris: sin casos.':
 'Categorías: color por cantidad de casos activos (0 gris, 1–2 verde, 3–6 amarillo, 7–11 naranja, 12+ rojo).';
 if(!js.length||!cols.length){document.getElementById('heatPagination').innerHTML='';root.innerHTML='<p class="text-muted">Sin solicitudes para los filtros seleccionados.</p>';return}
 root.innerHTML='<table class="heat-grid"><thead><tr><th>Junta</th>'+cols.map(c=>'<th>'+heatEscape(c)+'</th>').join('')+'</tr></thead><tbody>'+pageJuntas.map(j=>'<tr><th>'+heatEscape(j.nombre)+'</th>'+cols.map((c,i)=>{
 const n=data.filter(s=>s.juntaId===j.id&&getValue(s)===c).length;
 const cls=n===0?'heat-empty':mode==='prioridad'?['heat-critical','heat-high','heat-mid','heat-low','heat-empty'][i]:
 mode==='estado'?['heat-mid','heat-process','heat-critical','heat-low'][i]:
 n>=12?'heat-critical':n>=7?'heat-high':n>=3?'heat-mid':'heat-low';
 return '<td><button type="button" class="'+cls+'" data-j="'+heatEscape(j.id)+'" data-c="'+heatEscape(c)+'" title="Ver '+n+' solicitudes">'+n+'</button></td>';
 }).join('')+'</tr>').join('')+'</tbody></table>';
 const pager=document.getElementById('heatPagination');pager.innerHTML='<small class="text-muted">Mostrando '+((heatPage-1)*size+1)+'–'+Math.min(heatPage*size,js.length)+' de '+js.length+' juntas · Página '+heatPage+' de '+totalPages+'</small><div class="d-flex gap-2"><button type="button" id="heatPrev" class="btn btn-outline-secondary btn-sm" '+(heatPage===1?'disabled':'')+'>Anterior</button><button type="button" id="heatNext" class="btn btn-outline-secondary btn-sm" '+(heatPage===totalPages?'disabled':'')+'>Siguiente</button></div>';
 pager.querySelector('#heatPrev').onclick=()=>{heatPage--;renderHeatmap(filtered())};pager.querySelector('#heatNext').onclick=()=>{heatPage++;renderHeatmap(filtered())};
 root.querySelectorAll('button[data-j]').forEach(b=>b.addEventListener('click',()=>{
 const junta=juntas[b.dataset.j],label=b.dataset.c;
 const rows=data.filter(s=>s.juntaId===junta.id&&getValue(s)===label);
 detail.innerHTML='<div class="heat-details"><strong>'+heatEscape(junta.nombre)+' — '+heatEscape(label)+'</strong><p>'+rows.length+' solicitudes</p>'+
 (rows.length?'<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Folio</th><th>Estado</th><th>Prioridad</th><th>Encargado</th></tr></thead><tbody>'+
 rows.map(s=>'<tr><td><a href="solicitud-detalle.html?folio='+encodeURIComponent(s.folio)+'">'+heatEscape(s.folio)+'</a></td><td>'+heatEscape(s.estado)+'</td><td>'+heatEscape(s.prioridad)+'</td><td>'+heatEscape(s.encargado||'Sin asignar')+'</td></tr>').join('')+'</tbody></table></div>':'<p>Sin casos en esta combinación.</p>')+'</div>';
 }));
}
render();
