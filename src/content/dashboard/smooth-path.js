// Monotone cubic Hermite interpolation. Missing observations split the path.
// The slope limiter prevents the curve overshooting adjacent measured values.
export function smoothPath(points){
 const segments=[];let segment=[];
 for(const point of points){
  if(!point||!point.every(Number.isFinite)){if(segment.length)segments.push(segment);segment=[];}
  else segment.push(point);
 }
 if(segment.length)segments.push(segment);
 return segments.map(p=>{
  if(p.length===1)return `M${p[0][0]} ${p[0][1]}`;
  const slopes=p.slice(1).map((v,i)=>(v[1]-p[i][1])/(v[0]-p[i][0]));
  const tangents=p.map((_,i)=>i===0?slopes[0]:i===p.length-1?slopes.at(-1):(slopes[i-1]+slopes[i])/2);
  slopes.forEach((s,i)=>{
   if(s===0){tangents[i]=0;tangents[i+1]=0;return;}
   if(tangents[i]/s<0)tangents[i]=0;
   if(tangents[i+1]/s<0)tangents[i+1]=0;
   const norm=Math.hypot(tangents[i]/s,tangents[i+1]/s);
   if(norm>3){const scale=3/norm;tangents[i]*=scale;tangents[i+1]*=scale;}
  });
  return `M${p[0][0]} ${p[0][1]}`+p.slice(1).map((v,i)=>{
   const dx=(v[0]-p[i][0])/3;
   return ` C${p[i][0]+dx} ${p[i][1]+dx*tangents[i]} ${v[0]-dx} ${v[1]-dx*tangents[i+1]} ${v[0]} ${v[1]}`;
  }).join('');
 }).join(' ');
}
