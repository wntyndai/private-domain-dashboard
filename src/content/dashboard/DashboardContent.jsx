import React, { useMemo, useState } from 'react';
import { DataComponent, DataTable, Dropdown, EvidenceChart, MetricCard, SortableItem, SortableRegion, useDataApp, useDashboardTabs } from '../../data-app-public.jsx';
import './dashboard.css';
import {useOperations,ChangeSummary,MonthToDate,ResourceRanking} from './OperationsPanels.jsx';
import {RateTrend} from './RateTrend.jsx';
import {ResourceScatter} from './ResourceScatter.jsx';
import {monthLength} from './operations.js';
const tabs=[{id:'overview',label:'经营总览',previousLabels:['当日总览']},{id:'resources',label:'资源位分析'},{id:'groups',label:'群转化'},{id:'recall',label:'召回链路'}];
const channels=[['app资源位',10],['小程序弹窗',13],['APP新人专区',16],['小程序新人专区',19]];
const num=n=>n==null?'—':n.toLocaleString('zh-CN',{maximumFractionDigits:1});
const show=r=>r?.value==null?'—':r.rawValue;
const previous=d=>{const monthly=d.length===7,x=new Date((monthly?d+'-01':d)+'T12:00:00Z');if(monthly)x.setUTCMonth(x.getUTCMonth()-1);else x.setUTCDate(x.getUTCDate()-1);return x.toISOString().slice(0,monthly?7:10)};
const signed=(value,digits=1)=>{const n=Number(value.toFixed(digits));return `${n>0?'+':''}${num(n)}`;};
function change(a,b){
 if(a?.value==null||b?.value==null)return '—';
 const difference=a.value-b.value;
 if(a.valueKind==='rate')return `${signed(difference*100)}pp`;
 const absolute=a.valueKind==='currency'||b.valueKind==='currency'?`${signed(difference/10000)}万`:signed(difference);
 return `${absolute}（${b.value===0?'—':signed(difference/Math.abs(b.value)*100)+'%'}）`;
}
const line=(fields,labels,extra={})=>({type:'line',x:'displayDate',y:fields[0],fields,showXAxisLabel:false,showYAxisLabel:false,showLegend:fields.length>1,showAllTicks:true,xTickLabelLayout:'angled',stackable:false,legend:{labels},...extra});
export function DashboardContent(){
 const {snapshot,queries,filters,setFilter,visible}=useDataApp();
 const [grain,setGrain]=useState('daily');
 const monthly=grain==='monthly',R=`resource_${grain}`,G=`group_${grain}`;
 const {activeTabId}=useDashboardTabs(tabs),tab=tabs.some(t=>t.id===activeTabId)?activeTabId:'overview';
 const allR=queries[R]?.rows??[],allG=queries[G]?.rows??[];
 const [days,setDays]=useState('30'),[scope,setScope]=useState('全部'),[search,setSearch]=useState('');
 const dates=useMemo(()=>[...new Set((tab==='resources'||tab==='recall'?allR:allG).map(r=>r.date))].sort().reverse(),[allR,allG,tab]);
 const selectedDate=filters[monthly?'businessMonth':'businessDate'];
 const date=dates.includes(selectedDate)?selectedDate:dates[0];
 const ops=useOperations(queries,tab,date,monthly);
 const incompleteMonth=monthly&&date===snapshot.latestDate.slice(0,7)&&Number(snapshot.latestDate.slice(8))<monthLength(date);
 const index=useMemo(()=>new Map([...allR.map(r=>[`${R}:${r.date}:${r.rowId}`,r]),...allG.map(r=>[`${G}:${r.date}:${r.rowId}`,r])]),[allR,allG]);
 const get=(q,id,d=date)=>index.get(`${q}:${d}:r${id}`),range=dates.filter(d=>d<=date).slice(0,monthly?12:Number(days)).reverse();
 const periodTitle=title=>monthly?title.replaceAll('当日','当月').replaceAll('每日','每月').replace('每日记录','月度记录'):title;
 const source=(q,ids,history=false)=>(q===R?allR:allG).filter(r=>(history?range.includes(r.date):r.date===date)&&ids.includes(Number(r.rowId.slice(1))));
 const series=(q,fields)=>range.map(d=>Object.fromEntries([['date',d],...fields.map(([key,id])=>[key,get(q,id,d)?.value??null])]));
 const cards=[];
 function add(id,kind,span,node){cards.push({id,kind,span,node});}
 function metric(q,id,title){const key=`${tab}-${q}-${id}`,cur=get(q,id),prior=get(q,id,previous(date)),delta=incompleteMonth?'未满月 · 变化见同期对比':change(cur,prior);add(key,'metric',3,<MetricCard id={key} queryId={q} title={periodTitle(title??cur?.metric??'')} value={show(cur)} comparison={delta} deltaTone="neutral" displayRows={cur?[{...cur,previousValue:prior?.value??null,comparison:delta}]:[]} sourceRows={source(q,[id],true)} trendValues={range.map(d=>get(q,id,d)?.value??null)} trendLabel="所选时段趋势"/>);}
 function chart(id,q,title,fields,labels,extra={}){
  const key=`${tab}-${id}${monthly?'-monthly':''}`,{inWan=false,...options}=extra;
  const rows=series(q,fields).map(row=>({...row,displayDate:monthly?row.date.replace('-', '年')+'月':row.date.slice(5),...(inWan?Object.fromEntries(fields.map(([field])=>[field,row[field]==null?null:row[field]/10000])):{})}));
  if(fields.every(([field])=>/Rate$/.test(field))){add(key,'chart',6,<RateTrend id={key} queryId={q} title={periodTitle(title)} rows={rows} fields={fields} labels={labels} sourceRows={source(q,fields.map(f=>f[1]),true)}/>);return;}
  const chartSpec=line(fields.map(f=>f[0]),labels,options);
  chartSpec.xTickStride=monthly?1:2;
  add(key,'chart',6,<EvidenceChart id={key} queryId={q} title={periodTitle(title)} variant="card" rows={rows} sourceRows={source(q,fields.map(f=>f[1]),true)} spec={chartSpec} height={280} renderPlot={(plot,effective)=><div className={`sy-trend-chart${!monthly&&['bar','stackedBar'].includes(effective.type)&&effective.x==='displayDate'&&effective.xTickLabelLayout==='date-time'?' sy-daily-bar-dates':''}`}>{plot}</div>}/>);
 }
 function table(id,q,title,rows,columns,src,controls){const key=`${tab}-${id}${monthly?'-monthly':''}`;add(key,'table',12,<DataComponent id={key} queryId={q} title={periodTitle(title)} kind="table" variant="card" displayRows={rows} sourceRows={src}><DataTable rows={rows} columns={columns} pageSize={12} rowKey="id" toolbarControls={controls}/></DataComponent>);}
 add(`${tab}-operating-summary`,'summary',12,<ChangeSummary id={`${tab}-operating-summary`} tab={tab} monthly={monthly} date={date} ops={ops}/>);
 add(`${tab}-month-to-date`,'table',12,<MonthToDate id={`${tab}-month-to-date`} tab={tab} ops={ops}/>);
 if(tab==='resources')add('resources-contribution-ranking','table',12,<ResourceRanking id="resources-contribution-ranking" ops={ops} date={date} monthly={monthly}/>);
 if(tab==='resources')add('resources-scale-conversion','chart',12,<ResourceScatter id="resources-scale-conversion" ops={ops} date={date} monthly={monthly}/>);
 if(tab==='overview'){
  metric(R,3,'当日加 C 用户');metric(R,4,'加 C 当日进群');metric(R,5,'加 C 当日进群率');metric(G,7,'当日新增进群');
  metric(G,10,'当日在群支付人数');metric(G,11,'当日在群支付 GMV');metric(G,13,'当日在群核销人数');metric(G,14,'当日在群核销 GMV');
  chart('acquisition',R,'加 C 与当日进群趋势',[['addUsers',3],['joinUsers',4]],{addUsers:'加 C 用户',joinUsers:'加 C 当日进群'});
  chart('revenue',G,'当日在群支付与核销 GMV（万）',[['paymentWan',11],['redemptionWan',14]],{paymentWan:'支付 GMV（万）',redemptionWan:'核销 GMV（万）'},{inWan:true,valueDecimals:1,type:'bar',xTickLabelLayout:'date-time'});
  metric(G,2,'累计进群人数');metric(G,3,'累计在群人数');metric(G,4,'累计留存率');metric(G,6,'累计在群新客占比');
 }
 if(tab==='resources'){
  metric(R,3,'当日加 C 用户');metric(R,4,'加 C 当日进群');metric(R,5,'加 C 当日进群率');metric(R,7,'累计进群率');
  chart('acquisition',R,'加 C 与进群趋势',[['addUsers',3],['sameDayUsers',4],['joinedUsers',6]],{addUsers:'加 C 用户',sameDayUsers:'加 C 当日进群',joinedUsers:'累计进群用户'});
  chart('conversion',R,'进群与留存率',[['sameDayRate',5],['joinRate',7],['retentionRate',9]],{sameDayRate:'加 C 当日进群率',joinRate:'累计进群率',retentionRate:'累计进群留存率'});
  const rows=channels.map(([name,id])=>({id:name,channel:name,add:get(R,id)?.value,joined:get(R,id+1)?.value,joinRate:get(R,id+2)?.value}));
  add('resources-channel-mix','chart',6,<EvidenceChart id="resources-channel-mix" queryId={R} title="资源位加 C 人数" variant="card" rows={rows} sourceRows={source(R,channels.map(c=>c[1]))} spec={{type:'pie',x:'channel',y:'add',showLegend:true,legend:{showValues:true},showXAxisLabel:false,showYAxisLabel:false}} height={280}/>);
  chart('channels',R,'各资源位加 C 趋势',channels.map(([n,id])=>[n,id]),Object.fromEntries(channels.map(([n])=>[n,n])));
  table('channels-table',R,'资源位转化明细',rows,[{field:'channel',label:'资源位'},{field:'add',label:'加 C 用户数'},{field:'joined',label:'进群用户数'},{field:'joinRate',label:'进群率',renderCell:v=>v==null?'—':(v*100).toFixed(1)+'%'}],source(R,channels.flatMap(c=>[c[1],c[1]+1,c[1]+2])));
  metric(R,6,'累计进群用户数');metric(R,8,'累计在群用户数');metric(R,9,'累计进群留存率');
 }
 if(tab==='groups'){
  metric(G,7,'新增进群人数');metric(G,8,'在群人数');metric(G,9,'留存率');metric(G,40,'新客进群人数');
  chart('scale',G,'每日新增进群与新客进群',[['joinUsers',7],['newUsers',40]],{joinUsers:'新增进群',newUsers:'新客进群'},{type:'stackedBar',xTickLabelLayout:'date-time'});
  chart('payment',G,'当日在群支付与核销人数',[['paidUsers',10],['redeemedUsers',13]],{paidUsers:'支付人数',redeemedUsers:'核销人数'});
  metric(G,10,'当日在群支付人数');metric(G,12,'当日在群支付率');metric(G,13,'当日在群核销人数');metric(G,15,'当日在群核销率');
  const sections=[...new Set(allG.map(r=>r.section))];
  const rows=allG.filter(r=>r.date===date&&(scope==='全部'||r.section===scope)&&(!search||r.metric.includes(search))).map(r=>({...r,id:r.rowId,shown:show(r),previous:show(get(G,Number(r.rowId.slice(1)),previous(date)))}));
  table('all-metrics',G,'群转化完整指标',rows,[{field:'section',label:'指标分组'},{field:'metric',label:'指标名称'},{field:'shown',label:date},{field:'previous',label:monthly?'上月':'前一日'}],allG.filter(r=>[date,previous(date)].includes(r.date)&&rows.some(row=>row.rowId===r.rowId)),<div className="sy-table-controls"><Dropdown label="指标分组" value={scope} choices={['全部',...sections]} onChange={setScope}/><input aria-label="搜索指标" value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索支付、核销、30日…"/></div>);
 }
 if(tab==='recall'){
  metric(R,22,'累计触达人数');metric(R,23,'累计进群人数');metric(R,24,'累计进群率');
  chart('reach',R,'累计触达人数',[['reachUsers',22]],{reachUsers:'累计触达人数'});
  chart('joined',R,'累计进群人数',[['joinedUsers',23]],{joinedUsers:'累计进群人数'});
  chart('rate',R,'累计进群率',[['joinRate',24]],{joinRate:'累计进群率'});
  table('daily',R,'召回链路每日记录',series(R,[['reachUsers',22],['joinedUsers',23],['joinRate',24]]).reverse().map(r=>({...r,id:r.date})),[{field:'date',label:monthly?'月份':'日期'},{field:'reachUsers',label:'累计触达人数'},{field:'joinedUsers',label:'累计进群人数'},{field:'joinRate',label:'累计进群率',renderCell:v=>v==null?'—':(v*100).toFixed(1)+'%'}],source(R,[22,23,24],true));
 }
 if(monthly&&!incompleteMonth){
  const picks=tab==='overview'?[[R,[3,4,5]],[G,[7,10,11,13,14,2,3,4,6]]]:tab==='resources'?[[R,[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21]]]:tab==='groups'?[[G,[7,8,9,40,10,11,12,13,14,15]]]:[[R,[22,23,24]]];
  for(const [q,ids] of picks){const rows=ids.map(id=>{const cur=get(q,id),prior=get(q,id,previous(date));return {id:`${q}-${id}`,section:cur?.section,metric:cur?.metric,current:show(cur),previous:show(prior),change:change(cur,prior)}});
   table(`month-comparison-${q}`,q,`${q===R?'资源位／召回':'群转化'} · 月度对比`,rows,[{field:'section',label:'分组'},{field:'metric',label:'指标'},{field:'current',label:date},{field:'previous',label:previous(date)},{field:'change',label:'变化（环比）'}],(q===R?allR:allG).filter(r=>[date,previous(date)].includes(r.date)&&ids.includes(Number(r.rowId.slice(1)))));
  }
 }
 return <article className="sy-dashboard"><div className="sy-context"><div><span className="sy-eyebrow">PRIVATE DOMAIN · GROWTH</span><p>从进群到转化，让每日经营一目了然。</p></div><span>公开演示 · 全部数值为模拟数据</span></div>
  <div className="sy-toolbar"><div className="sy-controls"><Dropdown label="统计粒度" showLabel value={grain} choices={['daily','monthly']} choiceLabels={{daily:'日度',monthly:'月度'}} onChange={setGrain}/><Dropdown label={monthly?'业务月份':'业务日期'} showLabel value={date} choices={dates} onChange={v=>setFilter(monthly?'businessMonth':'businessDate',v)}/>{!monthly&&<Dropdown label="趋势区间" showLabel value={days} choices={['7','14','30']} choiceLabels={{7:'近 7 日',14:'近 14 日',30:'近 30 日'}} onChange={setDays}/>}</div><span className="sy-freshness"><i/>{monthly?'月汇总截至 '+dates[0]:'数据截至 '+snapshot.latestDate} · 模拟数据</span></div>
  <p className="sy-comparison-note">{monthly?`近 6 个月趋势 · ${date}${incompleteMonth?' 尚未结束，环比请看月内同期对比':' · 示例月度值对比 '+previous(date)}`:`${date} 对比 ${previous(date)}`} · 数量／金额：增减值（环比） · 比例：百分点差 pp{monthly?' · 已有月汇总优先，历史月份按日数据补齐':''}</p>
  <SortableRegion id={`sy-${tab}`} variant="freeform" className="sy-grid" label="看板卡片">{cards.filter(c=>visible(c.id)).map(c=><SortableItem key={c.id} id={c.id} kind={c.kind} label={c.id} className={`sy-span-${c.span}`}>{c.node}</SortableItem>)}</SortableRegion>
  <footer className="sy-footer"><span>{monthly?'业务月份':'业务日期'} {date} · 趋势 {range[0]} — {range.at(-1)} · 缺失／上期为零时环比以 — 展示</span><span>示例生成 {new Date(snapshot.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}</span></footer></article>;
}
