const assert=require('assert');
let time=0,usage=1000000;
const files={'/proc/self/cgroup':'0::/','/sys/fs/cgroup/memory.current':'52428800','/sys/fs/cgroup/memory.max':'104857600','/sys/fs/cgroup/cpu.max':'50000 100000','/proc/self/status':'Cpus_allowed_list:\t0-3'};
const sample=require('./metrics')(__dirname,p=>p.endsWith('/cpu.stat')?'usage_usec '+usage:files[p]||'',()=>time);
assert.equal(sample().cpu,null);time=2;usage+=500000;
const result=sample();assert.equal(result.cpu,50);assert.equal(result.cpuCores,0.5);assert.equal(result.mem.total,104857600);assert.equal(result.disk.total,null);
console.log('PASS: cgroup memory, fractional CPU quota, interval usage and unknown disk quota');
