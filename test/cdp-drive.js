// CDP driver v2: exercise LaunchMine UI end-to-end
const WebSocket = require('ws');
const http = require('http');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getTargets() {
  return new Promise((res, rej) => {
    http.get('http://localhost:9222/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

async function main() {
  const targets = await getTargets();
  const page = targets.find(t => t.type === 'page' && t.url.includes('launchmine'));
  if (!page) { console.log('PAGE NOT FOUND'); process.exit(1); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = {};
  function send(method, params = {}) {
    return new Promise((res) => {
      const mid = ++id;
      pending[mid] = res;
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  }
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending[msg.id]) { pending[msg.id](msg); delete pending[msg.id]; }
  });
  await new Promise(r => ws.on('open', r));

  async function js(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) return 'JS ERROR';
    return r.result && r.result.result ? r.result.result.value : undefined;
  }

  console.log('title:', await js(`document.title`));
  console.log('queue count:', await js(`(document.body.innerText.match(/Opportunity Queue..(\\d+)/)||[])[1]`));
  console.log('scan button present:', await js(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Scan Public GitHub'))`));

  // silence alerts
  await js(`window.__alerts=[]; window.alert=(m)=>{window.__alerts.push(m)}; 1`);

  // ---- TEST 1: open Scan modal ----
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Scan Public GitHub')).click(); 1`);
  await sleep(300);
  console.log('T1 modal opens:', await js(`!!document.querySelector('input[placeholder*="GitHub username"]')`));
  console.log('T1 Scan Repositories button:', await js(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Scan Repositories')`));

  const clickScan = `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Scan Repositories').click(); 1`;
  const typeUser = (u) => js(`const i=document.querySelector('input[placeholder*="GitHub username"]'); const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(i,'${u}'); i.dispatchEvent(new Event('input',{bubbles:true})); 1`);
  const errMsg = () => js(`document.querySelector('.text-red-300.font-mono')?.innerText || null`);

  // ---- TEST 2: empty username ----
  await js(clickScan); await sleep(300);
  console.log('T2 empty-username error:', await errMsg());

  // ---- TEST 3: nonexistent user ----
  await typeUser('definitelynotarealuser_xyz_987654');
  await js(clickScan);
  for (let k = 0; k < 15; k++) { await sleep(1000); const e = await errMsg(); if (e) { console.log('T3 user-not-found error:', e); break; } }

  // ---- TEST 4: real scan fliptrigga13 ----
  await typeUser('fliptrigga13');
  await js(clickScan);
  await sleep(700);
  console.log('T4 loading state shown:', await js(`document.body.innerText.includes('Scanning public repositories...')`));
  let banner = null;
  for (let k = 0; k < 50; k++) {
    await sleep(1500);
    banner = await js(`document.querySelector('[class*="emerald-950"]')?.innerText || null`);
    if (banner) break;
    const e = await errMsg(); if (e) { console.log('T4 ERROR:', e); break; }
  }
  console.log('T4 done banner:', String(banner).slice(0, 130));
  console.log('T4 triage list shown:', await js(`document.body.innerText.includes('Triage Results')`));
  console.log('T4 result rows:', await js(`[...document.querySelectorAll('button')].find(b=>/Add \\d+ Opportunities to Queue/.test(b.textContent))?.textContent`));

  // ---- TEST 5: add to queue ----
  await js(`[...document.querySelectorAll('button')].find(b=>/Add \\d+ Opportunities to Queue/.test(b.textContent)).click(); 1`);
  await sleep(600);
  console.log('T5 detail modal auto-opened:', await js(`document.body.innerText.includes('Evidence Trail')`));
  console.log('T5 GITHUB provenance badge:', await js(`document.body.innerText.includes('GITHUB')`));
  console.log('T5 INSUFFICIENT EVIDENCE rendered:', await js(`document.body.innerText.includes('INSUFFICIENT EVIDENCE')`));
  console.log('T5 priority triage rendered:', await js(`/HIGH PRIORITY|POSSIBLE|LOW PRIORITY/.test(document.body.innerText)`));
  console.log('T5 repo link:', await js(`document.querySelector('a[href*="github.com/fliptrigga13"]')?.href || null`));
  console.log('T5 evidence tags:', await js(`[...document.querySelectorAll('span.font-mono')].map(s=>s.textContent).filter(t=>t.startsWith('[')).slice(0,8).join(', ')`));

  // close detail modal (✕ top-right)
  await js(`[...document.querySelectorAll('div.fixed button')].find(b=>b.textContent.trim()==='✕').click(); 1`);
  await sleep(300);
  console.log('T5 queue count after add:', await js(`(document.body.innerText.match(/Opportunity Queue..(\\d+)/)||[])[1]`));
  console.log('T5 GITHUB badges in queue:', await js(`[...document.querySelectorAll('span')].filter(s=>s.textContent==='GITHUB').length`));
  console.log('T5 DEMO badges (bundled samples only):', await js(`[...document.querySelectorAll('span')].filter(s=>s.textContent==='DEMO').length`));
  console.log('T5 persisted to localStorage:', await js(`JSON.parse(localStorage.getItem('launchmine_v1_projects')).length`));

  // ---- TEST 6: opportunity detail navigation (click a GITHUB row) ----
  await js(`[...document.querySelectorAll('div[class*="cursor-pointer"]')].find(d=>d.textContent.includes('GITHUB'))?.click(); 1`);
  await sleep(400);
  console.log('T6 row click opens detail:', await js(`document.body.innerText.includes('Minimum Sellable Scope Guard')`));

  // ---- TEST 6b: Copy Launch Kit ----
  await js(`window.__alerts=[]; 1`);
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Copy Complete Launch Kit')).click(); 1`);
  await sleep(400);
  console.log('T6b launch kit copied alert:', await js(`window.__alerts.join(' | ')`));
  await js(`[...document.querySelectorAll('div.fixed button')].find(b=>b.textContent.trim()==='✕').click(); 1`);

  // ---- TEST 7: Analyze Existing Project ----
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Analyze Existing Project')).click(); 1`);
  await sleep(300);
  console.log('T7 paste modal opens:', await js(`!!document.querySelector('textarea[placeholder*="package.json"]')`));
  await js(`const t=document.querySelector('textarea[placeholder*="package.json"]'); const n=document.querySelector('input[placeholder="Project name"]'); const s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; const sn=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; sn.call(n,'My CLI Radar'); n.dispatchEvent(new Event('input',{bubbles:true})); s.call(t,'A python cli tool that monitors api dashboards. package.json and Dockerfile included.'); t.dispatchEvent(new Event('input',{bubbles:true})); 1`);
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Analyze & Add to Opportunity Queue')).click(); 1`);
  await sleep(500);
  console.log('T7 analysis added & detail opened:', await js(`document.body.innerText.includes('My CLI Radar')`));
  console.log('T7 PASTE badge:', await js(`document.body.innerText.includes('PASTE')`));
  console.log('T7 pasted-input evidence:', await js(`document.body.innerText.includes('Pasted Input')`));
  await js(`[...document.querySelectorAll('div.fixed button')].find(b=>b.textContent.trim()==='✕').click(); 1`);

  // ---- TEST 8: Analyze AI Conversation ----
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Analyze AI Conversation')).click(); 1`);
  await sleep(300);
  console.log('T8 AI modal opens:', await js(`!!document.querySelector('textarea[placeholder*="transcript"]')`));
  await js(`const t=document.querySelector('textarea[placeholder*="transcript"]'); const s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; s.call(t,'User: build me a chrome extension for job applications. Assistant: here is the manifest.json spec...'); t.dispatchEvent(new Event('input',{bubbles:true})); 1`);
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Extract Product Spec')).click(); 1`);
  await sleep(500);
  console.log('T8 AI_CHAT badge:', await js(`document.body.innerText.includes('AI_CHAT')`));
  console.log('T8 transcript evidence:', await js(`document.body.innerText.includes('AI Transcript')`));
  await js(`[...document.querySelectorAll('div.fixed button')].find(b=>b.textContent.trim()==='✕').click(); 1`);

  // ---- TEST 9: Truth & Methodology + Export ----
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Truth & Methodology')).click(); 1`);
  await sleep(300);
  console.log('T9 truth modal opens:', await js(`document.body.innerText.includes('Deterministic Scoring Formula')`));
  console.log('T9 mentions INSUFFICIENT EVIDENCE policy:', await js(`document.body.innerText.includes('INSUFFICIENT EVIDENCE entry')`));
  await js(`[...document.querySelectorAll('div.fixed button')].find(b=>b.textContent.trim()==='✕').click(); 1`);
  await js(`window.__alerts=[]; URL.createObjectURL=()=>{}; HTMLAnchorElement.prototype.click=()=>{window.__alerts.push('download triggered')}; 1`);
  await js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export Backup').click(); 1`);
  await sleep(200);
  console.log('T9 export backup triggers download path:', await js(`window.__alerts.join('|') || 'no-op'`));

  // final queue state
  console.log('FINAL queue count:', await js(`(document.body.innerText.match(/Opportunity Queue..(\\d+)/)||[])[1]`));
  console.log('FINAL localStorage count:', await js(`JSON.parse(localStorage.getItem('launchmine_v1_projects')).length`));

  process.exit(0);
}
main().catch(e => { console.error('DRIVER FAIL', e.message); process.exit(1); });
