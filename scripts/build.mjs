import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
await mkdir('release',{recursive:true});
const r=await build({entryPoints:['src/main.jsx'],bundle:true,write:false,minify:true,format:'iife',platform:'browser',target:'es2022',define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
const js=r.outputFiles[0].text,css=await readFile('src/style.css','utf8');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><title>MarginPilot v1.1.1</title><meta name="description" content="记录小店收入与开支，看清利润，试算经营选择。离线使用，数据留在本机。"><style>${css}</style></head><body><div id="root"></div><noscript>请允许浏览器运行 JavaScript，以便在本机计算利润。 Enable JavaScript to calculate profit locally.</noscript><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
await writeFile('release/MarginPilot.html',html);console.log(`Built offline MarginPilot.html (${Math.round(Buffer.byteLength(html)/1024)} KB)`);
