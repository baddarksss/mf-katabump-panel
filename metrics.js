'use strict';
module.exports = function metrics(root, read = p => require('fs').readFileSync(p,'utf8'), clock = () => Number(process.hrtime.bigint()) / 1e9) {
  const {execFile} = require('child_process');
  const text = p => { try { return read(p).trim(); } catch { return ''; } };
  const number = p => { const s=text(p); return s && s !== 'max' && Number.isFinite(Number(s)) ? Number(s) : null; };
  const cg = (controller, name) => {
    const row=text('/proc/self/cgroup').split('\n').find(r=>r.split(':')[1].split(',').includes(controller));
    const sub=row ? row.split(':')[2] : '';
    for(const base of controller ? ['/sys/fs/cgroup/'+controller+sub,'/sys/fs/cgroup/'+controller] : ['/sys/fs/cgroup'+(text('/proc/self/cgroup').match(/^0::(.+)$/m)||[])[1],'/sys/fs/cgroup']) {
      const val=text(base+'/'+name); if(val) return val;
    }
    return '';
  };
  const finite = s => s !== '' && s !== 'max' && Number.isFinite(Number(s)) && Number(s)<1e18 ? Number(s) : null;
  let previous, cached, disk=null, diskAt=-Infinity, diskBusy=false;
  function measureDisk() {
    if(diskBusy || clock()-diskAt<60)return;
    diskBusy=true;diskAt=clock();
    execFile('du',['-s','-B1','--',root],{timeout:30000},(err,out)=>{if(!err)disk=Number(out.trim().split(/\s+/)[0]);diskBusy=false;});
  }
  return function sample() {
    const now=clock(); if(cached && now-cached.at<1)return cached.value;
    measureDisk();
    const mem=finite(cg('','memory.current')) ?? finite(cg('memory','memory.usage_in_bytes'));
    const total=finite(cg('','memory.max')) ?? finite(cg('memory','memory.limit_in_bytes'));
    const stat=cg('','cpu.stat');
    const usage=stat.match(/^usage_usec (\d+)/m);
    const cpuTime=usage ? Number(usage[1])/1e6 : (finite(cg('cpuacct','cpuacct.usage')) ?? NaN)/1e9;
    const quota=cg('','cpu.max').split(/\s+/);
    let cores=quota[0] && quota[0]!=='max' ? Number(quota[0])/Number(quota[1]) : null;
    if(!cores) {const q=finite(cg('cpu','cpu.cfs_quota_us')),p=finite(cg('cpu','cpu.cfs_period_us'));if(q>0&&p>0)cores=q/p;}
    const cpus=text('/proc/self/status').match(/^Cpus_allowed_list:\s*(.+)$/m);
    if(cpus){const count=cpus[1].split(',').reduce((n,r)=>{const a=r.split('-').map(Number);return n+(a.length===2?a[1]-a[0]+1:1);},0);cores=cores?Math.min(cores,count):count;}
    const cpu=previous && cores && Number.isFinite(cpuTime) && cpuTime>=previous.cpuTime ? Math.min(100,100*(cpuTime-previous.cpuTime)/(now-previous.at)/cores) : null;
    const net={sent:0,recv:0};
    for(const line of text('/proc/net/dev').split('\n')) {const parts=line.split(':');if(parts.length!==2||parts[0].trim()==='lo')continue;const fields=parts[1].trim().split(/\s+/).map(Number);net.recv+=fields[0]||0;net.sent+=fields[8]||0;}
    const netIO={up:previous?Math.max(0,net.sent-previous.net.sent)/(now-previous.at):0,down:previous?Math.max(0,net.recv-previous.net.recv)/(now-previous.at):0};
    previous={at:now,cpuTime,net};
    const limit=Number(process.env.KATABUMP_DISK_MB);
    const value={cpu,cpuCores:cores,logicalPro:cores,mem:{current:mem,total},swap:{current:finite(cg('','memory.swap.current')),total:finite(cg('','memory.swap.max'))},disk:{current:disk,total:limit>0?limit*1024*1024:null},uptime:Math.floor(process.uptime()),loads:[],diskIO:{read:null,write:null},swapIO:{in:null,out:null},memHW:{},cpuSpeedCurMhz:0,cpuSpeedMhz:0,metricsScope:'container; disk=server directory; uptime=runner',missing:[]};
    Object.assign(value,{netTraffic:net,netIO,netIOByIface:[]});
    for(const key of ['mem','swap','disk'])if(value[key].current===null||value[key].total===null)value.missing.push(key);
    if(cpu===null)value.missing.push('cpu');
    cached={at:now,value};return value;
  };
};
