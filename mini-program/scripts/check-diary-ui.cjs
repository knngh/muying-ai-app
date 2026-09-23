// Run with the local H5 server on 5198 and Playwright available via NODE_PATH.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const output=process.env.BEIHU_UI_OUTPUT_DIR || path.join(require('node:os').tmpdir(),'beihu-diary-ui');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:375,height:812}}),errors=[],modelRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.route('https://beihu.me/**',r=>{if(r.request().url().includes('/review'))modelRequests.push(r.request().url());return r.fulfill({contentType:'application/json',body:JSON.stringify({code:0,data:{}})})});
  const url='http://127.0.0.1:5198/#/pages/tool-detail/index?id=diary';
  await page.goto(url);await page.locator('.diary-journal').waitFor();
  assert.match(await page.locator('.diary-empty').innerText(),/还没有/);
  await page.locator('.diary-save').click();assert.match(await page.locator('.diary-message').innerText(),/内容/);
  const text=page.locator('[aria-label="日记正文"] textarea');
  await text.fill('较早的输入');await text.fill('最终日记\n原文的结尾');await page.locator('.diary-save').click();
  assert.match(await page.locator('.diary-record').innerText(),/最终日记/);assert.match(await page.locator('.diary-record').innerText(),/未选心情/);assert.match(await page.locator('.week-summary').innerText(),/1 天留下 1 篇/);
  await page.locator('.writing-toggle').click();await page.locator('.diary-mood-options uni-button').filter({hasText:'开心'}).click();await text.fill('同一天第二篇');await page.locator('.diary-save').click();
  assert.match(await page.locator('.week-summary').innerText(),/1 天留下 2 篇/);
  await page.reload();await page.locator('.diary-journal').waitFor();assert.equal(await page.locator('.diary-record').count(),2);
  await page.locator('.diary-record').filter({hasText:'最终日记'}).click();await page.locator('.history-details').waitFor();assert.match(await page.locator('.history-details').innerText(),/原文的结尾/);
  await page.locator('.history-details .panel-button').click();await page.locator('.uni-modal__btn_primary').click();await page.locator('.record-tab').first().click();
  assert.match(await page.locator('.week-summary').innerText(),/1 天留下 1 篇/);
  const dates=await page.evaluate(()=>{const date=new Date(),fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');const monday=new Date(date);monday.setDate(date.getDate()-(date.getDay()+6)%7);const previous=new Date(monday);previous.setDate(previous.getDate()-7);return {today:fmt(date),monday:fmt(monday),previous:fmt(previous)}});
  await page.locator('[aria-label="上一周"]').click();assert.equal(await page.locator('.diary-record').count(),0);await page.locator('.writing-toggle').click();
  await page.locator('.diary-date').evaluate((el,value)=>el.__vueParentComponent.emit('change',{detail:{value}}),dates.previous);
  await text.fill('补记上周的原文');await page.locator('.diary-save').click();assert.match(await page.locator('.week-range').innerText(),new RegExp(dates.previous));
  await page.locator('.back-to-week').click();assert.match(await page.locator('.diary-record').innerText(),/同一天第二篇/);
  await page.locator('.diary-week-review').click();await page.locator('.review-body').waitFor();
  assert.equal(await page.locator('.review-pick--selected').count(),1);assert.match(await page.locator('.review-pick--selected').innerText(),/同一天第二篇/);
  await page.locator('.review-action--local').first().click();await page.locator('.ai-result').waitFor();await page.locator('.review-save').click();
  await page.locator('[aria-label="上一周"]').click();await page.locator('.diary-week-review').click();assert.match(await page.locator('.review-pick--selected').innerText(),/补记上周/);
  assert.equal(await page.locator('.review-history-row').count(),1);
  await page.reload();await page.locator('.diary-journal').waitFor();await page.locator('.review-toggle').click();await page.locator('.review-history-open').click();assert.match(await page.locator('.review-list').first().innerText(),/同一天第二篇/);
  // Removing the source clears its saved derived review, while other weeks stay separate.
  await page.locator('.diary-record').click();await page.locator('.history-details .panel-button').click();await page.locator('.uni-modal__btn_primary').click();assert.equal(await page.locator('.review-history-row').count(),0);
  await page.locator('.record-tab').first().click();await page.locator('.writing-toggle').click();await text.fill('保存失败要保留的文字');
  await page.evaluate(()=>{window.originalSet=uni.setStorageSync;uni.setStorageSync=(k,v)=>{if(k.startsWith('beihu:tool-records:'))throw Error('合成存储失败');return window.originalSet(k,v)}});
  await page.locator('.diary-save').click();assert.equal(await text.inputValue(),'保存失败要保留的文字');assert.match(await page.locator('.diary-message').innerText(),/失败/);
  await page.evaluate(()=>{uni.setStorageSync=window.originalSet;uni.setStorageSync('user',{id:900003});uni.setStorageSync('token','synthetic-diary-test')});
  await page.locator('.diary-save').click();assert.match(await page.locator('.diary-message').innerText(),/账号已变化/);
  await page.evaluate(()=>{uni.removeStorageSync('token');uni.removeStorageSync('user')});
  const entry=(id,payload,createdAt)=>({id,toolId:'diary',recordType:'entry',payload,createdAt:createdAt||dates.today+'T12:00:00',updatedAt:dates.today+'T12:00:00',syncStatus:'local'});
  const rows=Array.from({length:25},(_,i)=>entry('this-'+i,{date:dates.monday,mood:i%2?'期待':null,content:'本周合成日记 '+i+'，'+('记录原文。'.repeat(25))+'最后一句。'},dates.today+'T'+String(i%12).padStart(2,'0')+':00:00'));
  rows.push(entry('old-week',{date:dates.previous,mood:'疲惫',content:'别的一周不要混入'}),entry('bad-date',{date:'2026-02-30',content:'缺日期旧日记'}));
  await page.evaluate(rows=>uni.setStorageSync('beihu:tool-records:v2:guest',rows),rows);await page.reload();await page.locator('.diary-journal').waitFor();
  assert.match(await page.locator('.week-summary').innerText(),/1 天留下 25 篇/);assert.equal(await page.locator('.diary-record').count(),10);
  for(const width of [320,375,430]){await page.setViewportSize({width,height:812});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.diary-week-card').screenshot({path:path.join(output,'diary-week-'+width+'.png')})}
  await page.locator('.diary-days uni-button').first().click();assert.equal(await page.locator('.diary-record').count(),10);await page.locator('.show-whole-week').click();
  await page.locator('.diary-more').click();assert.equal(await page.locator('.diary-record').count(),25);assert.match(await page.locator('.diary-preview').first().innerText(),/…$/);
  await page.locator('.diary-record').last().click();await page.locator('.history-details').waitFor();assert.match(await page.locator('.history-details').innerText(),/最后一句。/);await page.locator('.record-tab').first().click();
  await page.locator('.ungrouped-toggle').click();assert.equal(await page.locator('.ungrouped-record').count(),1);
  await page.locator('.diary-week-review').click();assert.equal(await page.locator('.review-pick--selected').count(),20);assert.match(await page.locator('.review-message').innerText(),/超过 20/);
  assert.doesNotMatch((await page.locator('.review-pick--selected').allTextContents()).join(''),/别的一周|缺日期/);
  // Changes after weekly selection clear the selection, never expanding it to other weeks.
  await page.locator('.diary-journal').evaluate(el=>{
    const rows=uni.getStorageSync('beihu:tool-records:v2:guest');
    rows.find(item=>item.id==='this-0').payload.date=rows.find(item=>item.id==='old-week').payload.date;
    uni.setStorageSync('beihu:tool-records:v2:guest',rows);
    let c=el.__vueParentComponent;while(c&&!Object.hasOwn(c.setupState,'reportScope'))c=c.parent;
    c.setupState.records=rows;
  });
  assert.equal(await page.locator('.review-pick--selected').count(),0);
  assert.match(await page.locator('.review-message').innerText(),/记录已变化/);
  await page.locator('.diary-week-review').click();
  assert.equal(await page.locator('.review-pick--selected').count(),20);
  assert.doesNotMatch((await page.locator('.review-pick--selected').allTextContents()).join(''),/本周合成日记 0，/);
  assert.equal(modelRequests.length,0);
  // Scoped refresh clears draft and review state on account change.
  await page.locator('.writing-toggle').click();await text.fill('账号 A 未保存文字');
  await page.locator('.diary-journal').evaluate(el=>{let c=el.__vueParentComponent;while(c&&!Object.hasOwn(c.setupState,'reportScope'))c=c.parent;if(!c)throw Error('page missing');c.setupState.reportScope='900006';c.setupState.records=[]});
  await page.waitForTimeout(200);assert.equal(await text.inputValue(),'');assert.equal(await page.locator('.review-body').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS diary: rapid writing, optional mood, same-day entries, source deletion, weekly navigation/backfill, scoped review/save/reopen/cleanup, 20-limit, pagination, failures and owner reset; 320/375/430; no model requests or console errors');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
