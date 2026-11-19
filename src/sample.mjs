import {emptyData,dates} from './core.mjs';
export const DEMO_TODAY='2026-11-14';
export function sampleData(){const d=emptyData('邻里生活小铺');d.products=[['p1','手作饭团',850,390,'早餐鲜食'],['p2','鲜奶',680,450,'乳品饮料'],['p3','瓶装饮料',500,290,'乳品饮料'],['p4','鸡蛋（盒）',1500,1160,'日常食品'],['p5','时令水果（份）',1200,860,'生鲜水果'],['p6','临期面包',400,460,'早餐鲜食'],['p7','新品小饼干',800,null,'日常食品']].map(([id,name,price,cost,category])=>({id,name,price,cost,category}));let n=1;
 for(const date of dates('2026-08-01',DEMO_TODAY)){const day=Number(date.slice(-2)),month=Number(date.slice(5,7)),weekend=[0,6].includes(new Date(date+'T12:00:00Z').getUTCDay());for(let i=0;i<6;i++){const p=d.products[i];const qty=Math.max(2,Math.round(([46,32,39,17,22,7][i]+((day*7+i*3)%13)-6)*(weekend?1.22:1)*(1+(month-8)*.035)));d.sales.push({id:'s'+n++,date,productId:p.id,qty,price:p.price,unitCost:date===DEMO_TODAY&&i===4?null:p.cost,costStatus:'recorded',note:''});}d.confirmedDays.push(date);}
 d.sales.push({id:'s'+n++,date:'2026-11-13',productId:'p7',qty:9,price:800,unitCost:470,costStatus:'estimated',note:'供应商报价，等待账单'});
 for(let m=8;m<=11;m++){const month=`2026-${String(m).padStart(2,'0')}`,last=new Date(Date.UTC(2026,m,0)).getUTCDate();for(const [category,amount,status] of [['房租',360000,'recorded'],['人工',480000,'recorded'],['水电',76000,m===11?'estimated':'recorded'],['其他',32000,'recorded']])d.expenses.push({id:'e'+n++,date:month+'-01',start:month+'-01',end:month+'-'+last,category,amount,status,note:category==='水电'&&m===11?'按上月账单估计，月底替换为实数':'当月费用，按天分摊'});for(const day of ['02','09']){d.purchases.push({id:'b'+n++,date:month+'-'+day,productId:'p3',qty:500,unitCost:290,note:'补货入库，未全部卖出'});}}
 d.nameEn='Neighborhood Corner Shop';
 const names=['Handmade rice balls','Fresh milk','Bottled drinks','Eggs (box)','Seasonal fruit (portion)','Clearance bread','New cookies'];d.products.forEach((p,i)=>p.nameEn=names[i]);
 for(const r of d.sales)if(r.note)r.noteEn='Supplier quote; awaiting invoice';
 for(const r of d.expenses)r.noteEn=r.status==='estimated'?'Based on last month; replace with actual bill':'Monthly expense allocated by day';
 for(const r of d.purchases)r.noteEn='Stock replenishment; not all sold';
 return d;}
