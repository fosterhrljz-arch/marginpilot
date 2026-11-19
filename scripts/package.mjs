import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import JSZip from 'jszip';
const zip=new JSZip(),root=zip.folder('MarginPilot');
root.file('MarginPilot.html',await readFile('release/MarginPilot.html'));
for(const name of ['README.md','README.zh-CN.md','package.json','THIRD-PARTY-NOTICES.txt'])root.file(name,await readFile(name));
async function add(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=join(dir,f.name);if(f.isDirectory())await add(p);else root.file(p.replaceAll('\\','/'),await readFile(p));}}
for(const dir of ['src','scripts','tests'])await add(dir);
for(const f of await readdir('docs'))if(/-(zh|en)\.png$/.test(f))root.file('docs/'+f,await readFile('docs/'+f));
for(const f of await readdir('samples'))if(/^template-(zh|en)\.(csv|xlsx)$/.test(f))root.file('samples/'+f,await readFile('samples/'+f));
const out=resolve('../MarginPilot-v1.1.1.zip');await writeFile(out,await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}}));console.log('Created '+out);
