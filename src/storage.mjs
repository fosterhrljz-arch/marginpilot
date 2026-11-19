import {emptyData,migrateData,validateData,invalidateConfirmations} from './core.mjs';
import {sampleData} from './sample.mjs';
import {UserError,fail} from './i18n.mjs';
export const KEY='marginpilot-v11-';
export function loadBook(storage,mode){try{const raw=storage.getItem(KEY+mode),legacy=raw===null?storage.getItem('marginpilot-v1-'+mode):null;return {data:raw!==null?migrateData(JSON.parse(raw)):legacy!==null?migrateData(JSON.parse(legacy)):mode==='demo'?sampleData():emptyData(),raw,error:null,migrated:legacy!==null};}catch{return {data:mode==='demo'?sampleData():emptyData(),raw:null,migrated:false,error:new UserError('账本读取失败，已暂停写入以保护原数据。可导出原始数据或恢复备份。','The saved book could not be read. Writes are paused to protect it. Export the raw data or restore a backup.')};}}
export function saveBook(storage,mode,before,next,expectedRaw,options={}){
 validateData(next);
 if(!options.restore&&storage.getItem(KEY+mode)!==expectedRaw)fail('另一个窗口修改了账本。请先备份当前内容，再重新打开应用。','Another window changed this book. Back up the current view, then reopen the app.');
 const updated=invalidateConfirmations(before,next,options),raw=JSON.stringify(updated);
 storage.setItem(KEY+mode,raw);return {data:updated,raw};
}
