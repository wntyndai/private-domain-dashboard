import React,{useMemo} from 'react';
import {DataComponent,DataTable} from '../../data-app-public.jsx';
import {samePeriod,historyIndex,aggregate,comparison,formatValue,dailyBaseline,shiftDay,rankChannels} from './operations.js';

const channels=[['app资源位',10],['小程序弹窗',13],['APP新人专区',16],['小程序新人专区',19]];
const metrics={overview:[['resource',3,'加 C 用户'],['group',7,'新增进群'],['group',11,'支付 GMV'],['group',14,'核销 GMV']],resources:[['resource',3,'加 C 用户'],['resource',4,'加 C 当日进群'],['resource',5,'当日进群率']],groups:[['group',7,'新增进群'],['group',11,'支付 GMV'],['group',14,'核销 GMV']],recall:[['resource',22,'累计触达'],['resource',23,'累计进群'],['resource',24,'累计进群率']]};
const percent=v=>v==null?'—':`${(v*100).toFixed(1)}%`;
export function useOperations(queries,tab,date,monthly){
 const histories={resource:queries.resource_history?.rows??[],group:queries.group_history?.rows??[]};
 const indices=useMemo(()=>({resource:historyIndex(histories.resource),group:historyIndex(histories.group)}),[histories.resource,histories.group]);
 const families=[...new Set(metrics[tab].map(m=>m[0]))];
 const latest=families.map(f=>queries[`${f}_history`]?.coverage?.end).filter(Boolean).sort()[0]??date;
 const window=samePeriod(date,latest);
 const read=(family,id,prior=false)=>aggregate(indices[family],family,id,prior?window.priorStart:window.currentStart,prior?window.priorEnd:window.currentEnd);
 const records=metrics[tab].map(([family,id,label])=>{
  const current=monthly?read(family,id):indices[family].get(`${date}:r${id}`);
  const prior=monthly?read(family,id,true):indices[family].get(`${shiftDay(date,-1)}:r${id}`);
  const week=indices[family].get(`${shiftDay(date,-7)}:r${id}`),average=dailyBaseline(indices[family],id,date);
  return {id:`${family}-${id}`,family,metricId:id,label,current,prior,shown:formatValue(current),change:comparison(current,prior),week:comparison(current,week),average:comparison(current,average)};
 });
 function evidence(picks,start,end){return Object.fromEntries([...new Set(picks.map(m=>m[0]))].map(f=>[`${f}_history`,histories[f].filter(r=>r.date>=start&&r.date<=end&&picks.some(([family,id])=>family===f&&`r${id}`===r.rowId))]));}
 const expandedPicks=metrics[tab].flatMap(p=>p[0]==='resource'&&p[1]===5?[p,['resource',3],['resource',4]]:p[1]===24?[p,['resource',22],['resource',23]]:[p]);
 const sourceRowsByQuery=evidence(expandedPicks,monthly?window.priorStart:shiftDay(date,-7),monthly?window.currentEnd:date);
 return {histories,indices,window,read,records,evidence,sourceRowsByQuery,resourceDaily:queries.resource_daily?.rows??[]};
}

export function ChangeSummary({id,tab,monthly,date,ops}){
 const sources=Object.keys(ops.sourceRowsByQuery);
 const movements=ops.records.filter(r=>r.current?.value!=null&&r.prior?.value!=null).map(r=>({...r,direction:r.current.value===r.prior.value?'持平':r.current.value>r.prior.value?'上升':'下降'}));
 const headline=movements.length?`${monthly?'较上月同期':'较昨日'}，${movements.map(r=>`${r.label}${r.direction}`).join('，')}。`:'当前缺少完整可比数据，暂不判断变化方向。';
 return <DataComponent id={id} queryId={sources[0]} queryIds={sources} title="经营变化摘要" variant="card" displayRows={ops.records.map(r=>({metric:r.label,value:r.current?.value,previous:r.prior?.value,change:r.change,week:r.week,average:r.average}))} sourceRowsByQuery={ops.sourceRowsByQuery}>
  <p className="sy-panel-note">{monthly?`${ops.window.currentStart}—${ops.window.currentEnd} 对比 ${ops.window.priorStart}—${ops.window.priorEnd}`:`${date} · 较昨日 / 较上周同日 / 较前 7 日均值`}{tab==='recall'?' · 累计值变化，不代表触达归因转化':''}</p>
  <p className="sy-summary-headline" data-reviewed-rows>{headline}</p>
  <div className="sy-summary-grid" data-reviewed-rows>{ops.records.map(r=><div key={r.id} className="sy-summary-item"><span>{r.label}</span><strong>{r.shown}</strong><b>{r.change}</b>{!monthly&&<small>上周同日 {r.week}<br/>前 7 日均值 {r.average}</small>}</div>)}</div>
  <p className="sy-panel-note">{monthly?'发生量为每日指标累计；支付与核销人数不作跨日去重。':'前 7 日均值不含所选当天；所需日期缺失时显示 —。'}</p>
 </DataComponent>;
}

