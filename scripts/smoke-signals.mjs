import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Real packaged commands and HTTP, inert credentials, no external mail.
const binary=resolve(process.argv[2]??'cli-node/bin/run.js');
const root=await mkdtemp(join(tmpdir(),'primitive-signal-smoke-')), config=join(root,'config');
await mkdir(config,{mode:0o700});
const agent='agent@example.test', peer='peer@example.net', credential=['pconn','s'.repeat(48)].join('_');
const emails=new Map(), sends=[], requests=[], failures=[];
let loseNext=false, lookup=true, holdNext=false, release;
function parent(overrides={}) {
  const id=randomUUID();const detail={id,from_email:peer,from_header:peer,recipient:agent,to_email:agent,status:'completed',message_id:`<${id}@example.net>`,subject:'Work request',body_text:'Review this task',body_html:null,parsed:{status:'complete',attachments:[],references:[]},auth:{dmarc:'pass',dmarcFromDomain:'example.net',dmarcDkimAligned:true,dkimSignatures:[]},...overrides};emails.set(id,detail);return id;
}
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');let raw='';for await(const chunk of req)raw+=chunk;
    const body=raw?JSON.parse(raw):null;requests.push(url.pathname);
    const ok=data=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({success:true,data,meta:{cursor:null}}));};
    if(url.pathname==='/v1/agent-connections/claim')return ok({org_id:'11111111-1111-4111-8111-111111111111',api_base_url:'https://api.primitive.dev/v1',api_key:credential,owner_address:'owner@example.test',connection:{address:agent,owner_address:'owner@example.test',status:'claimed'}});
    assert.equal(req.headers.authorization,`Bearer ${credential}`);
    if(url.pathname.startsWith('/v1/emails/')){const id=url.pathname.split('/').at(-1);assert.ok(emails.has(id));return ok(emails.get(id));}
    if(url.pathname==='/v1/sent-emails'){assert.equal(url.searchParams.get('limit'),'2');return ok(lookup?sends.filter(x=>x.client_idempotency_key===url.searchParams.get('idempotency_key')):[]);}
    if(url.pathname==='/v1/send-mail'){
      assert.equal(body.from,agent);assert.equal(body.to,peer);
      const signal=JSON.parse(Buffer.from(body.attachments[0].content_base64,'base64').toString());
      assert.equal(signal.payload.subject_message_id,body.in_reply_to);assert.equal(signal.protocol,signal.step);
      const row={id:randomUUID(),status:'delivered',from:agent,from_address:agent,to_address:peer,idempotent_replay:false,client_idempotency_key:req.headers['idempotency-key'],signal,body};
      sends.push(row);
      if(holdNext){holdNext=false;await new Promise(r=>release=r);}
      if(loseNext){loseNext=false;res.destroy();return;}
      return ok(row);
    }
    throw new Error('Unexpected route');
  }catch(error){failures.push(error);res.statusCode=500;res.end('{}');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const preload=join(root,'boundaries.mjs');
await writeFile(preload,`const original=globalThis.fetch;globalThis.fetch=async(input,init)=>{const request=new Request(input,init);const url=new URL(request.url);if(url.origin!=='https://api.primitive.dev')throw new Error('External network forbidden');return original(${JSON.stringify(base)}+url.pathname+url.search,{method:request.method,headers:request.headers,body:request.body,signal:request.signal,duplex:'half',redirect:'error'});};`,{mode:0o600});
const env={...process.env,PRIMITIVE_CONFIG_DIR:config,XDG_CONFIG_HOME:config,PRIMITIVE_SKIP_NEW_VERSION_CHECK:'1',NO_COLOR:'1'};
for(const key of Object.keys(env))if((key.startsWith('PRIMITIVE_')&&!['PRIMITIVE_CONFIG_DIR','PRIMITIVE_SKIP_NEW_VERSION_CHECK'].includes(key))||/proxy/i.test(key))delete env[key];
async function run(args,{exit=0,stdin='',profile=true}={}){
  const child=spawn(process.execPath,['--import',pathToFileURL(preload).href,binary,...args],{cwd:root,env:{...env,...(profile?{PRIMITIVE_AGENT_PROFILE:'work'}:{})},stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.stdin.end(stdin);
  const timer=setTimeout(()=>child.kill('SIGKILL'),15000);
  const code=await new Promise((r,j)=>{child.once('close',r);child.once('error',j);});clearTimeout(timer);
  assert.equal(code,exit,`${args.slice(0,2).join(' ')}: ${stderr}`);assert.ok(!(stdout+stderr).includes(credential));if(failures.length)throw failures[0];
  return {stdout,stderr,data:stdout.trim().startsWith('{')?JSON.parse(stdout):null};
}
const call=(kind,id,extra=[])=>['signal',kind,'--id',id,...extra,'--json'];
try{
  const help=await run(['signal','--help'],{profile:false});assert.match(help.stdout,/Unknown outcomes must reconcile/);
  await run(['signal'],{exit:2,profile:false});
  await run(['agent','connect','--profile','work','--json'],{profile:false,stdin:JSON.stringify({token:['inert','invitation','x'.repeat(48)].join('_')})});
  for(const kind of ['read','ack','working','typing']){
    const id=parent(),args=call(kind,id,kind==='ack'?['--status','received']:[]),before=sends.length;
    assert.equal((await run(args)).data.outcome,'sent');
    assert.equal((await run(args)).data.outcome,'already_sent');assert.equal(sends.length,before+1);
    assert.equal(sends.at(-1).signal.protocol,kind);
  }
  for(const status of ['will_process','will_not_process'])assert.equal((await run(call('ack',parent(),['--status',status]))).data.outcome,'sent');
  const invalidBefore=requests.length;await run(call('typing',parent(),['--expires-in','31']),{exit:1});assert.equal(requests.length,invalidBefore,'invalid typing expiry must fail before network');
  const active=call('working',parent(),['--expires-in','1']);await run(active);const oldKey=sends.at(-1).client_idempotency_key;
  await new Promise(r=>setTimeout(r,1100));assert.equal((await run(active)).data.outcome,'sent');assert.notEqual(sends.at(-1).client_idempotency_key,oldKey);
  const uncertain=call('typing',parent(),['--expires-in','1']);loseNext=true;
  assert.equal((await run(uncertain,{exit:4})).data.outcome,'uncertain');const before=sends.length;lookup=false;
  await new Promise(r=>setTimeout(r,1100));await run(uncertain,{exit:4});assert.equal(sends.length,before);
  lookup=true;assert.equal((await run(uncertain)).data.outcome,'sent');assert.equal(sends.length,before+1);
  const concurrent=call('read',parent());holdNext=true;release=undefined;const first=run(concurrent);
  const deadline=Date.now()+5000;while(!release){assert.ok(Date.now()<deadline);await new Promise(r=>setTimeout(r,20));}
  const count=sends.length;await run(concurrent,{exit:1});assert.equal(sends.length,count);release();await first;
  const rejectedBefore=sends.length;
  await run(call('read',parent({from_email:agent,from_header:agent,auth:{dmarc:'pass',dmarcFromDomain:'example.test',dmarcDkimAligned:true,dkimSignatures:[]}})),{exit:1});
  await run(call('read',parent({parsed:{status:'complete',attachments:[{filename:'interaction.json',content_type:'application/json'}]}})),{exit:1});
  await run(call('read',parent({auth:{dmarc:'fail',dmarcFromDomain:'example.net',dkimSignatures:[]}})),{exit:1});
  assert.equal(sends.length,rejectedBefore);
  assert.ok(requests.every(path=>!['/v1/account','/v1/domains','/v1/emails'].includes(path)));
  console.log('Packaged signals passed: four command shapes, exact parent, deduplication, expiry renewal, unknown reconciliation, concurrency, trust and loop guards. Local fixtures only.');
}finally{release?.();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
