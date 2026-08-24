// Interactive CDP REPL helper: run one JS expression against the LaunchMine tab
const WebSocket = require('ws');
const http = require('http');

const expr = process.argv[2];
function getTargets() {
  return new Promise((res, rej) => {
    http.get('http://localhost:9222/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}
(async () => {
  const targets = await getTargets();
  const page = targets.find(t => t.type === 'page' && t.url.includes('launchmine'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }));
  });
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id === 1) {
      if (msg.result && msg.result.exceptionDetails) console.log('JS ERROR:', (msg.result.exceptionDetails.exception||{}).description || msg.result.exceptionDetails.text);
      else console.log(JSON.stringify(msg.result && msg.result.result ? msg.result.result.value : null));
      process.exit(0);
    }
  });
})();
