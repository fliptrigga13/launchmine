// Pipeline verification for LaunchMine — exercises the same logic embedded in index.html
const https = require('https');
const fs = require('fs');

function gh(u) {
  return new Promise((res, rej) => {
    https.get(u, { headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'launchmine-test' } }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res({ status: r.statusCode, body: JSON.parse(d || 'null') }));
    }).on('error', rej);
  });
}

(async () => {
  const src = fs.readFileSync('index.html', 'utf8');
  const m = src.match(/function calculateLaunchScore[\s\S]*?\/\/ ---------- App ----------/);
  if (!m) { console.log('EXTRACT FAIL'); process.exit(1); }
  const logic = m[0].replace(/const \{ useState.*\n/, '');
  eval(logic);

  const u = await gh('https://api.github.com/users/fliptrigga13');
  console.log('user lookup:', u.status, u.body && u.body.login);
  const rr = await gh('https://api.github.com/users/fliptrigga13/repos?per_page=100&sort=updated&page=1');
  console.log('repos page1:', rr.status, 'count', rr.body.length);
  const owned = rr.body.filter(r => !r.fork);
  console.log('owned repos:', owned.map(r => r.name).join(', '));

  const cands = owned.slice(0, 3);
  for (const repo of cands) {
    const ev = { files: [], readmeText: null, errors: [] };
    const c = await gh(`https://api.github.com/repos/${repo.full_name}/contents/`);
    if (c.status === 200 && Array.isArray(c.body)) ev.files = c.body.map(f => f.name);
    const r2 = await gh(`https://api.github.com/repos/${repo.full_name}/readme`);
    if (r2.status === 200) ev.readmeText = Buffer.from(r2.body.content, 'base64').toString().slice(0, 8000);
    const p = buildProjectFromRepo(repo, ev);
    console.log('---', p.name, '| score', p.launchScore, '|', p.priority, '|', p.model, '| sourceType:', p.sourceType, '| DEMO badge?', p.sourceType === 'DEMO');
    p.evidence.forEach(e => console.log('   [' + e.type + ']', e.tag, String(e.text).slice(0, 80)));
  }

  // error paths
  const nf = await gh('https://api.github.com/users/definitelynotarealuser_xyz_987654');
  console.log('nonexistent user status:', nf.status, '(expect 404 -> USER_NOT_FOUND handling)');

  const pp = buildProjectFromPaste('Test CLI Tool', 'A node cli dashboard for monitoring apis. package.json included.');
  console.log('paste pipeline:', pp.name, '| score', pp.launchScore, '|', pp.priority, '|', pp.model);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
