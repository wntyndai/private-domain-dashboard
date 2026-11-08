// All numbers are generated from fixed public seeds. No production file is read.
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const catalog=JSON.parse(fs.readFileSync(join(root,'data/metrics.json'),'utf8'));
const first='2026-06-01',last='2026-11-07';
const dates=[];
for(let t=Date.parse(first+'T00:00:00Z');t<=Date.parse(last+'T00:00:00Z');t+=86400000)dates.push(new Date(t).toISOString().slice(0,10));
function noise(key){let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967296;}
const ratios={resource:{5:[4,3],7:[6,3],9:[8,6],12:[11,10],15:[14,13],18:[17,16],21:[20,19],24:[23,22]},group:{4:[3,2],6:[5,3],9:[8,7],12:[10,8],15:[13,8],42:[41,40],45:[43,41],48:[46,41]}};
for(const id of [17,20,23,26,29,32,35,38])ratios.group[id]=[id-1,7];
for(const id of [50,53,56,59,62,65,68,71])ratios.group[id]=[id-1,40];
const stock={resource:new Set([22,23]),group:new Set([2,3,5])};
function applyRatios(f,v){for(const [id,[a,b]] of Object.entries(ratios[f]))v[id]=v[b]?v[a]/v[b]:null;return v;}
function display(value,kind){return value==null?'—':kind==='rate'?`${(value*100).toFixed(1)}%`:kind==='currency'?`${value.toLocaleString('zh-CN')} 元`:value.toLocaleString('zh-CN');}
function rowsFor(f,date,values,grain){return catalog[f].map(m=>({date,rowId:m.id,metric:m.label,section:m.section,value:values[Number(m.id.slice(1))],rawValue:display(values[Number(m.id.slice(1))],m.valueKind),valueKind:m.valueKind,grain}));}
const queries={};
for(const f of ['resource','group']){
 const daily=[];const byDate=new Map();
 let cumulative=12000,touch=20000,recall=2100;
 for(const date of dates){
  const v={};
  for(const m of catalog[f]){const id=Number(m.id.slice(1)),r=noise(`${f}:${date}:${id}`);v[id]=m.valueKind==='rate'?Number((.25+r*.5).toFixed(4)):m.valueKind==='currency'?Math.round(9000+r*160000):Math.round(30+r*170);}
  if(f==='resource'){
   let adds=0,joins=0;
   for(const id of [10,13,16,19]){v[id]=Math.round(25+noise(date+':channel:'+id)*90);v[id+1]=Math.round(v[id]*(.22+noise(date+':join:'+id)*.38));adds+=v[id];joins+=v[id+1];}
   Object.assign(v,{3:adds,4:Math.round(joins*.68),6:joins,8:Math.round(joins*.83),22:touch+=Math.round(180+noise(date+':touch')*170),23:recall+=Math.round(18+noise(date+':recall')*23)});
  }else{
   v[7]=Math.round(45+noise(date+':groups')*100);v[8]=Math.round(v[7]*.82);v[40]=Math.round(v[7]*.62);v[41]=Math.round(v[40]*.81);
   v[2]=cumulative+=v[7];v[3]=Math.round(v[2]*.63);v[5]=Math.round(v[3]*.57);
   v[10]=Math.round(v[8]*.32);v[11]=v[10]*Math.round(800+noise(date+':pay')*900);
   v[13]=Math.round(v[8]*.22);v[14]=v[13]*Math.round(700+noise(date+':redeem')*800);
   v[43]=Math.round(v[41]*.3);v[44]=v[43]*950;v[46]=Math.round(v[41]*.2);v[47]=v[46]*850;
   for(const [rid,[num,den]] of Object.entries(ratios.group)){if(Number(rid)<=15||[42,45,48].includes(Number(rid)))continue;v[num]=Math.round(v[den]*(.16+noise(date+':cohort:'+rid)*.35));v[Number(num)+2]=v[num]*Math.round(600+noise(date+':gmv:'+rid)*1100);}
  }
  applyRatios(f,v);byDate.set(date,v);daily.push(...rowsFor(f,date,v,'daily'));
 }
 const months=[...new Set(dates.map(d=>d.slice(0,7)))];
 const monthly=months.flatMap(month=>{
  const selected=dates.filter(d=>d.startsWith(month)),lastV=byDate.get(selected.at(-1)),v={};
  for(const m of catalog[f]){const id=Number(m.id.slice(1));v[id]=stock[f].has(id)?lastV[id]:selected.reduce((sum,d)=>sum+byDate.get(d)[id],0);}
  applyRatios(f,v);return rowsFor(f,month,v,'monthly');
 });
 for(const [suffix,rows,grain] of [['daily',daily,'daily'],['history',daily,'daily'],['monthly',monthly,'monthly']]){
  const periods=[...new Set(rows.map(r=>r.date))];
  queries[`${f}_${suffix}`]={rows,grain,metrics:catalog[f].map(({valueKind,...m})=>m),coverage:{start:periods[0],end:periods.at(-1),periods:periods.length},source:{label:'独立生成的模拟数据',caveats:['全部数值来自公开种子；不代表真实经营结果。SQL 模板未连接数据库执行。'],evidenceFlow:[{title:'模拟数据生成',detail:'scripts/generate-demo.mjs，仅读取公开指标字典，不读取外部数据。'}],links:[],files:[],filters:[],metricDefinitions:[]}};
 }
}
const snapshot={id:'dashboard:0d3bc285-141e-4cff-b735-1e94eea11926',surface:'dashboard',title:'私域新客群监控看板（公开演示版）',status:'demo',buildStatus:'complete',generatedAt:'2026-11-08T00:00:00.000Z',latestDate:last,sourceUrl:null,refreshPolicy:{cadence:'manual',source:'独立模拟数据',mode:'public-demo',timezone:'Asia/Shanghai'},filters:[{id:'businessDate',label:'业务日期',field:'date',defaultValue:last,queryIds:['resource_daily','group_daily']},{id:'businessMonth',label:'业务月份',field:'date',defaultValue:last.slice(0,7),queryIds:['resource_monthly','group_monthly']}],queries};
fs.writeFileSync(join(root,'data/demo-snapshot.json'),JSON.stringify(snapshot));
console.log('Generated synthetic snapshot; no real data input.');
