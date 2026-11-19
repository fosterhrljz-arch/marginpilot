import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {emptyData,dates} from '../src/core.mjs';
import {csvText,headers} from '../src/import.mjs';
import {makeXlsx} from '../scripts/samples.mjs';

const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
const url=pathToFileURL(resolve('release/MarginPilot.html')).href;
async function flow(language){
 let lang=language;
 const context=await browser.newContext({viewport:{width:1536,height:1024},offline:true,acceptDownloads:true}),page=await context.newPage(),errors=[],network=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
 page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 const z=(zh,en)=>lang==='en'?en:zh;
 const button=(zh,en)=>page.getByRole('button',{name:z(zh,en),exact:true});
 const nav=(zh,en)=>page.getByRole('navigation').getByRole('button',{name:z(zh,en),exact:true});
 const field=(zh,en)=>page.getByLabel(z(zh,en),{exact:true});
 const book=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('marginpilot-v11-live')));
 async function switchLanguage(value){await page.getByRole('combobox',{name:'Language / 语言'}).last().selectOption(value);lang=value;await page.waitForFunction(l=>document.documentElement.lang===(l==='en'?'en':'zh-CN'),value);}
 async function range(a,b){await button('自选','Custom').click();await field('开始日期','Start date').fill(a);await field('结束日期','End date').fill(b);await button('查看这段时间','Apply dates').click();}
 async function check(){await button('核对日期与口径','Check dates & assumptions').click();await page.getByRole('checkbox').check();await button('标记已核对','Mark dates checked').click();}
 async function restore(data){await nav('数据与备份','Data & backups').click();await field('恢复备份','Restore backup').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await button('确认替换当前账本','Replace current book').click();}
 async function upload(rows,excel=false){await field('导入表格','Import spreadsheet').setInputFiles({name:excel?'patch.xlsx':'patch.csv',mimeType:excel?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv',buffer:excel?await makeXlsx(rows,{shared:true}):Buffer.from(csvText(rows))});await page.locator('.import-preview').waitFor();}
 async function clean(){if(lang==='en'){const body=(await page.locator('body').innerText()).replaceAll('简体中文','');assert.equal(/[\u4e00-\u9fff]/.test(body),false,'Untranslated interface: '+body);}}
 async function shot(name){if(await button('关闭提示','Dismiss message').count())await button('关闭提示','Dismiss message').click();await clean();await page.screenshot({path:'docs/'+name+'-'+lang+'.png',fullPage:true});}
 const net=()=>page.locator('.metric').last().innerText();
 try{
  await page.goto(url);await switchLanguage(lang);assert.equal(page.url(),url);assert.match(await page.title(),/v1\.1\.1/);
  await button('打开真实账本','Open my real business').click();
  await nav('记一笔','Add entry').click();await field('日期','Date').fill('2026-11-03');await page.locator('input[name=amount]').fill('100');
  assert.equal(await page.locator('input[name=cogs]').count(),0);await shot('quick-later');
  await switchLanguage(lang==='en'?'zh':'en');assert.equal(await page.locator('input[name=amount]').inputValue(),'100');await switchLanguage(language);
  await button('保存记录','Save entry').click();let d=await book();assert.equal(d.dailySales.length,1);assert.equal(d.dailySales[0].cogs,null);assert.equal(d.dailySales[0].costStatus,'unverified');
  await nav('生意总览','Overview').click();await range('2026-11-03','2026-11-03');assert.match(await net(),lang==='en'?/Incomplete/:/待补全/);await check();assert.match(await net(),lang==='en'?/Incomplete/:/待补全/);await shot('incomplete-profit');
  await nav('收支明细','Records').click();await button('补成本','Add cost').click();await page.locator('input[name=cogs]').fill('60');assert.equal(await field('成本是否核实','Cost status').inputValue(),'unverified');await shot('add-cost');await button('保存记录','Save entry').click();
  d=await book();assert.equal(d.dailySales.length,1);assert.equal(d.dailySales[0].amount,10000);assert.equal(d.dailySales[0].cogs,6000);assert.ok(!d.confirmedDays.includes('2026-11-03'));
  await nav('生意总览','Overview').click();await check();assert.match(await net(),/40.00/);assert.match(await net(),lang==='en'?/Estimated net profit/:/预计净利润/);
  await nav('收支明细','Records').click();await button('每日销售合计','Daily sales total').click();await page.getByRole('button',{name:new RegExp(z('修改记录','Edit entry'))}).click();await field('成本是否核实','Cost status').selectOption('recorded');await button('保存记录','Save entry').click();
  await nav('生意总览','Overview').click();await check();assert.match(await net(),lang==='en'?/Recorded net profit/:/已记录净利润/);

  const fixture=emptyData('Family shop');fixture.dailySales=[{id:'q',date:'2026-11-01',amount:1000000,cogs:600000,costStatus:'recorded'}];fixture.expenses=[{id:'rent',date:'2026-11-01',start:'2026-11-01',end:'2026-11-30',amount:100000,category:'房租',status:'recorded'},{id:'wages',date:'2026-11-01',start:'2026-11-01',end:'2026-11-30',amount:50000,category:'人工',status:'recorded'}];fixture.products=[{id:'stock',name:'Unsold stock',price:1000,cost:500}];fixture.purchases=[{id:'buy',date:'2026-11-01',productId:'stock',qty:10000,unitCost:500}];fixture.confirmedDays=dates('2026-11-01','2026-11-30');
  await restore(fixture);await nav('生意总览','Overview').click();await range('2026-11-01','2026-11-30');await check();
  await nav('经营试算','What-if planner').click();const before=await book();
  assert.match(await page.locator('.sim-result>strong').innerText(),/0.00/);
  await field('新每月房租（元）','New monthly rent (CNY)').fill('800');await field('采购成本变化（%）','Purchasing cost change (%)').fill('-10');await field('新每月其他开支合计（元）','New monthly other expenses (CNY)').fill('400');
  assert.match(await page.locator('.sim-result>strong').innerText(),/900.00/);assert.match(await page.locator('.sim-lines').innerText(),/3,400.00/);await shot('store-simulator');
  await switchLanguage(lang==='en'?'zh':'en');assert.equal(await field('新每月房租（元）','New monthly rent (CNY)').inputValue(),'800');assert.match(await page.locator('.sim-result>strong').innerText(),/900.00/);await switchLanguage(language);assert.deepEqual(await book(),before);
  await field('采购成本变化（%）','Purchasing cost change (%)').fill('101');assert.ok(await page.getByRole('alert').isVisible());await clean();assert.match(await page.locator('.sim-result>strong').innerText(),lang==='en'?/Incomplete/:/待补全/);
  await field('采购成本变化（%）','Purchasing cost change (%)').fill('0');await field('新每月房租（元）','New monthly rent (CNY)').fill('-1');assert.ok(await page.getByRole('alert').isVisible());
  await button('恢复原来的数字','Reset scenario').click();assert.match(await page.locator('.sim-result>strong').innerText(),/0.00/);await field('试算月份','Scenario month').fill('');assert.ok(await page.getByRole('alert').isVisible());await field('试算月份','Scenario month').fill('2026-11');
  await page.setViewportSize({width:390,height:844});await field('新每月房租（元）','New monthly rent (CNY)').fill('800');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await shot('store-mobile');await page.setViewportSize({width:1536,height:1024});
  await button('单个商品试算','Product scenario').click();assert.ok(await page.getByText(z('先记录有成本的商品销售，再来试算。','Record product sales with costs before trying a scenario.'),{exact:true}).isVisible());await clean();
  fixture.dailySales[0].cogs=null;await restore(fixture);await nav('经营试算','What-if planner').click();assert.match(await page.locator('.sim-result>strong').innerText(),lang==='en'?/Incomplete/:/待补全/);await clean();

  await restore(emptyData('Import shop'));
  const types=lang==='en'?['Sale','Purchase','Expense','Daily total']:['销售','进货','开支','每日合计'];
  const rows=[headers(lang),[types[0],'2026-11-01','Keep milk','2','5','3','','','','','  ','','keep-sale',''],[types[0],'2026-11-01','Excluded sale','1','10','5','','','','','','','excluded-sale',''],[types[1],'2026-11-01','Excluded stock','100','','2','','','','','','','excluded-stock',''],[types[2],'2026-11-01','','','','','2',lang==='en'?'Other':'其他','','','','','keep-expense',''],[types[3],'2026-11-02','','','','','100','','','','','','keep-daily','60']];
  await upload(rows);await field('导入第 3 行','Include row 3').uncheck();await field('导入第 4 行','Include row 4').uncheck();assert.match(await page.locator('.import-preview').innerText(),lang==='en'?/Unverified/:/未核实/);await shot('import-verification');await button('确认导入 3 笔','Import 3 entries').click();
  d=await book();assert.deepEqual(d.products.map(p=>p.name),['Keep milk']);assert.equal(d.sales[0].costStatus,'unverified');assert.equal(d.expenses[0].status,'unverified');assert.equal(d.dailySales[0].costStatus,'unverified');
  await nav('生意总览','Overview').click();await range('2026-11-01','2026-11-02');await check();assert.match(await net(),/42.00/);assert.match(await net(),lang==='en'?/Estimated net profit/:/预计净利润/);await button('核对日期与口径','Check dates & assumptions').click();assert.match(await page.locator('.calculation').innerText(),/0.00/);await button('关闭','Close').click();await shot('unverified-profit');
  await nav('数据与备份','Data & backups').click();const excelRows=[headers(lang),[types[0],'2026-11-03','Shared item','1','10','4','','','','','','','shared-1',''],[types[0],'2026-11-03','Shared item','2','10','4','','','','','','','shared-2',''],[types[1],'2026-11-03','Only excluded','50','','3','','','','','','','only-excluded','']];
  await upload(excelRows,true);await field('导入第 2 行','Include row 2').uncheck();await field('导入第 4 行','Include row 4').uncheck();await button('确认导入 1 笔','Import 1 entries').click();assert.deepEqual((await book()).products.map(p=>p.name),['Keep milk','Shared item']);assert.equal((await book()).sales[1].costStatus,'unverified');
  const saved=await book();await upload([headers(lang),[types[1],'2026-11-04','Cancel product','100','','3','','','','','','','cancel','']],true);await field('导入第 2 行','Include row 2').uncheck();assert.ok(await button('确认导入 0 笔','Import 0 entries').isDisabled());await button('取消','Cancel').click();assert.deepEqual(await book(),saved);
  const download=page.waitForEvent('download');await button('下载备份','Download backup').click();const backup=JSON.parse(await readFile(await (await download).path(),'utf8'));await restore(backup);const restored=await book();assert.deepEqual(restored,{...saved,confirmedDays:[]});await page.reload();assert.deepEqual(await book(),restored);assert.equal(await page.locator('html').getAttribute('lang'),lang==='en'?'en':'zh-CN');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);console.log(lang+': v1.1.1 revenue-first, cost completion, verification, filtered CSV/XLSX, monthly simulation, language, backup, mobile, and offline workflows passed');
 }catch(error){console.log('Failure',lang,(await page.locator('body').innerText()).slice(-5000));throw error;}finally{await context.close();}
}
try{await flow('zh');await flow('en');}finally{await browser.close();}