export function MonthToDate({id,tab,ops}){
 const picks=tab==='overview'?[...metrics.overview,['resource',4,'加 C 当日进群'],['resource',5,'加 C 当日进群率']]:metrics[tab];
 const rows=picks.map(([family,metricId,label])=>{const current=ops.read(family,metricId),prior=ops.read(family,metricId,true);return {id:`${family}-${metricId}`,metric:label,current:formatValue(current),prior:formatValue(prior),change:comparison(current,prior)};});
 const w=ops.window;
 const evidence=ops.evidence([...picks,['resource',3],['resource',4],['resource',22],['resource',23]],w.priorStart,w.currentEnd);
 const keys=Object.keys(evidence);
 return <DataComponent id={id} queryId={keys[0]} queryIds={keys} title="月内同期对比" variant="card" displayRows={rows} sourceRowsByQuery={evidence}>
  <p className="sy-panel-note">{w.currentStart}—{w.currentEnd} 对比 {w.priorStart}—{w.priorEnd} · 各 {w.days} 天{w.clamped?' · 两个月按共同可比天数截齐':''}</p>
  <DataTable rows={rows} rowKey="id" pageSize={8} columns={[{field:'metric',label:'指标'},{field:'current',label:`${w.month} 同期`},{field:'prior',label:`${w.prior} 同期`},{field:'change',label:'变化（环比）'}]}/>
  <p className="sy-panel-note">{tab==='recall'?'累计指标比较各期截止日的值。':'发生量按相同天数累计；比例按分子、分母重新计算。'} 任一必需日期缺失或分母为 0 时显示 —。</p>
 </DataComponent>;
}

export function resourceChannelView(ops,date,monthly){
 const dailyIndex=historyIndex(ops.resourceDaily);
 const read=(rid,prior=false)=>monthly?ops.read('resource',rid,prior):dailyIndex.get(`${prior?shiftDay(date,-1):date}:r${rid}`);
 const values=prior=>channels.map(([channel,rid])=>{const add=read(rid,prior)?.value??null,joined=read(rid+1,prior)?.value??null;return {id:channel,channel,add,joined,joinRate:add>0&&joined!=null?joined/add:null};});
 const picks=channels.flatMap(([,id])=>[id,id+1,id+2].map(n=>['resource',n]));
 const queryId=monthly?'resource_history':'resource_daily';
 const evidence=monthly?ops.evidence(picks,ops.window.priorStart,ops.window.currentEnd):{resource_daily:ops.resourceDaily.filter(r=>[date,shiftDay(date,-1)].includes(r.date)&&picks.some(([,n])=>r.rowId===`r${n}`))};
 return {current:values(false),prior:values(true),queryId,evidence};
}
export function ResourceRanking({id,ops,date,monthly}){
 const {current,prior,queryId,evidence}=resourceChannelView(ops,date,monthly);
 const ranking=rankChannels(current,prior);
 const share=v=><span className="sy-share-cell"><span className="sy-share-track"><i style={{width:`${v==null?0:Math.max(0,Math.min(100,v*100))}%`}}/></span>{percent(v)}</span>;
 return <DataComponent id={id} queryId={queryId} title="资源位贡献排名" variant="card" displayRows={ranking.rows} sourceRowsByQuery={evidence}>
  <p className="sy-panel-note">按进群量排序 · {monthly?`${ops.window.currentStart}—${ops.window.currentEnd} 较上月同期`:`${date} 较昨日`} · 四个资源位合计进群 {formatValue({value:ranking.totalJoined})}，净变化 {ranking.net==null?'—':`${ranking.net>0?'+':''}${ranking.net.toLocaleString('zh-CN')}`}</p>
  <DataTable rows={ranking.rows} rowKey="id" pageSize={4} columns={[{field:'rank',label:'排名'},{field:'channel',label:'资源位'},{field:'add',label:'加 C 用户数'},{field:'addShare',label:'加 C 占比',renderCell:share},{field:'joined',label:'进群用户数'},{field:'joinShare',label:'进群占比',renderCell:share},{field:'joinRate',label:'进群率',renderCell:percent},{field:'comparison',label:'进群增减（环比）'}]}/>
  <p className="sy-panel-note">占比的分母为这四个资源位合计；可能包含跨资源位重复用户，不等同于总盘去重人数。月度按日累计，零分母显示 —。</p>
 </DataComponent>;
}
