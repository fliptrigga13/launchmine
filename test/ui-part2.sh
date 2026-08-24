E="node test/cdp-eval.js"
$E "[...document.querySelectorAll('div.fixed button')].find(b=>b.textContent.trim()==='✕').click(); 'x'"
# AI conversation flow
$E "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Analyze AI Conversation')).click(); 'opened'"
sleep 0.5
$E "(()=>{const t=document.querySelector('textarea'); const s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; s.call(t,'User: build me a chrome extension for job applications. Assistant: here is the manifest.json spec...'); t.dispatchEvent(new Event('input',{bubbles:true})); return 1;})()"
$E "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Extract Product Spec')).click(); 'go'"
sleep 0.8
echo "AI detail:"; $E "document.querySelector('div.fixed h3')?.textContent"
echo "AI_CHAT badge:"; $E "[...document.querySelectorAll('span')].some(s=>s.textContent==='AI_CHAT')"
echo "AI Transcript evidence:"; $E "document.body.innerText.includes('AI Transcript')"
$E "[...document.querySelectorAll('div.fixed button')].find(b=>b.textContent.trim()==='✕').click(); 'x'"
sleep 0.3
# Truth and Methodology
$E "[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Truth & Methodology')).click(); 'x'"
sleep 0.5
echo "truth modal:"; $E "document.body.innerText.includes('Deterministic Scoring Formula') && document.body.innerText.includes('INSUFFICIENT EVIDENCE')"
$E "[...document.querySelectorAll('div.fixed button')].find(b=>b.textContent.trim()==='✕').click(); 'x'"
sleep 0.3
# Export backup
$E "window.__alerts=[]; URL.createObjectURL=()=>('blob:fake'); HTMLAnchorElement.prototype.click=function(){(window.__alerts=window.__alerts||[]).push('downloaded:'+this.download)}; 1"
$E "[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Export Backup').click(); 1"
sleep 0.4
echo "export:"; $E "(window.__alerts||[]).join(',')"
echo "final localStorage:"; $E "JSON.parse(localStorage.getItem('launchmine_v1_projects')).length"
