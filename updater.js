'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const FILES = ['index.js','gateway.js','admin.js','updater.js','package.json'];
function get(url) {
  return new Promise((resolve,reject) => {
    const req = https.get(url, {headers:{'User-Agent':'MF-Katabump-Updater','Accept':'application/vnd.github+json'},timeout:20000},res=>{
      if(res.statusCode!==200) {res.resume();return reject(Error('GitHub HTTP '+res.statusCode));}
      let size=0;const chunks=[];
      res.on('data',c=>{size+=c.length;if(size>2*1024*1024)res.destroy(Error('Download too large'));else chunks.push(c);});
      res.on('error',reject);res.on('end',()=>resolve(Buffer.concat(chunks)));
    });
    req.on('timeout',()=>req.destroy(Error('GitHub timeout')));req.on('error',reject);
  });
}
module.exports = function updater(root = __dirname, fetch = get) {
  let busy=false;
  function repository() {
    const config=JSON.parse(fs.readFileSync(path.join(root,'update-source.json'),'utf8'));
    if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository||''))throw Error('ریپوی GitHub هنوز تنظیم نشده است');
    return config.repository;
  }
  async function check() {
    const repo=repository();
    const commit=JSON.parse((await fetch('https://api.github.com/repos/'+repo+'/commits/main')).toString());
    if(!/^[a-f0-9]{40}$/.test(commit.sha||''))throw Error('Invalid commit');
    const manifest=JSON.parse((await fetch('https://raw.githubusercontent.com/'+repo+'/'+commit.sha+'/update-manifest.json')).toString());
    if(!manifest.version || !manifest.files || FILES.some(name=>! /^[a-f0-9]{64}$/.test(manifest.files[name]||'')))throw Error('Invalid release manifest');
    const available=FILES.some(name=>!fs.existsSync(path.join(root,name))||crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')!==manifest.files[name]);
    return {repository:repo,commit:commit.sha,version:manifest.version,available,files:manifest.files};
  }
  async function stage() {
    if(busy)throw Error('آپدیت دیگری در حال دریافت است');busy=true;
    let temp;
    try {
      const release=await check();
      if(!release.available)return {...release,staged:false};
      const parent=path.join(root,'.mf-updates');fs.mkdirSync(parent,{recursive:true});
      temp=fs.mkdtempSync(path.join(parent,'download-'));
      for(const name of FILES) {
        const data=await fetch('https://raw.githubusercontent.com/'+release.repository+'/'+release.commit+'/'+name);
        if(crypto.createHash('sha256').update(data).digest('hex')!==release.files[name])throw Error('Checksum mismatch: '+name);
        fs.writeFileSync(path.join(temp,name),data);
        if(name.endsWith('.js')) {
          const result=spawnSync(process.execPath,['--check',path.join(temp,name)],{timeout:15000,encoding:'utf8'});
          if(result.status!==0)throw Error('Syntax check failed: '+name);
        }
      }
      JSON.parse(fs.readFileSync(path.join(temp,'package.json'),'utf8'));
      fs.writeFileSync(path.join(temp,'release.json'),JSON.stringify(release));
      const destination=path.join(parent,release.commit);
      if(fs.existsSync(destination))fs.rmSync(destination,{recursive:true});
      fs.renameSync(temp,destination);temp=null;
      // Deliberately stage only: the TCP router owns live sockets. Replacing or
      // restarting that process cannot promise uninterrupted active connections.
      return {version:release.version,commit:release.commit,staged:true,restartRequired:true,message:'نسخه دریافت و بررسی شد؛ برای حفظ اتصال‌های فعال هنوز اعمال نشده است.'};
    } finally {if(temp)fs.rmSync(temp,{recursive:true,force:true});busy=false;}
  }
  return {check,stage};
};
