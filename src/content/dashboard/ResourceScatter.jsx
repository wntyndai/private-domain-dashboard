import React from 'react';
import {EvidenceChart,ChartMark,ChartTooltip,useDataApp} from '../../data-app-public.jsx';
import {resourceChannelView} from './OperationsPanels.jsx';

const count=v=>v==null?'—':v.toLocaleString('zh-CN');
const rate=v=>v==null?'—':`${(v*100).toFixed(1)}%`;
export function ResourceScatter({id,ops,date,monthly}){
 const {chartOverrides}=useDataApp();
 const {current,queryId,evidence}=resourceChannelView(ops,date,monthly);
 const start=monthly?ops.window.currentStart:date,end=monthly?ops.window.currentEnd:date;
 const sourceRows=evidence[queryId].filter(r=>r.date>=start&&r.date<=end);
 const rows=current.map((r,i)=>({...r,color:`var(--chart-${i+1})`,number:i+1}));
 const valid=rows.filter(r=>r.add>0&&Number.isFinite(r.joinRate)&&r.joinRate>=0&&r.joinRate<=1);
 const max=Math.max(1,...valid.map(r=>r.add))*1.15;
 const magnitude=10**Math.floor(Math.log10(max/4));
 const step=Math.ceil(max/4/magnitude)*magnitude,upper=step*4;
 // Coincident points keep their true position and share a tooltip.
 const clusters=[...valid.reduce((map,r)=>{const key=`${r.add}:${r.joinRate}`;map.set(key,[...(map.get(key)??[]),r]);return map;},new Map()).values()];
 const spec={type:'scatter',x:'add',y:'joinRate',series:'channel',showLegend:true,xLabel:'加 C 用户数',yLabel:'进群率',showXAxisLabel:true,showYAxisLabel:true};
 return <EvidenceChart id={id} queryId={queryId} title="资源位 · 规模 × 转化率" variant="card" rows={current} sourceRows={sourceRows} spec={spec} height={330}
  description={`${start}${end!==start?'—'+end:''} · 横轴：加 C 用户数；纵轴：进群用户数 ÷ 加 C 用户数。${monthly?'按日累计，与贡献排名采用相同月内窗口。':''}`}
  renderPlot={plot=>chartOverrides?.[id]?plot:<div data-reviewed-rows>
   <p className="sy-panel-note">{start}{end!==start?'—'+end:''}{monthly?' · 月内同期窗口，与贡献排名一致':''} · 进群率 = 进群用户数 ÷ 加 C 用户数</p>
   <div className="sy-scatter-axis-title">进群率</div>
   <div className="sy-rate-frame sy-scatter-frame" data-chart-interaction-root>
    <div className="sy-rate-y">{[100,80,60,40,20,0].map(v=><span key={v} style={{top:`${100-v}%`}}>{v}%</span>)}</div>
    <div className="sy-rate-plot sy-scatter-plot" role="group" aria-label="资源位规模与转化率散点图，纵轴0%到100%">
     {clusters.map(group=>{const r=group[0],label=group.map(x=>x.channel).join(' / ');return <ChartMark key={label} className="sy-scatter-point" style={{left:`${r.add/upper*100}%`,top:`${(1-r.joinRate)*100}%`,background:r.color}} aria-label={group.map(x=>`${x.channel}，加 C ${count(x.add)}，进群 ${count(x.joined)}，进群率 ${rate(x.joinRate)}`).join('；')} context={{kind:'chart',chartType:'scatter',label,rows:group}} tooltip={<ChartTooltip active label={label} details={group.flatMap(x=>[{label:`${x.channel} · 加 C`,value:count(x.add)},{label:'进群用户数',value:count(x.joined)},{label:'进群率',value:rate(x.joinRate)}])}/>}>{group.map(x=>x.number).join('·')}</ChartMark>;})}
     {!valid.length&&<p className="sy-scatter-empty">当前时段暂无可绘制的有效转化率</p>}
     <div className="sy-rate-x">{[0,1,2,3,4].map(i=><span key={i} style={{left:`${i*25}%`}}>{count(step*i)}</span>)}</div>
    </div>
   </div>
   <div className="sy-scatter-x-title">加 C 用户数 →</div>
   <div className="sy-scatter-key">{rows.map(r=><div key={r.id}><b style={{background:r.color}}>{r.number}</b><span><strong>{r.channel}</strong><small>加 C {count(r.add)} · 进群 {count(r.joined)} · {rate(r.joinRate)}{r.joinRate==null?'（无法计算）':r.joinRate<0||r.joinRate>1?'（超出坐标范围）':''}</small></span></div>)}</div>
   <p className="sy-panel-note">越靠右规模越大，越靠上转化率越高。各资源位分别统计；分母为零或缺失时不绘制散点。</p>
  </div>}/>;
}
