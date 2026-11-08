export const shiftDay=(date,offset)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
export const monthLength=month=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
export const priorMonth=month=>{const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()-1);return d.toISOString().slice(0,7);};
const dayString=(month,day)=>`${month}-${String(day).padStart(2,'0')}`;
export function samePeriod(selected,latest){
 const month=selected.slice(0,7),prior=priorMonth(month);
 const cutoff=selected.length===10?Number(selected.slice(8)):month===latest.slice(0,7)?Number(latest.slice(8)):monthLength(month);
 const count=Math.min(cutoff,monthLength(month),monthLength(prior));
 return {month,prior,days:count,cutoff,currentStart:month+'-01',currentEnd:dayString(month,count),priorStart:prior+'-01',priorEnd:dayString(prior,count),clamped:count<cutoff};
}
export function calendar(start,end){const dates=[];for(let d=start;d<=end;d=shiftDay(d,1))dates.push(d);return dates;}
export function historyIndex(rows){return new Map(rows.map(r=>[`${r.date}:${r.rowId}`,r]));}
const resourceRatios={5:[4,3],7:[6,3],9:[8,6],12:[11,10],15:[14,13],18:[17,16],21:[20,19],24:[23,22]};
const groupRatios={4:[3,2],6:[5,3],9:[8,7]};
const allowedGroup=new Set([2,3,4,5,6,7,8,9,10,11,13,14,40]);
export function aggregate(index,family,id,start,end){
 const row=index.get(`${end}:r${id}`),base={...row,rowId:`r${id}`,value:null,rawValue:'—',start,end};
 if(family==='group'&&!allowedGroup.has(id))return base;
 const ratio=(family==='resource'?resourceRatios:groupRatios)[id];
 if(ratio){
  const a=aggregate(index,family,ratio[0],start,end),b=aggregate(index,family,ratio[1],start,end);
  return {...base,valueKind:'rate',value:a.value!=null&&b.value>0?a.value/b.value:null};
 }
 const stock=family==='resource'?[22,23].includes(id):[2,3,5].includes(id);
 if(stock)return {...base,value:row?.value??null};
 const values=calendar(start,end).map(d=>index.get(`${d}:r${id}`)?.value);
 return {...base,value:values.length&&values.every(v=>v!=null&&Number.isFinite(v))?values.reduce((a,b)=>a+b,0):null};
}
export function formatValue(row){
 const v=row?.value;
 if(v==null||!Number.isFinite(v))return '—';
 if(row.valueKind==='rate')return `${(v*100).toFixed(1)}%`;
 if(row.valueKind==='currency')return `${(v/10000).toLocaleString('zh-CN',{maximumFractionDigits:1})}万`;
 return v.toLocaleString('zh-CN',{maximumFractionDigits:1});
}
const signed=n=>`${n>0?'+':''}${Number(n.toFixed(1)).toLocaleString('zh-CN',{maximumFractionDigits:1})}`;
export function comparison(a,b){
 if(a?.value==null||b?.value==null)return '—';
 const delta=a.value-b.value;
 if(a.valueKind==='rate')return `${signed(delta*100)}pp`;
 const absolute=a.valueKind==='currency'?`${signed(delta/10000)}万`:signed(delta);
 return `${absolute}（${b.value===0?'—':signed(delta/Math.abs(b.value)*100)+'%'}）`;
}
export function dailyBaseline(index,id,date,days=7){
 const rows=calendar(shiftDay(date,-days),shiftDay(date,-1)).map(d=>index.get(`${d}:r${id}`));
 return {...rows[0],value:rows.every(r=>r?.value!=null)?rows.reduce((s,r)=>s+r.value,0)/days:null};
}
export function rankChannels(current,prior){
 const totalAdd=current.every(r=>r.add!=null)?current.reduce((s,r)=>s+r.add,0):null;
 const totalJoined=current.every(r=>r.joined!=null)?current.reduce((s,r)=>s+r.joined,0):null;
 const totalPrior=prior.every(r=>r.joined!=null)?prior.reduce((s,r)=>s+r.joined,0):null;
 const net=totalJoined!=null&&totalPrior!=null?totalJoined-totalPrior:null;
 const rows=current.map(row=>{
  const before=prior.find(r=>r.channel===row.channel),delta=row.joined!=null&&before?.joined!=null?row.joined-before.joined:null;
  return {...row,addShare:totalAdd>0&&row.add!=null?row.add/totalAdd:null,joinShare:totalJoined>0&&row.joined!=null?row.joined/totalJoined:null,
   delta,comparison:comparison({value:row.joined},{value:before?.joined}),netContribution:net!==null&&net!==0&&delta!==null?delta/net:null};
 }).sort((a,b)=>(b.joined??-Infinity)-(a.joined??-Infinity));
 return {rows:rows.map((r,i)=>({...r,rank:r.joined==null?'—':1+rows.filter(x=>x.joined!=null&&x.joined>r.joined).length})),totalJoined,net};
}
