"use strict";

// The native panel owns clients, quotas, credentials and subscriptions.
// This adapter only publishes its loopback services on Katabump's allocation.
module.exports = function createGateway(deps) {
  const { http, fs, path, crypto, DATA, BASE, PANEL_PORT, USER_PORT, panelRequest, formBody, readState, login, log } = deps;
  const SUB_PORT = 18082;
  const file = path.join(DATA, 'mf_gateway.json');
  let settings;
  let nodeCookie = '';
  let configureChain = Promise.resolve();
  const updater = require('./updater')();
  const metrics = require('./metrics')(process.env.KATABUMP_ROOT || (fs.existsSync('/home/container') ? '/home/container' : process.cwd()));
  function load() {
    if (settings) return settings;
    try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw e; settings = { guid: crypto.randomUUID(), enabled: false }; }
    return settings;
  }
  function save() {
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(load(), null, 2), { mode: 0o600 });
    fs.renameSync(file + '.tmp', file);
  }
  function origin(value) {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw Error('آدرس باید فقط شامل http/https، دامنه یا IP و پورت باشد.');
    return u.origin;
  }
  function json(res, status, obj) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  }
  async function body(req) {
    let size = 0; const chunks = [];
    for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) throw Error('درخواست بیش از حد بزرگ است'); chunks.push(chunk); }
    const text = Buffer.concat(chunks).toString();
    return text ? (String(req.headers['content-type']).includes('application/json') ? JSON.parse(text) : Object.fromEntries(new URLSearchParams(text))) : {};
  }
  async function api(cookie, method, route, data) {
    const result = await panelRequest(method, BASE + route, { cookie, body: data === undefined ? undefined : formBody(data) });
    let parsed;
    try { parsed = JSON.parse(result.body); } catch { throw Error('نشست پنل معتبر نیست یا سرویس آماده نیست'); }
    if (result.status !== 200 || !parsed.success) throw Error(parsed.msg || 'درخواست پنل رد شد');
    return parsed.obj;
  }
  async function xrayVersions(cookie) {
    const result = await panelRequest('GET', BASE + '/panel/api/server/getXrayVersion', { cookie });
    let parsed;
    try { parsed = JSON.parse(result.body); } catch { throw Error('پاسخ نسخه‌های Xray معتبر نیست'); }
    if (result.status !== 200 || !parsed.success) throw Error(parsed.msg || 'دریافت نسخه‌های Xray ناموفق بود');
    return parsed.obj;
  }
  async function installXray(cookie, version) {
    if (!/^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/.test(String(version || ''))) throw Error('نسخه Xray معتبر نیست');
    const result = await panelRequest('POST', BASE + '/panel/api/server/installXray/' + encodeURIComponent(version), { cookie, body: '' });
    let parsed;
    try { parsed = JSON.parse(result.body); } catch { throw Error('پاسخ نصب Xray معتبر نیست'); }
    if (result.status !== 200 || !parsed.success) throw Error(parsed.msg || 'نصب Xray ناموفق بود');
    return parsed.obj;
  }
  async function configureNow(cookie, publicOrigin) {
    const current = await api(cookie, 'POST', '/panel/setting/all', {});
    const external = publicOrigin ? origin(publicOrigin) : load().origin || process.env.PUBLIC_URL && origin(process.env.PUBLIC_URL);
    const desired = {
      subEnable: true, subListen: '127.0.0.1', subPort: SUB_PORT,
      subPath: '/sub/', subJsonPath: '/json/', subJsonEnable: true,
      subClashPath: '/clash/', subClashEnable: true,
      subDomain: '', subCertFile: '', subKeyFile: '',
      remarkModel: '-e', subShowInfo: false,
      subURI: external ? external + '/sub/' : '/sub/',
      subJsonURI: external ? external + '/json/' : '/json/',
      subClashURI: external ? external + '/clash/' : '/clash/',
    };
    if (Number(current.webPort) !== PANEL_PORT || String(current.webBasePath).replace(/^\/+|\/+$/g, '') !== 'kb') throw Error('آدرس داخلی پنل تغییر کرده است');
    const changed = Object.keys(desired).some(k => String(current[k]) !== String(desired[k]));
    if (changed) {
      const values = { ...current, ...desired };
      for (const k of Object.keys(values)) values[k] = values[k] == null ? '' : typeof values[k] === 'object' ? JSON.stringify(values[k]) : String(values[k]);
      await api(cookie, 'POST', '/panel/setting/update', values);
      log('ساب اصلی روی پورت داخلی ' + SUB_PORT + ' فعال شد؛ تنظیم نام: نام کلاینت.');
    }
    if (external) {
      const address = new URL(external);
      const rows = await api(cookie, 'GET', '/panel/api/inbounds/list');
      for (const row of rows) {
        if (![21001,21002,21003,21011,21012,21013,21014,21015].includes(Number(row.port))) continue;
        const stream = typeof row.streamSettings === 'string' ? JSON.parse(row.streamSettings) : row.streamSettings || {};
        const httpTransport = ['ws','grpc','httpupgrade'].includes(stream.network);
        // HTTPS ingress cannot carry raw TCP. Keep those direct endpoints intact.
        if (address.protocol === 'https:' && !httpTransport) continue;
        const endpoint = [{ dest: address.hostname, port: Number(address.port || (address.protocol === 'https:' ? 443 : 80)), forceTls: address.protocol === 'https:' ? 'tls' : 'none', remark: '' }];
        if (JSON.stringify(stream.externalProxy) === JSON.stringify(endpoint)) continue;
        stream.externalProxy = endpoint;
        const fields = { ...row, streamSettings: JSON.stringify(stream) };
        delete fields.clientStats;
        for (const key of Object.keys(fields)) fields[key] = typeof fields[key] === 'object' ? JSON.stringify(fields[key]) : String(fields[key]);
        await api(cookie, 'POST', '/panel/api/inbounds/update/' + row.id, fields);
      }
    }
    nodeCookie = cookie;
    if (external) { load().origin = external; save(); }
    if (changed) await api(cookie, 'POST', '/panel/setting/restartPanel', {});
    return { changed, origin: external || '' };
  }
  function configure(cookie, external) {
    const task = configureChain.then(() => configureNow(cookie, external));
    configureChain = task.catch(() => {});
    return task;
  }
  async function admin(req) {
    const cookie = req.headers.cookie || '';
    if (!cookie) throw Error('ابتدا به پنل مدیریت وارد شوید');
    // Settings permission is required, not merely an arbitrary logged-in account.
    await api(cookie, 'POST', '/panel/setting/all', {});
    return cookie;
  }
  function sameOrigin(req) {
    const supplied = req.headers.origin;
    if (!supplied || new URL(supplied).host !== req.headers.host) throw Error('مبدأ درخواست معتبر نیست');
  }
  function proxy(req, res, port, headers) {
    const upstream = http.request({ hostname: '127.0.0.1', port, path: req.url, method: req.method,
      headers: { ...req.headers, ...headers, connection: 'close' }, timeout: 20000 }, response => {
      res.writeHead(response.statusCode, { ...response.headers, 'Cache-Control': 'no-store' });
      response.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy(Error('upstream timeout')));
    upstream.on('error', () => { if (!res.headersSent) json(res, 503, { success: false, msg: 'سرویس ساب در حال آماده‌سازی است' }); else res.destroy(); });
    req.on('aborted', () => upstream.destroy());
    req.pipe(upstream);
  }
  async function nodeSession() {
    if (nodeCookie) return nodeCookie;
    const s = readState();
    nodeCookie = await login(s.username, s.password);
    return nodeCookie;
  }
  const allowed = /^(?:GET \/panel\/api\/(?:server\/status|inbounds\/(?:list|get\/\d+|getClientTraffics\/[^/]+))|POST \/panel\/api\/(?:server\/restartXrayService|inbounds\/(?:add|update\/\d+|del\/\d+|addClient|updateClient\/[^/]+|\d+\/(?:delClient\/[^/]+|delClientByEmail\/[^/]+|resetClientTraffic\/[^/]+)|onlines|lastOnline|resetAllTraffics)))$/;
  async function node(req, res, url) {
    const cfg = load();
    const received = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const digest = crypto.createHash('sha256').update(received).digest('hex');
    if (!cfg.enabled || !cfg.tokenHash || !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(cfg.tokenHash))) return json(res, 401, { success: false, msg: 'Unauthorized' });
    const route = url.pathname.slice('/node'.length);
    if (req.method === 'POST' && route.startsWith('/panel/api/clients/')) {
      const cookie = await nodeSession();
      const action = route.slice('/panel/api/clients/'.length);
      if (['onlines','lastOnline'].includes(action)) return json(res, 200, { success: true, obj: await api(cookie, 'POST', '/panel/api/inbounds/' + action, {}) });
      const input = await body(req);
      const rows = await api(cookie, 'GET', '/panel/api/inbounds/list');
      const clients = row => { const s = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings; return s.clients || []; };
      if (action === 'add') {
        if (!input.client || !Array.isArray(input.inboundIds) || !input.inboundIds.length) throw Error('client and inboundIds required');
        for (const id of input.inboundIds) {
          if (!rows.some(row => row.id === Number(id))) throw Error('Inbound not found');
          await api(cookie, 'POST', '/panel/api/inbounds/addClient', { id, settings: JSON.stringify({ clients: [input.client] }) });
        }
      } else if (action.startsWith('update/')) {
        const email = decodeURIComponent(action.slice(7));
        const selected = (url.searchParams.get('inboundIds') || '').split(',').filter(Boolean).map(Number);
        const matches = rows.filter(row => (!selected.length || selected.includes(row.id)) && clients(row).some(c => c.email === email));
        if (!matches.length) throw Error('Client not found');
        for (const row of matches) {
          const c = clients(row).find(c => c.email === email);
          await api(cookie, 'POST', '/panel/api/inbounds/updateClient/' + encodeURIComponent(c.id || c.password || c.email), { id: row.id, settings: JSON.stringify({ clients: [{ ...c, ...input }] }) });
        }
      } else if (action.startsWith('del/') || action.endsWith('/detach') || action.startsWith('resetTraffic/')) {
        const reset = action.startsWith('resetTraffic/');
        const detach = action.endsWith('/detach');
        const email = decodeURIComponent(reset ? action.slice(13) : detach ? action.slice(0,-7) : action.slice(4));
        const matches = rows.filter(row => (!detach || (input.inboundIds || []).includes(row.id)) && clients(row).some(c => c.email === email));
        if (!matches.length) throw Error('Client not found');
        for (const row of matches) await api(cookie, 'POST', '/panel/api/inbounds/' + row.id + (reset ? '/resetClientTraffic/' : '/delClientByEmail/') + encodeURIComponent(email), {});
      } else return json(res, 501, { success: false, msg: 'Unsupported client operation' });
      return json(res, 200, { success: true, msg: '' });
    }
    if (!allowed.test(req.method + ' ' + route)) return json(res, 501, { success: false, msg: 'This vpn-ui node does not implement this 3x-ui API version/operation.' });
    const data = req.method === 'POST' ? await body(req) : undefined;
    let result;
    try { result = await api(await nodeSession(), req.method, route, data); }
    catch (e) { nodeCookie = ''; throw e; } // Never replay a mutation after an ambiguous failure.
    if (route === '/panel/api/server/status' && result) { result.panelGuid = cfg.guid; result.panelVersion = 'M&F 2.0 / vpn-ui 1.9.4'; }
    json(res, 200, { success: true, obj: result, msg: '' });
  }
  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/mf/admin.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(deps.adminSource || fs.readFileSync(path.join(__dirname, 'admin.js')));
    }
    if (url.pathname.startsWith('/node/')) return node(req, res, url);
    if (url.pathname.startsWith('/mf/')) {
      const cookie = await admin(req);
      if (req.method === 'GET' && url.pathname === '/mf/metrics') return json(res,200,{success:true,metrics:metrics()});
      if (req.method === 'GET' && url.pathname === '/mf/update/check') return json(res, 200, { success: true, ...await updater.check() });
      if (req.method === 'GET' && url.pathname === '/mf/xray/versions') return json(res, 200, { success: true, versions: await xrayVersions(cookie) });
      if (req.method === 'GET' && url.pathname === '/mf/xray/status') {
        const status = await api(cookie, 'GET', '/panel/api/server/status');
        return json(res, 200, { success: true, status });
      }
      if (req.method === 'GET' && url.pathname === '/mf/status') return json(res, 200, { success: true, origin: load().origin || '', nodeEnabled: !!load().enabled, nodeBasePath: '/node/', compatibility: 'Inbound API + client CRUD adapter; global traffic aggregation is not supported' });
      if (req.method !== 'POST') return json(res, 404, { success: false });
      sameOrigin(req);
      const input = await body(req);
      if (url.pathname === '/mf/update/stage') return json(res, 200, { success: true, ...await updater.stage() });
      if (url.pathname === '/mf/update/apply') {
        const result=updater.apply();
        setTimeout(() => process.kill(process.pid, 'SIGTERM'), 250).unref();
        return json(res, 200, { success: true, ...result });
      }
      if (url.pathname === '/mf/xray/install') {
        if (!input.version) throw Error('نسخه Xray را انتخاب کنید');
        return json(res, 200, { success: true, installed: await installXray(cookie, input.version), message: 'Xray به‌روزرسانی شد؛ کلاینت‌ها و لینک‌های قبلی حفظ شدند.' });
      }
      if (url.pathname === '/mf/configure') return json(res, 200, { success: true, ...await configure(cookie, input.origin) });
      if (url.pathname === '/mf/node') {
        const cfg = load(); cfg.enabled = input.enabled === true;
        let token;
        if (cfg.enabled && (input.rotate || !cfg.tokenHash)) { token = crypto.randomBytes(32).toString('base64url'); cfg.tokenHash = crypto.createHash('sha256').update(token).digest('hex'); }
        nodeCookie = cookie; save();
        return json(res, 200, { success: true, enabled: cfg.enabled, token, basePath: '/node/' });
      }
      return json(res, 404, { success: false });
    }
    if (/^\/(sub|json|clash)\/[^/]+/.test(url.pathname)) return proxy(req, res, SUB_PORT, { accept: 'text/plain' });
    if (['/', '/login', '/register', '/dashboard', '/sub'].includes(url.pathname)) { res.writeHead(302, { Location: BASE + '/', 'Cache-Control': 'no-store' }); return res.end(); }
    res.writeHead(404); res.end();
  }
  function start() {
    const server = http.createServer((req, res) => handle(req, res).catch(e => { log('gateway: ' + e.message); if (!res.headersSent) json(res, 400, { success: false, msg: e.message }); else res.destroy(); }));
    server.headersTimeout = 15000; server.requestTimeout = 30000;
    server.on('error', e => { log(e.message); process.exit(1); });
    server.listen(USER_PORT, '127.0.0.1');
    return server;
  }
  return { start, configure, handle, origin, allowed };
};
