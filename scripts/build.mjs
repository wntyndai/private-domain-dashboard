import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(dirname(fileURLToPath(import.meta.url)));
const plugin=process.env.DATA_PLUGIN_ROOT;
if(!plugin||!fs.existsSync(join(plugin,'scripts/data-app.mjs')))throw new Error('Set DATA_PLUGIN_ROOT to your installed Data plugin directory. See README.md.');
const workArg=process.argv.indexOf('--work-dir');
const work=resolve(workArg>=0?process.argv[workArg+1]:join(root,'.build'));
function run(script,args=[]){const p=spawnSync(process.execPath,[script,...args],{cwd:root,stdio:'inherit'});if(p.status!==0)throw new Error(`Command failed: ${script}`);}
run(join(root,'scripts/generate-demo.mjs'));
if(!fs.existsSync(work))run(join(plugin,'scripts/prepare-data-app.mjs'),['--surface','dashboard','--blank','--output',work,'--snapshot',join(root,'data/demo-snapshot.json')]);
fs.cpSync(join(root,'src/content'),join(work,'src/content'),{recursive:true});
fs.copyFileSync(join(root,'src/theme.css'),join(work,'src/theme.css'));
fs.copyFileSync(join(root,'data/demo-snapshot.json'),join(work,'src/data.json'));
run(join(plugin,'scripts/data-app.mjs'),['build','--project-dir',work,'--separate-data']);
const htmlPath=join(work,'.data-app-offline/exports/public-demo.html');
run(join(plugin,'scripts/data-app.mjs'),['export-offline','--project-dir',work,'--output',htmlPath]);
let html=fs.readFileSync(htmlPath,'utf8');
// The shared template's optional local editor context does not belong in a public artifact.
html=html.replace(/<meta\b[^>]*name=["']data-app-local-(?:thread|reference)["'][^>]*>/gi,'');
// User-requested public presentation: omit the Ask and Publish buttons.
html=html.replace('</head>','<style id="public-demo-chrome">.dashboard-ask-button,.dashboard-publish-button{display:none!important}</style></head>');
fs.writeFileSync(join(root,'index.html'),html);
run(join(root,'scripts/check-public.mjs'));
