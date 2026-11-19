import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyData,report,simulateStore,dates,validateData,migrateData,invalidateConfirmations} from '../src/core.mjs';
import {prepareImport,applyImport,exportRows,headers} from '../src/import.mjs';
import {setLanguage,statusLabel,errorText} from '../src/i18n.mjs';
const sale={Type:'Sale',Date:'2026-11-01',Product:'Milk',Quantity:'2','Unit price':'5','Unit cost':'3'};
const expense={Type:'Expense',Date:'2026-11-01',Amount:'2',Category:'Other'};
const quick={Type:'Daily total',Date:'2026-11-02',Amount:'100','Total sold cost':'60'};
const purchase={Type:'Purchase',Date:'2026-11-01',Product:'Stock',Quantity:'100','Unit cost':'3'};
const imported=rows=>{const p=prepareImport(rows,emptyData());assert.equal(p.errors.length,0);return applyImport(emptyData(),p);};
const monthly=()=>{const d=emptyData();d.dailySales=[{id:'q',date:'2026-11-01',amount:1000000,cogs:600000,costStatus:'recorded'}];d.expenses=[{id:'r',date:'2026-11-01',start:'2026-11-01',end:'2026-11-30',amount:100000,category:'房租',status:'recorded'},{id:'e',date:'2026-11-01',start:'2026-11-01',end:'2026-11-30',amount:50000,category:'人工',status:'recorded'}];d.confirmedDays=dates('2026-11-01','2026-11-30');return d;};
const monthReport=d=>report(d,'2026-11-01','2026-11-30');

