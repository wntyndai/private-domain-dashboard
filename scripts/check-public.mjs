import fs from 'node:fs';
import assert from 'node:assert/strict';
import {dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const data=JSON.parse(fs.readFileSync(join(root,'data/demo-snapshot.json'),'utf8'));
assert.equal(data.status,'demo');assert.equal(data.sourceUrl,null);
assert.equal(Object.keys(data.queries).length,6);
const rowKeys=new Set(['date','rowId','metric','section','value','rawValue','valueKind','grain']);
let rowCount=0;
for(const query of Object.values(data.queries)){
 assert.equal(query.source.label,'独立生成的模拟数据');
 assert.deepEqual(Object.keys(query).sort(),['coverage','grain','metrics','rows','source']);
 for(const row of query.rows){rowCount++;assert(Object.keys(row).every(k=>rowKeys.has(k)));assert(Number.isFinite(row.value)||row.value===null);}
}
const html=fs.readFileSync(join(root,'index.html'),'utf8');
const main=html.match(/<script[^>]*id="data-app-reviewed-snapshot"[^>]*>([\s\S]*?)<\/script>/);
assert(main,'Complete offline snapshot is required');
const pieces=[main[1],...Array.from(html.matchAll(/<script[^>]*data-app-snapshot-chunk[^>]*>([\s\S]*?)<\/script>/g),m=>m[1])];
assert.deepEqual(JSON.parse(pieces.join('')),data,'HTML must contain exactly the public synthetic snapshot');
assert(html.includes('sy-daily-bar-dates'),'Date-axis fix must be included');
assert(html.includes('public-demo-chrome'),'Public controls must be applied');
const banned=[/https?:\/\/[^\s"'<>]*\.feishu\.cn\/(?:wiki|sheets|base)\//i,/ou_[a-z0-9]{20,}/i,/gh[pousr]_[A-Za-z0-9]{20,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
 if(['.git','.build','node_modules'].includes(e.name))return [];
 const p=join(dir,e.name);assert(!e.isSymbolicLink(),'No symlinks in public package');return e.isDirectory()?files(p):[p];
});}
const paths=files(root);
for(const path of paths){const rel=relative(root,path);assert(!/\.env(?:\.|$)|credentials|last-sync|reviewed-snapshot|refresh_dashboard|\.bak$/i.test(rel),`Private file: ${rel}`);const text=fs.readFileSync(path,'utf8');for(const pattern of banned)assert(!pattern.test(text),`Private identifier pattern in ${rel}`);}
console.log(JSON.stringify({passed:true,files:paths.length,syntheticRows:rowCount,offlineSnapshotMatches:true}));
