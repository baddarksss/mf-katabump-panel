/* Administrator controls, injected into the native vpn-ui panel. */
(() => {
  'use strict';
  async function request(route, data) {
    const response = await fetch('/mf/' + route, data === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok || !result.success) throw Error(result.msg || 'درخواست ناموفق بود');
    return result;
  }
  async function main() {
    let status;
    try { status = await request('status'); } catch { return; }
    const box = document.createElement('details');
    box.dir = 'rtl';
    box.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:9999;background:#17202b;color:#fff;padding:14px;border:1px solid #526477;border-radius:10px;max-width:430px;font:14px Tahoma;max-height:80vh;overflow:auto';
    box.innerHTML = '<summary>⚙ ساب و نود Katabump</summary><p>کلاینت‌ها را در بخش Clients / Inbounds بسازید. لینک ساب از همان کلاینت قابل کپی است.</p><label>آدرس عمومی پنل <input id="mf-origin" dir="ltr" style="width:100%;color:#111"></label><p><button id="mf-save">فعال‌سازی / اصلاح ساب و نام کانفیگ</button></p><hr><p>نود: API اینباند با توکن مستقل. API کلاینت نسخهٔ ۳ از 3x-ui هنوز با این هسته سازگار نیست.</p><button id="mf-node">ساخت / تعویض توکن نود</button> <button id="mf-disable">خاموش‌کردن نود</button><pre id="mf-result" dir="ltr" style="white-space:pre-wrap;overflow-wrap:anywhere"></pre>';
    document.body.appendChild(box);
    const field = box.querySelector('#mf-origin'); field.value = status.origin || location.origin;
    const result = box.querySelector('#mf-result');
    const update = document.createElement('button');
    update.textContent = 'Check for update — GitHub';
    box.appendChild(update);
    update.onclick = function () { run(this, async () => {
      const release = await request('update/check');
      if (!release.available) { result.textContent = 'نسخهٔ فعلی به‌روز است.'; return; }
      const staged = await request('update/stage', {});
      if (!staged.staged) { result.textContent = 'نسخهٔ فعلی به‌روز است.'; return; }
      if (confirm('نسخه بررسی شد. پنل برای اعمال آپدیت ری‌استارت می‌شود؛ اطلاعات کلاینت‌ها حفظ می‌شوند. ادامه؟')) {
        const applied = await request('update/apply', {});
        result.textContent = applied.message;
      } else result.textContent = 'نسخه دریافت و آماده شد؛ هنوز اعمال نشد.';
    }); };
    const xray = document.createElement('button');
    xray.textContent = 'Update Xray';
    box.appendChild(xray);
    xray.onclick = function () { run(this, async () => {
      const versions = await request('xray/versions');
      const list = Array.isArray(versions.versions) ? versions.versions : (versions.versions?.versions || versions.versions?.obj || []);
      const current = (await request('xray/status')).status || {};
      const selected = prompt('نسخه Xray را وارد کنید. نسخه فعلی: ' + (current.xrayVersion || current.version || 'نامشخص') + '\nنسخه‌های قابل نصب: ' + list.join(', '), list[list.length - 1] || '');
      if (!selected) return;
      const resultXray = await request('xray/install', { version: selected });
      result.textContent = resultXray.message;
    }); };
    // Capture the stock update action before Vue invokes the binary updater.
    document.addEventListener('click', event => {
      const target = event.target.closest('button,a,[role="menuitem"]');
      if (!target || target === update || box.contains(target)) return;
      if (/check\s+for\s+updates?|بررسی.*(?:آپدیت|به.?روز)/i.test(target.textContent || '')) {
        event.preventDefault(); event.stopImmediatePropagation(); box.open = true; update.click();
      }
    }, true);
    async function run(button, action) { button.disabled = true; try { await action(); } catch(e) { result.textContent = e.message; } finally { button.disabled = false; } }
    box.querySelector('#mf-save').onclick = function () { run(this, async () => { const r = await request('configure', { origin: field.value }); result.textContent = r.changed ? 'تنظیمات ذخیره شد. چند ثانیه بعد صفحه را تازه کنید.' : 'ساب آماده است.'; }); };
    box.querySelector('#mf-node').onclick = function () { run(this, async () => { const r = await request('node', { enabled: true, rotate: true }); result.textContent = 'Address: ' + location.host + '\nScheme: ' + location.protocol.replace(':','') + '\nBase path: /node/\nAPI token (shown once): ' + r.token; }); };
    box.querySelector('#mf-disable').onclick = function () { run(this, async () => { await request('node', { enabled: false }); result.textContent = 'نود خاموش شد.'; }); };
    box.querySelector('hr').nextElementSibling.textContent = 'نود با توکن مستقل: وضعیت، اینباند و ساخت/ویرایش/حذف کلاینت. سهمیهٔ تجمیعی بین چند نود پشتیبانی نمی‌شود.';
    // Bootstrap from the browser's actual public address, including its port.
    if (!status.origin && false) {
      try { const r = await request('configure', { origin: location.origin }); if (r.changed) result.textContent = 'آدرس ساب تنظیم شد؛ چند ثانیه بعد صفحه را تازه کنید.'; } catch(e) { result.textContent = e.message; }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
})();
