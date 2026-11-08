import React,{useEffect,useRef,useState,useId} from 'react';
import {EvidenceChart,ChartMark,ChartTooltip,useDataApp} from '../../data-app-public.jsx';
import {smoothPath} from './smooth-path.js';

// A bounded probability plot: its measurement scale is always 0–100%.
export function RateTrend({id,queryId,title,rows,fields,labels,sourceRows}){
 const {chartOverrides}=useDataApp();
 const spec={type:'line',x:'displayDate',y:fields[0][0],fields:fields.map(([f])=>f),showXAxisLabel:false,showYAxisLabel:false,showLegend:fields.length>1,showAllTicks:true,xTickStride:rows[0]?.date?.length===10?2:1,xTickLabelLayout:'angled',stackable:false,legend:{labels}};
 return <EvidenceChart id={id} queryId={queryId} title={title} variant="card" rows={rows} sourceRows={sourceRows} spec={spec} height={300} description="默认纵轴固定为 0%—100%，间隔 20 个百分点；空值保留断点。" renderPlot={(plot)=>chartOverrides?.[id]?<div className="sy-trend-chart">{plot}</div>:<FixedRatePlot title={title} rows={rows} fields={fields} labels={labels}/>}/>;
}
function FixedRatePlot({title,rows,fields,labels}){
 const [hidden,setHidden]=useState([]),[width,setWidth]=useState(480);
 const ref=useRef(null),clip=useId().replaceAll(':','');
 useEffect(()=>{const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));if(ref.current)observer.observe(ref.current);return()=>observer.disconnect();},[]);
 const time=d=>Date.parse(d.length===7?d+'-01':d),first=time(rows[0]?.date??'2000-01-01'),last=time(rows.at(-1)?.date??'2000-01-01');
 const position=row=>first===last?50:3+(time(row.date)-first)/(last-first)*94;
 const stride=rows[0]?.date?.length===10?2:1;
 const valid=v=>v!=null&&Number.isFinite(v),visible=fields.filter(([f])=>!hidden.includes(f));
 const outside=rows.some(r=>visible.some(([f])=>valid(r[f])&&(r[f]<0||r[f]>1)));
 function path(field){return smoothPath(rows.map(row=>valid(row[field])?[position(row),100-row[field]*100]:null));}
 return <>
  <div className="sy-rate-frame" data-reviewed-rows data-chart-interaction-root>
   <div className="sy-rate-y">{[100,80,60,40,20,0].map(v=><span key={v} style={{top:`${100-v}%`}}>{v}%</span>)}</div>
   <div className="sy-rate-plot" ref={ref}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${title}，纵轴0%至100%，每20个百分点一档`}>
     <defs><clipPath id={clip}><rect x="0" y="0" width="100" height="100"/></clipPath></defs>
     <g clipPath={`url(#${clip})`}>{fields.map(([field],i)=>!hidden.includes(field)&&<path key={field} d={path(field)} fill="none" stroke={`var(--chart-${i+1})`} strokeWidth="2" vectorEffect="non-scaling-stroke"/>)}</g>
    </svg>
    {rows.map(row=><React.Fragment key={row.date}>
     <ChartMark className="sy-rate-hit" style={{left:`${position(row)}%`,width:`${Math.max(2,90/Math.max(1,rows.length))}%`}} aria-label={`${row.date} ${visible.map(([f])=>`${labels[f]} ${valid(row[f])?(row[f]*100).toFixed(1)+'%':'无数据'}`).join('；')}`} context={{kind:'chart',chartType:'line',label:row.date,row}} tooltip={<ChartTooltip active label={row.date} details={visible.map(([f])=>({label:labels[f],value:valid(row[f])?(row[f]*100).toFixed(2)+'%':'—'}))}/>}/>
    </React.Fragment>)}
    <div className="sy-rate-x">{rows.filter((r,i)=>i%stride===0).map(r=><span key={r.date} style={{left:`${position(r)}%`}}>{r.displayDate}</span>)}</div>
   </div>
  </div>
  <div className="sy-rate-legend">{fields.map(([f],i)=><button key={f} aria-pressed={!hidden.includes(f)} onClick={()=>setHidden(h=>h.includes(f)?h.filter(x=>x!==f):[...h,f])}><i style={{background:`var(--chart-${i+1})`,opacity:hidden.includes(f)?.25:1}}/>{labels[f]}</button>)}</div>
  {outside&&<p className="sy-panel-note">存在超出 0%—100% 的源值，超界部分不绘制；悬停可查看原值。</p>}
 </>;
}