test('omitted, empty, and whitespace import statuses default to Unverified for every record type',()=>{
 for(const Status of [undefined,'','  ']){const rows=[sale,expense,quick,purchase].map(r=>({...r,...(Status===undefined?{}:{Status})})),d=imported(rows);for(const type of ['sales','expenses','dailySales','purchases'])assert.equal(d[type][0].status||d[type][0].costStatus,'unverified');}
});
test('explicit bilingual status values are preserved, while unknown values fail',()=>{
 for(const [Status,expected] of [['Verified','recorded'],['已核实','recorded'],['Estimated','estimated'],['估算','estimated'],['Unverified','unverified'],['未核实','unverified']])assert.equal(imported([{...sale,Status}]).sales[0].costStatus,expected);
 assert.equal(prepareImport([{...sale,Status:'Yes'}],emptyData()).errors.length,1);
});
test('unverified amounts never count as the verified portion, even after all dates are checked',()=>{
 const d=imported([sale,expense,quick]);d.confirmedDays=dates('2026-11-01','2026-11-02');const r=report(d,'2026-11-01','2026-11-02');assert.equal(r.net,4200);assert.equal(r.recordedContribution,0);assert.equal(r.isEstimate,true);assert.equal(r.unverified,2);assert.equal(r.unverifiedExpenseCount,1);assert.equal(r.products[0].unverified,1);
 d.sales[0].costStatus='recorded';d.expenses[0].status='recorded';assert.equal(report(d,'2026-11-01','2026-11-02').recordedContribution,200);
});
test('zero-cost sales and zero-amount expenses still require verification, not just nonzero amounts',()=>{
 for(const state of ['unverified','estimated']){const d=monthly();d.expenses=[{...d.expenses[0],amount:0,status:state}];assert.equal(monthReport(d).isEstimate,true);d.expenses=[];d.dailySales[0].cogs=0;d.dailySales[0].costStatus=state;assert.equal(monthReport(d).isEstimate,true);assert.equal(monthReport(d).recordedContribution,0);}
});
test('missing cost and reference-cost estimates remain distinct from verified costs',()=>{
 const d=imported([{...sale,'Unit cost':''},{...quick,'Total sold cost':''}]);d.products[0].cost=300;const r=report(d,'2026-11-01','2026-11-02');assert.equal(r.estimated,1);assert.equal(r.missing,1);assert.equal(r.net,null);assert.equal(r.recordedContribution,0);
});
test('bilingual CSV export round trips all three statuses and purchase identity',()=>{
 for(const lang of ['zh','en']){const d=imported([sale,expense,quick,purchase,{...sale,Product:'Verified milk',Status:'Verified'},{...expense,Status:'Estimated'}]);const rows=exportRows(d,lang),p=prepareImport(rows.slice(1).map(row=>Object.fromEntries(headers(lang).map((h,i)=>[h,row[i]]))),d);assert.equal(p.errors.length,0);assert.equal(p.entries.length,0);assert.equal(p.duplicates,6);}
});
test('legacy v1.1 data preserves original statuses and purchases without a status remain compatible',()=>{
 const d=monthly();d.products=[{id:'p',name:'Legacy product',price:100,cost:0}];d.purchases=[{id:'p1',date:'2026-11-01',productId:'p',qty:1,unitCost:0}];assert.deepEqual(migrateData(d),d);const rows=exportRows(d,'en');const p=prepareImport(rows.slice(1).map(row=>Object.fromEntries(headers('en').map((h,i)=>[h,row[i]]))),d);assert.equal(p.errors.length,0);assert.equal(p.entries.length,0);
});
test('new backup restores preserve Unverified and Unicode without mutating the original',()=>{
 const d=imported([{...quick,Note:'林家 / Family'}]),snapshot=JSON.stringify(d);assert.deepEqual(migrateData(JSON.parse(snapshot)),d);assert.equal(JSON.stringify(d),snapshot);d.dailySales[0].costStatus='bad';assert.throws(()=>validateData(d));
});
test('excluding rows adds only referenced new products, retaining existing unused products',()=>{
 const d=emptyData();d.products=[{id:'old',name:'Existing',price:0,cost:null}];const p=prepareImport([sale,{...sale,Product:'Excluded'},{...purchase,Product:'Excluded stock'}],d),snapshot=JSON.stringify(d);const result=applyImport(d,p,new Set(p.entries.slice(1).map(e=>e.record.id)));assert.deepEqual(result.products.map(p=>p.name),['Existing','Milk']);assert.equal(result.sales.length,1);assert.equal(result.purchases.length,0);assert.equal(JSON.stringify(d),snapshot);
});
test('shared products survive when one included row uses them; deselecting everything adds nothing',()=>{
 const d=emptyData(),p=prepareImport([sale,{...sale,Date:'2026-11-02','Unit price':'8'}],d);const partial=applyImport(d,p,new Set([p.entries[0].record.id]));assert.equal(partial.products.length,1);assert.equal(partial.products[0].price,800);assert.deepEqual(applyImport(d,p,new Set(p.entries.map(e=>e.record.id))),d);
});
test('invalid preview rows do not leak products when only valid entries are applied',()=>{
 const d=emptyData(),p=prepareImport([{...sale,Product:'Broken',Price:'',Note:'x'.repeat(501)},sale],d);assert.equal(p.errors.length,1);assert.deepEqual(applyImport(d,p).products.map(p=>p.name),['Milk']);
});
test('store scenario leaves a complete month unchanged and does not mutate its book',()=>{
 const d=monthly(),before=JSON.stringify(d),r=monthReport(d),s=simulateStore(r);assert.equal(s.before,250000);assert.equal(s.after,250000);assert.equal(s.delta,0);assert.equal(JSON.stringify(d),before);
});
test('store scenario replaces rent and other expenses, and adjusts only sold-goods cost',()=>{
 const d=monthly();d.products=[{id:'p',name:'Stock',price:100,cost:50}];d.purchases=[{id:'b',productId:'p',date:'2026-11-01',qty:10000,unitCost:500}];const r=monthReport(d),s=simulateStore(r,{rent:80000,otherExpenses:40000,costChange:-10});assert.equal(s.cogs,540000);assert.equal(s.after,340000);assert.equal(s.delta,90000);assert.equal(s.before,250000);
});
test('store scenarios support no rent, zero replacement costs, losses, and ±100% boundaries',()=>{
 const d=monthly();d.expenses=[];const r=monthReport(d);assert.equal(simulateStore(r).delta,0);assert.equal(simulateStore(r,{rent:0,otherExpenses:0,costChange:-100}).after,1000000);assert.equal(simulateStore(r,{rent:0,otherExpenses:0,costChange:100}).after,-200000);assert.equal(simulateStore(monthReport(monthly()),{rent:0,otherExpenses:0}).delta,150000);
});
test('store scenarios with missing costs withhold total profit, but allow known unverified costs as estimates',()=>{
 const d=monthly();d.dailySales[0].cogs=null;assert.equal(simulateStore(monthReport(d)),null);d.dailySales[0].cogs=600000;d.dailySales[0].costStatus='unverified';assert.equal(monthReport(d).isEstimate,true);assert.equal(simulateStore(monthReport(d)).after,250000);
});
test('monthly baseline allocates spanning and leap-month bills without extrapolating missing sales',()=>{
 const d=monthly();d.dailySales[0].date='2024-02-15';d.expenses=[{...d.expenses[0],date:'2024-02-01',start:'2024-02-01',end:'2024-03-01',amount:30001}];d.confirmedDays=[];const r=report(d,'2024-02-01','2024-02-29');assert.equal(r.expense,29001);assert.equal(r.revenue,1000000);assert.equal(r.unconfirmed,29);assert.equal(simulateStore(r).after,370999);
});
test('scenario fractional percentage rounds to cents and rejects invalid or unsafe inputs',()=>{
 const r=monthReport(monthly());r.cogs=333;r.net=r.revenue-r.cogs-r.expense;assert.equal(simulateStore(r,{costChange:-3.33}).cogs,322);
 for(const bad of [{costChange:-101},{costChange:101},{costChange:NaN},{rent:-1},{otherExpenses:Infinity},{rent:0.5},{rent:Number.MAX_SAFE_INTEGER}])assert.throws(()=>simulateStore(r,bad));
});
test('adding missing quick cost preserves revenue and clears only the relevant date confirmation',()=>{
 const d=imported([{...quick,'Total sold cost':''}]);d.confirmedDays=dates('2026-11-01','2026-11-03');const next=structuredClone(d);next.dailySales[0].cogs=6000;const saved=invalidateConfirmations(d,next);assert.equal(saved.dailySales.length,1);assert.equal(saved.dailySales[0].amount,10000);assert.deepEqual(saved.confirmedDays,['2026-11-01','2026-11-03']);assert.equal(report(saved,'2026-11-02','2026-11-02').net,4000);assert.equal(report(saved,'2026-11-02','2026-11-02').isEstimate,true);
});
test('new status and scenario validation messages are bilingual',()=>{
 for(const lang of ['zh','en']){setLanguage(lang);assert.equal(statusLabel('unverified'),lang==='en'?'Unverified':'未核实');try{simulateStore(monthReport(monthly()),{costChange:101});assert.fail('Expected validation');}catch(e){assert.match(errorText(e),lang==='en'?/between/:/之间/);}}setLanguage('zh');
});
