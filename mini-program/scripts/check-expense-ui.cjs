// Run against the local H5 server with Playwright available via NODE_PATH.
const {chromium}=require('playwright');
const path=require('node:path');
const fs=require('node:fs');
const output=process.env.BEIHU_UI_OUTPUT_DIR || path.join(require('node:os').tmpdir(),'beihu-expense-ui');
fs.mkdirSync(output,{recursive:true});
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await b.newPage({viewport:{width:375,height:812}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error') errors.push(m.text())});
  await page.route('https://beihu.me/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({code:0,data:{}})}));
  const url='http://127.0.0.1:5198/#/pages/tool-detail/index?id=expenses';
  await page.goto(url);await page.locator('.expense-ledger').waitFor();
  assert.match(await page.locator('.expense-empty').innerText(),/还没有/);
  await page.locator('.expense-submit').click();assert.match(await page.locator('.expense-message').innerText(),/两位小数/);
  const dates=await page.evaluate(()=>{const d=new Date(),p=new Date(d.getFullYear(),d.getMonth()-1,1);const f=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');return {day:f(d),month:f(d).slice(0,7),previous:f(p)}});
  const amount=page.locator('[aria-label="账目金额"] input');
  await amount.fill('1.005');await page.locator('.expense-submit').click();assert.equal(await amount.inputValue(),'1.005');
  await amount.fill('0.10');await page.locator('.category-choices uni-button').filter({hasText:'奶粉/喂养'}).click();
  await page.locator('[aria-label="账目备注"] input').fill('合成账单 A');await page.locator('.expense-submit').click();
  assert.equal(await page.locator('.expense-net').innerText(),'0.10');assert.equal(await page.locator('.expense-submit').count(),0);
  await page.locator('.entry-toggle').click();await amount.fill('0.20');await page.locator('.expense-submit').click();assert.equal(await page.locator('.expense-net').innerText(),'0.30');
  await page.locator('.entry-toggle').click();await page.locator('.direction-choices uni-button').filter({hasText:'退款'}).click();await amount.fill('1.01');await page.locator('.expense-submit').click();assert.equal(await page.locator('.expense-net').innerText(),'-0.71');
  await page.locator('.entry-toggle').click();await page.locator('.direction-choices uni-button').filter({hasText:'转账'}).click();await amount.fill('100');await page.locator('.expense-submit').click();assert.equal(await page.locator('.expense-net').innerText(),'-0.71');
  await page.reload();await page.locator('.expense-ledger').waitFor();assert.equal(await page.locator('.expense-net').innerText(),'-0.71');assert.equal(await page.locator('.expense-record').count(),4);
  await page.locator('.distribution-toggle').click();assert.match(await page.locator('.expense-distribution').innerText(),/100%/);
  // Uni native picker change events are simulated here; native picker behavior is a WeChat acceptance item.
  await page.locator('.expense-filters uni-picker').first().evaluate(el=>el.__vueParentComponent.emit('change',{detail:{value:2}}));
  assert.equal(await page.locator('.expense-record').count(),1);assert.match(await page.locator('.expense-record').innerText(),/退款/);
  await page.locator('.expense-record').click();await page.locator('.history-details').waitFor();assert.match(await page.locator('.history-details').innerText(),/类型\n退款/);
  await page.locator('.history-details .panel-button').click();await page.locator('.uni-modal__btn_primary').click();
  await page.locator('.record-tab').first().click();assert.equal(await page.locator('.expense-net').innerText(),'0.30');assert.match(await page.locator('.expense-empty').innerText(),/筛选/);
  await page.locator('[aria-label="上个月"]').click();assert.equal(await page.locator('.expense-net').innerText(),'0.00');
  await page.locator('.entry-toggle').click();await page.locator('.direction-choices uni-button').filter({hasText:'支出'}).click();
  await page.locator('.expense-date').evaluate((el,value)=>el.__vueParentComponent.emit('change',{detail:{value}}),dates.previous);
  await amount.fill('20.09');await page.locator('.expense-submit').click();assert.equal(await page.locator('.expense-net').innerText(),'20.09');
  await page.locator('.back-to-month').click();assert.equal(await page.locator('.expense-net').innerText(),'0.30');
  // Failed writes retain input; changed owner prevents an old draft being saved.
  await page.locator('.entry-toggle').click();await amount.fill('23.45');await page.locator('[aria-label="账目备注"] input').fill('不能丢失的草稿');
  await page.evaluate(()=>{window.originalSet=uni.setStorageSync;uni.setStorageSync=(k,v)=>{if(k.startsWith('beihu:tool-records:'))throw Error('合成存储失败');return window.originalSet(k,v)}});
  await page.locator('.expense-submit').click();assert.match(await page.locator('.expense-message').innerText(),/失败/);assert.equal(await amount.inputValue(),'23.45');
  await page.evaluate(()=>{uni.setStorageSync=window.originalSet;uni.setStorageSync('user',{id:900002});uni.setStorageSync('token','synthetic-expense-test')});
  await page.locator('.expense-submit').click();assert.match(await page.locator('.expense-message').innerText(),/账号已变化/);
  await page.evaluate(()=>{uni.removeStorageSync('token');uni.removeStorageSync('user')});
  const entry=(id,payload,createdAt)=>({id,toolId:'expenses',recordType:'entry',payload,createdAt:createdAt||dates.day+'T12:00:00',updatedAt:dates.day+'T12:00:00',syncStatus:'local'});
  const rows=[entry('feed',{date:dates.day,amount:268.99,category:'feeding',direction:'expense',note:'奶粉一罐'}),entry('checkup',{date:dates.day,amount:580,category:'checkup'}),entry('refund',{date:dates.day,amount:68.99,category:'feeding',direction:'refund'}),entry('transfer',{date:dates.day,amount:1000,category:'other',direction:'transfer'}),entry('old',{date:dates.day,amount:12.3,category:'早期自定义分类'}),entry('invalid',{date:'2026-02-30',amount:20,category:'feeding'})];
  rows.push({...entry('cloud-old',{date:dates.day,amount:99,category:'feeding'}),syncStatus:'synced'});
  await page.evaluate(rows=>uni.setStorageSync('beihu:tool-records:v2:guest',rows),rows);await page.reload();await page.locator('.expense-ledger').waitFor();
  assert.equal(await page.locator('.expense-net').innerText(),'792.30');await page.locator('.distribution-toggle').click();
  for(const width of [320,375,430]){
    await page.setViewportSize({width,height:812});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const layout=await page.locator('.expense-overview').evaluate(el=>{const parent=el.getBoundingClientRect();return [...el.querySelectorAll('*')].filter(x=>x.getBoundingClientRect().right>parent.right+1).map(x=>x.className)});
    assert.deepEqual(layout,[]);
    await page.locator('.expense-ledger').screenshot({path:path.join(output,'expense-'+width+'.png')});
  }
  await page.locator('.excluded-toggle').click();assert.equal(await page.locator('.excluded-record').count(),2);
  await page.locator('.excluded-record').filter({hasText:'类型待核对'}).click();await page.locator('.history-details').waitFor();assert.match(await page.locator('.history-details').innerText(),/类型待核对/);
  await page.locator('.record-tab').first().click();
  await page.locator('.expense-filters uni-picker').nth(1).evaluate(el=>el.__vueParentComponent.emit('change',{detail:{value:5}}));
  assert.equal(await page.locator('.expense-record').count(),2);
  // More than one page of records remains reachable, including the historical source details.
  const many=Array.from({length:30},(_,i)=>entry('many-'+i,{date:dates.day,amount:i+1,category:'feeding',direction:'expense',note:'第'+i+'条合成记录'},dates.day+'T'+String(i%12).padStart(2,'0')+':00:00'));
  await page.evaluate(rows=>uni.setStorageSync('beihu:tool-records:v2:guest',rows),many);await page.reload();await page.locator('.expense-ledger').waitFor();
  assert.equal(await page.locator('.expense-record').count(),10);await page.locator('.expense-more').click();assert.equal(await page.locator('.expense-record').count(),30);
  await page.locator('.expense-record').last().click();await page.locator('.history-details').waitFor();assert.equal(await page.locator('.history-item').count(),30);
  await page.locator('.record-tab').first().click();await page.locator('.entry-toggle').click();
  await page.locator('[aria-label="账目备注"] input').fill('合成账号 A 草稿');
  await page.locator('.expense-filters uni-picker').first().evaluate(el=>el.__vueParentComponent.emit('change',{detail:{value:2}}));
  await page.locator('.expense-ledger').evaluate(el=>{
    let component=el.__vueParentComponent;
    while(component && !Object.hasOwn(component.setupState,'reportScope')) component=component.parent;
    if(!component) throw Error('Tool page instance missing');
    component.setupState.reportScope='900005';component.setupState.records=[];
  });
  await page.waitForTimeout(250);
  assert.equal(await page.locator('[aria-label="账目备注"] input').inputValue(),'');
  assert.match(await page.locator('.expense-filters').innerText(),/全部类型/);
  assert.equal(await page.locator('.expense-net').innerText(),'0.00');
  assert.deepEqual(errors,[]);console.log('PASS expenses: precision, expense/refund/transfer, persistence, month/filter/detail/delete, failed writes, owner guard, legacy records, pagination, 320/375/430, zero page errors');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
