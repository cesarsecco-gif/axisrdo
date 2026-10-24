const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
process.chdir(__dirname);
console.log('AXIS RDO - GESTÃO DE OBRAS, RDO E FOTOGRÁFICO | AXIS CONSULTORIA E PLANEJAMENTO');
const EXPECTED_VERSION = '1.14.0-efetivo-no-rdo';
const url = 'http://127.0.0.1:3000';
function health() {
  return new Promise(resolve => {
    const req = http.get(url + '/api/health', { timeout: 1500 }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { const status = JSON.parse(body); resolve({ ok: (status.app === 'axis-rdo' || status.app === 'der-photo-desktop') && status.offline === true, version: status.version }); }
        catch { resolve({ ok: false }); }
      });
      res.on('error', () => resolve({ ok: false }));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve({ ok: false }));
  });
}
function open() {
  console.log('Abra no navegador: ' + url);
  if (process.platform === 'win32') {
    const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', url], { stdio: 'ignore' });
    browser.on('error', () => console.log('Abra o endereco acima manualmente.'));
  }
}
(async () => {
  const first = await health();
  if (first.ok) {
    if (first.version !== EXPECTED_VERSION) console.log('Ja existe uma sessao em uso (' + first.version + '). Feche a janela e o terminal antigos para usar a versao ' + EXPECTED_VERSION + '.');
    open();
    return;
  }
  const server = spawn(process.execPath, [path.join(__dirname, 'dist', 'server.cjs')], {
    cwd: __dirname, env: { ...process.env, NODE_ENV: 'production', PORT: '3000' }, stdio: 'inherit'
  });
  let ended = false;
  server.on('error', err => { ended = true; console.error('Falha ao iniciar: ' + err.message); process.exitCode = 1; });
  server.on('exit', code => { ended = true; if (code) { console.error('Feche a janela da versao anterior se a porta 3000 estiver ocupada.'); process.exitCode = code; } });
  process.on('SIGINT', () => { server.kill(); });
  console.log('Iniciando aplicativo local...');
  for (let i = 0; i < 60 && !ended; i++) {
    const status = await health();
    if (status.ok) {
      if (status.version !== EXPECTED_VERSION) console.log('Atencao: o servidor respondeu com a versao ' + status.version + '.');
      open();
      console.log('Mantenha esta janela aberta. Aguarde "Salvo neste PC" antes de encerrar.');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ended) {
    console.log('Nao foi possivel confirmar a abertura automaticamente.');
    console.log('O servidor foi mantido aberto. Tente acessar: ' + url);
    console.log('Se a pagina nao abrir, envie as mensagens desta janela.');
  }
})();
