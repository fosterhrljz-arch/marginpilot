let language='zh';
export const getLanguage=()=>language;
export function setLanguage(value){language=value==='en'?'en':'zh';}
export function t(zh,en,values={}){return (language==='en'?en:zh).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));}
export class UserError extends Error{constructor(zh,en){super(en);this.zh=zh;this.en=en;}}
export const fail=(zh,en)=>{throw new UserError(zh,en);};
export const errorText=e=>e?.zh?t(e.zh,e.en):t('操作未完成。请检查文件或浏览器的存储权限。','The action could not be completed. Check the file or your browser storage permissions.');
export const label=(record,key='name')=>language==='en'&&record?.[key+'En']?record[key+'En']:(record?.[key]||'');
export const money=(value,digits=2)=>value==null?t('待补全','Incomplete'):'¥'+(value/100).toLocaleString(language==='en'?'en-US':'zh-CN',{minimumFractionDigits:digits,maximumFractionDigits:digits});
export const statusLabel=value=>value==='recorded'?t('已核实','Verified'):value==='missing'?t('待补全','Missing'):value==='estimated'?t('估算','Estimated'):t('未核实','Unverified');
export const CATEGORIES=[['房租','Rent'],['水电','Utilities'],['人工','Wages'],['运输','Transport'],['包装','Packaging'],['损耗','Spoilage'],['其他','Other']];
export const categoryLabel=value=>{const c=CATEGORIES.find(c=>c.includes(value));return c?t(...c):value;};
export const normalizeCategory=value=>CATEGORIES.find(c=>c.includes(value))?.[0]||value||'其他';
export const typeLabel=value=>({sales:t('商品销售','Product sales'),dailySales:t('每日销售合计','Daily sales total'),expenses:t('日常开支','Expenses'),purchases:t('进货付款','Inventory purchases')})[value];
