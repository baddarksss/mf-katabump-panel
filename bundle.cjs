'use strict';
// Produces a standalone index.js; no extracted runtime modules are needed.
const fs=require('fs');
let index=fs.readFileSync('index.js','utf8');
const marker='// BEGIN MF EMBEDDED MODULES';
if(index.includes(marker))index=index.slice(0,index.indexOf(marker));
index=index.replace("require('./gateway')(","mfModule('gateway')(");
const sources={};
for(const name of ['gateway','updater','metrics'])sources[name]=fs.readFileSync(name+'.js','utf8');
sources.admin=fs.readFileSync('admin.js','utf8');
const embedded=`\n${marker}\nfunction mfModule(name) {\n const sources=${JSON.stringify(sources)};\n if(name==='admin')return sources.admin;\n const mod={exports:{}};\n const localRequire=id=>id.startsWith('./')?mfModule(id.slice(2)):require(id);\n new Function('module','exports','require','__dirname',sources[name])(mod,mod.exports,localRequire,__dirname);\n return mod.exports;\n}\n`;
fs.writeFileSync('index.js',index+embedded);
