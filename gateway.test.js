'use strict';
const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const createGateway = require('./gateway');
(async () => {
  const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'mf-test-'));
  const calls = [];
  let config = { webPort: 18080, webBasePath: '/kb/', webListen: '127.0.0.1', unrelated: 'preserve' };
  const rows = [{ id: 1, port: 21011, protocol: 'vless', settings: JSON.stringify({ clients: [{ id: 'uuid', email: 'alice', subId: 'secret' }] }), streamSettings: '{"network":"ws"}' }];
  const gateway = createGateway({ http, fs, path, crypto, DATA, BASE: '/kb', PANEL_PORT:18080, USER_PORT:0, PUBLIC_PORT:8080, log() {}, readState: () => ({}), login: async () => 'admin=ok', formBody: data => new URLSearchParams(data).toString(),
    panelRequest: async (method, route, options = {}) => {
      calls.push({ method, route, body: options.body });
      if (options.cookie !== 'admin=ok') return { status:404, body:'' };
      let obj;
      if (route.endsWith('/setting/all')) obj = config;
      if (route.endsWith('/setting/update')) config = Object.fromEntries(new URLSearchParams(options.body));
      if (route.endsWith('/inbounds/list')) obj = rows;
      return { status:200, body:JSON.stringify({ success:true, obj }) };
    }
  });
  const server = http.createServer((req,res) => gateway.handle(req,res).catch(e => {res.writeHead(400);res.end(e.message);}));
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const headers = { cookie:'admin=ok', origin:base, 'content-type':'application/json' };
  try {
    assert.throws(() => gateway.origin('https://user:password@example.com'));
    await gateway.configure('admin=ok','http://katabump.example:34567');
    assert.equal(config.subURI,'http://katabump.example:34567/sub/');
    assert.equal(config.subListen,'127.0.0.1');
    assert.equal(config.remarkModel,'-e');
    assert.equal(config.unrelated,'preserve');
    assert.equal((await fetch(base+'/mf/status')).status,400);
    assert.equal((await fetch(base+'/mf/node',{method:'POST',headers:{...headers,origin:'https://evil.example'},body:'{"enabled":true}'})).status,400);
    const r = await (await fetch(base+'/mf/node',{method:'POST',headers,body:'{"enabled":true}'})).json();
    assert(r.token);
    assert(!fs.readFileSync(path.join(DATA,'mf_gateway.json'),'utf8').includes(r.token));
    assert.equal((await fetch(base+'/node/panel/api/inbounds/list')).status,401);
    const nodeHeaders = {authorization:'Bearer '+r.token,'content-type':'application/json'};
    assert.equal((await fetch(base+'/node/panel/api/server/updatePanel',{method:'POST',headers:nodeHeaders,body:'{}'})).status,501);
    const add = await fetch(base+'/node/panel/api/clients/add',{method:'POST',headers:nodeHeaders,body:JSON.stringify({client:{id:'new',email:'نام مشتری'},inboundIds:[1]})});
    assert.equal(add.status,200);
    assert(calls.some(c=>c.route.endsWith('/inbounds/addClient')&&decodeURIComponent(c.body).includes('نام')));
    const edit = await fetch(base+'/node/panel/api/clients/update/alice?inboundIds=1',{method:'POST',headers:nodeHeaders,body:'{"email":"renamed"}'});
    assert.equal(edit.status,200);
    assert(calls.some(c=>c.route.endsWith('/updateClient/uuid')));
    const redirect = await fetch(base+'/register',{redirect:'manual'});
    assert.equal(redirect.headers.get('location'),'/kb/');
    console.log('PASS: native subscription settings, public port, naming, permission, CSRF, token hashing, node authorization, client add/update, portal removal');
  } finally { await new Promise(resolve=>server.close(resolve)); fs.rmSync(DATA,{recursive:true,force:true}); }
})().catch(e=>{console.error(e);process.exitCode=1;});
