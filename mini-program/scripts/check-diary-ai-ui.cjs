// Run with VITE_TOOL_AI_ENABLED=true on the local H5 server at 5199. All remote requests are mocked.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:375,height:812}}),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));
 let mode='normal',release;
 const result={source:'ai',title:'合成周记整理',summary:'只整理用户选择的日记。',highlights:['合成原文摘要'],nextSteps:[],focus:'本周记录',disclaimer:'AI 生成内容',provider:'zhipu',model:'glm-5.3'};
 await p.route('https://beihu.me/**',async route=>{
  if(route.request().url().includes('ai-review')){
   requests.push(route.request().postDataJSON());
   if(mode==='delayed')await new Promise(r=>{release=r});
   return route.fulfill({contentType:'application/json',body:JSON.stringify({code:0,data:result})});
  }
  return route.fulfill({contentType:'application/json',body:JSON.stringify({code:0,data:{}})});
 });
 await p.goto('http://127.0.0.1:5199/#/pages/tool-detail/index?id=diary');await p.locator('.diary-journal').waitFor();
 await p.locator('.diary-journal').evaluate(el=>{
  const d=new Date(),date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const record={id:'one',toolId:'diary',recordType:'entry',createdAt:date+'T08:00:00',updatedAt:date+'T08:00:00',syncStatus:'local',payload:{date,content:'本周合成原文',mood:null}};
  uni.setStorageSync('token','synthetic-ai-ui-only');uni.setStorageSync('user',{id:900007});uni.setStorageSync('beihu:tool-records:v2:900007',[record]);
  let c=el.__vueParentComponent;while(c&&!Object.hasOwn(c.setupState,'reportScope'))c=c.parent;c.setupState.reportScope='900007';c.setupState.records=[record];
 });
 await p.locator('.diary-week-review').click();const send=p.locator('.review-action').filter({hasText:/AI 整理/});
 assert.notEqual(await send.getAttribute('disabled'),null);assert.equal(requests.length,0);
 await p.locator('.review-consent uni-checkbox').click();await send.click();await p.locator('.ai-result').waitFor();
 assert.equal(requests.length,1);assert.equal(requests[0].records.length,1);assert.match(requests[0].records[0].content,/本周合成原文/);assert.equal(requests[0].consent,true);
 assert.match(await p.locator('.review-source').innerText(),/AI 生成内容/);
 await p.locator('.review-save').click();assert.equal(await p.locator('.review-history-row').count(),1);
 mode='delayed';await p.locator('.diary-week-review').click();assert.notEqual(await send.getAttribute('disabled'),null);
 await p.locator('.review-consent uni-checkbox').click();await send.click();
 for(let attempt=0;attempt<150&&!release;attempt++)await new Promise(r=>setTimeout(r,20));assert.equal(typeof release,'function');
 await p.locator('.diary-journal').evaluate(el=>{uni.setStorageSync('beihu:tool-records:v2:900007',[]);let c=el.__vueParentComponent;while(c&&!Object.hasOwn(c.setupState,'reportScope'))c=c.parent;c.setupState.records=[]});
 release();await p.waitForTimeout(250);assert.equal(await p.locator('.ai-result').count(),0);assert.equal(await p.locator('.review-history-row').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS mocked AI weekly flow: explicit consent, exact selected payload, source label, save; delete during delayed response discards stale result');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
