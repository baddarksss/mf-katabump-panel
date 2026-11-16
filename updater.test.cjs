const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),assert=require('assert');
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mf-updater-'));
 try {
  fs.mkdirSync(path.join(root,'vpn'));fs.writeFileSync(path.join(root,'vpn','clients.db'),'active-clients');
  fs.writeFileSync(path.join(root,'update-source.json'),JSON.stringify({repository:'owner/repo'}));
  const files={};const contents={};
  for(const name of ['index.js','gateway.js','admin.js','updater.js','package.json']){
   contents[name]=Buffer.from(name.endsWith('.json')?'{}':'"use strict";');
   files[name]=crypto.createHash('sha256').update(contents[name]).digest('hex');
   fs.writeFileSync(path.join(root,name),name==='package.json'?'{}':'original');
  }
  const fetch=async url=>url.endsWith('/commits/main')?Buffer.from(JSON.stringify({sha:'a'.repeat(40)})):url.endsWith('update-manifest.json')?Buffer.from(JSON.stringify({version:'2.1.0',files})):contents[url.split('/').pop()];
  const updater=require('./updater')(root,fetch);
  assert((await updater.stage()).staged);
  assert.equal(fs.readFileSync(path.join(root,'vpn','clients.db'),'utf8'),'active-clients');
  assert.equal(fs.readFileSync(path.join(root,'index.js'),'utf8'),'original');
  contents['index.js']=Buffer.from('tampered');
  await assert.rejects(updater.stage(),/Checksum/);
  assert.equal(fs.readFileSync(path.join(root,'index.js'),'utf8'),'original');
  console.log('PASS: staged update, checksum rejection, live source and client data preserved');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
