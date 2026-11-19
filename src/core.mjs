import {fail} from './i18n.mjs';
export {money} from './i18n.mjs';
export const DAY=86400000;
export const iso=d=>d.toISOString().slice(0,10);
export const dateValue=s=>Date.parse(s+'T00:00:00Z');
export const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(dateValue(s))&&iso(new Date(dateValue(s)))===s;
export const days=(a,b)=>Math.round((dateValue(b)-dateValue(a))/DAY)+1;
export function dates(a,b){if(!validDate(a)||!validDate(b)||b<a||days(a,b)>3660)return [];return Array.from({length:days(a,b)},(_,i)=>iso(new Date(dateValue(a)+i*DAY)));}
export function monthRange(date){return [date.slice(0,7)+'-01',iso(new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),0)))];}
export function cents(value){const s=String(value).trim();if(!/^\d+(\.\d{1,2})?$/.test(s))fail('金额须为非负数字，最多两位小数。','Enter a nonnegative amount with at most two decimal places.');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n>10000000000)fail('金额过大，单笔最多一亿元。','Amount too large: the per-entry limit is 100 million yuan.');return n;}
export function quantity(value){const s=String(value).trim();if(!/^\d+$/.test(s)||Number(s)<1||Number(s)>100000)fail('数量须为 1–100000 的整数。','Quantity must be a whole number between 1 and 100,000.');return Number(s);}
export const id=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
export function previousRange(a,b){const n=days(a,b);return [iso(new Date(dateValue(a)-n*DAY)),iso(new Date(dateValue(a)-DAY))];}
export function allocate(exp,a,b){const start=exp.start||exp.date,end=exp.end||exp.date,lo=Math.max(dateValue(start),dateValue(a)),hi=Math.min(dateValue(end),dateValue(b));if(lo>hi)return 0;const n=days(start,end),base=Math.floor(exp.amount/n),remainder=exp.amount%n,i=Math.round((lo-dateValue(start))/DAY),j=Math.round((hi-dateValue(start))/DAY);return base*(j-i+1)+Math.max(0,Math.min(j+1,remainder)-Math.min(i,remainder));}
export function saleCost(s,products){if(s.unitCost!=null)return {cost:s.unitCost*s.qty,status:s.costStatus||'unverified'};const p=products.find(p=>p.id===s.productId);return p?.cost!=null?{cost:p.cost*s.qty,status:'estimated'}:{cost:null,status:'missing'};}
export function report(data,a,b){
 const sales=data.sales.filter(s=>s.date>=a&&s.date<=b),dailySales=(data.dailySales||[]).filter(s=>s.date>=a&&s.date<=b),expenses=data.expenses.filter(e=>e.start<=b&&e.end>=a),purchases=data.purchases.filter(p=>p.date>=a&&p.date<=b);
 let revenue=0,cogs=0,missing=0,estimated=0,unverified=0,knownRevenue=0,recordedRevenue=0,recordedCogs=0;const products=new Map();
 const add=(rev,c)=>{revenue+=rev;if(c.cost===null){missing++;return;}cogs+=c.cost;knownRevenue+=rev;if(c.status==='recorded'){recordedRevenue+=rev;recordedCogs+=c.cost;}else if(c.status==='estimated')estimated++;else unverified++;};
 for(const s of sales){const rev=s.price*s.qty,c=saleCost(s,data.products),product=data.products.find(p=>p.id===s.productId),p=products.get(s.productId)||{id:s.productId,name:product?.name||'',nameEn:product?.nameEn,revenue:0,cost:0,qty:0,missing:0,estimated:0,unverified:0};add(rev,c);p.revenue+=rev;p.qty+=s.qty;if(c.cost===null)p.missing++;else{p.cost+=c.cost;if(c.status==='estimated')p.estimated++;else if(c.status!=='recorded')p.unverified++;}products.set(s.productId,p);}
 for(const s of dailySales)add(s.amount,{cost:s.cogs,status:s.costStatus});
 const expense=expenses.reduce((n,e)=>n+allocate(e,a,b),0),recordedExpense=expenses.filter(e=>e.status==='recorded').reduce((n,e)=>n+allocate(e,a,b),0),estimatedExpense=expenses.filter(e=>e.status==='estimated').reduce((n,e)=>n+allocate(e,a,b),0),unverifiedExpense=expense-recordedExpense-estimatedExpense,estimatedExpenseCount=expenses.filter(e=>e.status==='estimated').length,unverifiedExpenseCount=expenses.filter(e=>e.status!=='recorded'&&e.status!=='estimated').length,unconfirmed=dates(a,b).filter(d=>!data.confirmedDays.includes(d)).length,gross=missing?null:revenue-cogs,net=gross===null?null:gross-expense,categories=Object.create(null);
 for(const e of expenses)categories[e.category]=(categories[e.category]||0)+allocate(e,a,b);
 return {revenue,cogs:missing?null:cogs,knownCogs:cogs,gross,net,expense,recordedExpense,estimatedExpense,unverifiedExpense,estimatedExpenseCount,unverifiedExpenseCount,recordedContribution:recordedRevenue-recordedCogs-recordedExpense,knownGross:knownRevenue-cogs,missing,estimated,unverified,unconfirmed,isEstimate:!!(missing||estimated||unverified||estimatedExpenseCount||unverifiedExpenseCount||unconfirmed),products:[...products.values()].map(p=>({...p,profit:p.missing?null:p.revenue-p.cost,margin:p.missing||!p.revenue?null:(p.revenue-p.cost)/p.revenue})).sort((a,b)=>(b.profit??-Infinity)-(a.profit??-Infinity)),categories,purchases:purchases.reduce((n,p)=>n+p.qty*p.unitCost,0),salesCount:sales.length+dailySales.length,dailyCount:dailySales.length};
}
// The scenario changes costs of goods sold, never inventory purchase payments.
export function simulateStore(r,{rent=r.categories['房租']||0,otherExpenses=r.expense-(r.categories['房租']||0),costChange=0}={}){
 if(![rent,otherExpenses].every(n=>Number.isSafeInteger(n)&&n>=0)||!Number.isFinite(costChange)||costChange< -100||costChange>100)fail('费用须为非负金额，采购成本变化须在 −100% 到 +100% 之间。','Expenses must be nonnegative amounts; purchasing cost change must be between −100% and +100%.');
 if(r.net===null||r.cogs===null)return null;
 const cogs=Math.round(r.cogs*(1+costChange/100)),after=r.revenue-cogs-rent-otherExpenses,delta=after-r.net;
 if(![cogs,after,delta,rent+otherExpenses,r.revenue+cogs+rent+otherExpenses].every(Number.isSafeInteger))fail('试算金额超出精确计算范围，请缩小金额或日期范围。','Scenario amounts exceed exact calculation limits. Reduce the amounts or date range.');
 return {before:r.net,after,delta,cogs,rent,otherExpenses};
}
export function simulate(product,price,cost,change){if(product.missing||!product.qty||![price,cost,change].every(Number.isFinite)||price<0||cost<0||change< -100||change>100)return null;const qty=Math.max(0,Math.round(product.qty*(1+change/100))),before=product.revenue-product.cost,after=Math.round((price-cost)*qty);return {qty,before,after,delta:after-before,breakEven:price>cost?Math.ceil(Math.max(0,before)/(price-cost)):null};}
export function emptyData(name=''){return {version:2,name,products:[],sales:[],dailySales:[],expenses:[],purchases:[],confirmedDays:[]};}
export const RECORD_TYPES=['sales','dailySales','expenses','purchases'];
export function invalidateConfirmations(before,after,{restore=false}={}){
 if(restore)return {...after,confirmedDays:[]};
 const affected=new Set();const add=(type,r)=>{if(!r)return;if(type==='expenses')for(const d of dates(r.start,r.end))affected.add(d);else affected.add(r.date);};
 for(const type of RECORD_TYPES){const prev=new Map((before[type]||[]).map(r=>[r.id,r])),next=new Map((after[type]||[]).map(r=>[r.id,r]));for(const key of new Set([...prev.keys(),...next.keys()]))if(JSON.stringify(prev.get(key))!==JSON.stringify(next.get(key))){add(type,prev.get(key));add(type,next.get(key));}}
 const prior=new Map(before.products.map(p=>[p.id,p])),changed=new Set(after.products.filter(p=>prior.get(p.id)?.cost!==p.cost).map(p=>p.id));
 for(const s of [...before.sales,...after.sales])if(s.unitCost==null&&changed.has(s.productId))affected.add(s.date);
 return {...after,confirmedDays:after.confirmedDays.filter(d=>!affected.has(d))};
}
export function validateData(d){
 if(!d||d.version!==2||typeof d.name!=='string'||d.name.length>80)fail('备份版本或店名不正确。','Invalid backup version or shop name.');
 for(const k of ['products',...RECORD_TYPES,'confirmedDays'])if(!Array.isArray(d[k])||d[k].length>50000)fail('备份格式不正确或记录过多。','Invalid backup structure or too many records.');
 const moneyOK=v=>Number.isSafeInteger(v)&&v>=0&&v<=10000000000,names=new Set(),ids=new Set();
 const metadata=r=>{for(const k of ['nameEn','noteEn'])if(r[k]!=null&&(typeof r[k]!=='string'||r[k].length>500))fail('备份中的显示文字不正确。','Invalid display text in the backup.');};metadata(d);
 for(const p of d.products){metadata(p);if(typeof p.id!=='string'||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>80||names.has(p.name)||!moneyOK(p.price)||!(p.cost===null||moneyOK(p.cost)))fail('商品名称、编号或金额不正确。','Invalid product name, ID, or amount.');ids.add(p.id);names.add(p.name);}
 const rowIds=new Set(),externalIds=new Set(),quickDates=new Set(),saleDates=new Set(d.sales.map(r=>r.date));
 let exposure=0;for(const type of RECORD_TYPES)for(const r of d[type]){
  metadata(r);
  if(typeof r.id!=='string'||!r.id||rowIds.has(r.id)||!validDate(r.date)||r.note!=null&&(typeof r.note!=='string'||r.note.length>500))fail('记录编号、日期或备注不正确。','Invalid record ID, date, or note.');rowIds.add(r.id);
  if(r.sourceId!=null){if(typeof r.sourceId!=='string'||!r.sourceId||r.sourceId.length>120||externalIds.has(r.sourceId))fail('交易编号重复或不正确。','Duplicate or invalid transaction ID.');externalIds.add(r.sourceId);}
  if(type==='expenses'){if(!moneyOK(r.amount)||typeof r.category!=='string'||r.category.length>50||!validDate(r.start)||!validDate(r.end)||r.end<r.start||days(r.start,r.end)>3660||!['recorded','estimated','unverified'].includes(r.status))fail('开支金额或覆盖日期不正确。','Invalid expense amount or coverage dates.');}
  else if(type==='dailySales'){if(!moneyOK(r.amount)||!(r.cogs===null||moneyOK(r.cogs))||!['recorded','estimated','unverified'].includes(r.costStatus))fail('每日合计金额或成本状态不正确。','Invalid daily total or cost status.');if(quickDates.has(r.date)||saleDates.has(r.date))fail('同一天只能记一笔每日合计，且不能与商品销售混记。请先在明细中修改或删除原记录。','A day can have one daily total OR product sales, not both. Edit or delete the existing entry in Records first.');quickDates.add(r.date);}
  else{if(!ids.has(r.productId)||!Number.isInteger(r.qty)||r.qty<1||r.qty>100000)fail('商品或数量不正确。','Invalid product or quantity.');if(type==='sales'&&(!moneyOK(r.price)||!(r.unitCost===null||moneyOK(r.unitCost))||!['recorded','estimated','unverified'].includes(r.costStatus)))fail('销售金额或成本状态不正确。','Invalid sales amount or cost status.');if(type==='purchases'&&(!moneyOK(r.unitCost)||r.status!=null&&!['recorded','estimated','unverified'].includes(r.status)))fail('进货金额不正确。','Invalid inventory purchase amount.');}
  exposure+=type==='sales'?r.qty*(r.price+(r.unitCost??d.products.find(p=>p.id===r.productId).cost??0)):type==='purchases'?r.qty*r.unitCost:type==='dailySales'?r.amount+(r.cogs||0):r.amount;
  if(!Number.isSafeInteger(exposure))fail('总金额超出精确计算范围，请按期间拆分账本。','Total amounts exceed exact calculation limits. Split the book into shorter periods.');
 }
 if(d.confirmedDays.some(s=>!validDate(s)))fail('核对日期不正确。','Invalid checked date.');return d;
}
export function migrateData(raw){const d=structuredClone(raw);if(d?.version===1){d.version=2;d.dailySales=[];d.confirmedDays=[];d.migratedFrom='1.0';}return validateData(d);}
