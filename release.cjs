'use strict';
const fs=require('fs');
const crypto=require('crypto');
const files={};
for(const name of ['index.js','gateway.js','admin.js','updater.js','package.json']) files[name]=crypto.createHash('sha256').update(fs.readFileSync(name)).digest('hex');
fs.writeFileSync('update-manifest.json',JSON.stringify({version:JSON.parse(fs.readFileSync('package.json')).version,files},null,2)+'\n');
