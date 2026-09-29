import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const binary = resolve(process.argv[2] ?? 'cli-node/bin/run.js');
const directory = await mkdtemp(join(tmpdir(), 'primitive-connected-command-smoke-'));
const config = join(directory, 'config');
await mkdir(config, { mode: 0o700 });
const env = { ...process.env, PRIMITIVE_CONFIG_DIR: config, XDG_CONFIG_HOME: config, NO_COLOR: '1' };
for (const name of Object.keys(env)) if ((name.startsWith('PRIMITIVE_') && name !== 'PRIMITIVE_CONFIG_DIR') || /proxy/i.test(name)) delete env[name];
const peer = 'peer+demo@example.test', agent = 'agent@example.test';
const version = '11111111-1111-4111-8111-111111111111';
const stamp = '2026-09-27T12:00:00Z';
let contact, member;
let hits = 0;
const server = createServer(async (req, res) => {
  hits++;
  const url = new URL(req.url, 'http://localhost');
  let text = ''; for await (const chunk of req) text += chunk;
  const body = text ? JSON.parse(text) : null;
  res.setHeader('content-type', 'application/json');
  const done = (data, meta) => res.end(JSON.stringify({ success: true, data, ...(meta ? {meta} : {}) }));
  if (url.pathname === '/v1/contacts' && req.method === 'GET') return done(contact ? [contact] : [], { count: contact ? 1 : 0, cursor: null });
  if (url.pathname === `/v1/contacts/${encodeURIComponent(peer)}`) {
    if (req.method === 'GET' && contact) return done(contact);
    if (req.method === 'PUT') {
      if (body.if_absent && contact) { if (body.display_name === undefined || body.display_name === contact.display_name) return done(contact); res.statusCode = 409; return res.end(JSON.stringify({ success: false, error: {code:'contact_conflict',message:'Changed'} })); }
      if (body.if_version) assert.equal(body.if_version, version);
      contact = { address: peer, display_name: body.display_name ?? contact?.display_name ?? null, version, created_at: stamp, updated_at: stamp };
      return done(contact);
    }
    if (req.method === 'DELETE') { assert.equal(url.searchParams.get('if_version'),version); contact=undefined; return done({deleted:true}); }
  }
  if (url.pathname === `/v1/agent-contacts/${encodeURIComponent(agent)}` && req.method === 'GET') return done(member ? [member] : [], {count:member ? 1:0,cursor:null});
  if (url.pathname === `/v1/agent-contacts/${encodeURIComponent(agent)}/${encodeURIComponent(peer)}`) {
    if (req.method === 'PUT') {
      if (body.if_version) assert.equal(body.if_version,version);
      member={agent_address:agent,contact_address:peer,purpose:body.purpose??member?.purpose??null,notify:body.notify??member?.notify??false,notify_since:body.notify?stamp:null,notification_generation:body.notify?version:null,version,created_at:stamp,updated_at:stamp};
      return done(member);
    }
    if (req.method === 'DELETE') { assert.equal(url.searchParams.get('if_version'),version); member=undefined; return done({deleted:true}); }
  }
  res.statusCode=404; res.end(JSON.stringify({success:false,error:{code:'not_found',message:'Missing fixture'}}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}/v1`;
async function run(args, options={}) {
  const child=spawn(process.execPath,[...(options.preload?['--import',pathToFileURL(options.preload).href]:[]),binary,...args],{cwd:directory,env:{...env,...options.env},stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);
  child.stdin.end(options.stdin??'');
  const timer=setTimeout(()=>child.kill('SIGKILL'),20_000);
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve)});clearTimeout(timer);
  assert.equal(code,options.exit??0,`${args.join(' ')} failed: ${stderr}`);
  return {stdout,stderr};
}
const api=args=>run([...args,'--api-base-url',base,'--api-key',['fixture','key'].join('-')]);
try {
  for (const route of [['contacts'],['agent'],['agent','contacts'],['agent','connect'],['agent-connections','claim-agent-connection'],['listen'],...['list','get','add','update','remove','request','accept','wait'].map(x=>['contacts',x]),...['list','add','update','remove'].map(x=>['agent','contacts',x])]) await run([...route,'--help']);
  for (const route of [['contacts'],['agent'],['agent','contacts']]) { const result=await run(route);assert.match(result.stdout+result.stderr,/COMMANDS|USAGE/i); }
  const setupHelp=await run(['agent','connect','--help']);
  assert.match(setupHelp.stdout,/api\.primitive-staging-1\.com/);
  assert.match(setupHelp.stdout,/piped stdin/);
  assert.match((await run(['whoami','--help'])).stdout,/identity offline/);
  await api(['contacts','add',peer,'--name','Peer','--json']);
  await api(['contacts','list','--json']);
  assert.equal(JSON.parse((await api(['contacts','get',peer,'--json'])).stdout).address,peer);
  const defaultContact=await api(['contacts','get',peer]);
  assert.deepEqual(JSON.parse(defaultContact.stdout),JSON.parse((await api(['contacts','get',peer,'--json'])).stdout),'explicit JSON preserves the default output');
  await api(['contacts','update',peer,'--name','Renamed','--json']);
  await api(['agent','contacts','add',peer,'--agent',agent,'--notify','--json']);
  assert.equal(contact.display_name,'Renamed');assert.equal(member.notify,true);
  await api(['agent','contacts','list','--agent',agent,'--json']);
  await api(['agent','contacts','update',peer,'--agent',agent,'--no-notify','--json']);assert.equal(member.notify,false);
  await api(['agent','contacts','remove',peer,'--agent',agent,'--json']);
  await api(['contacts','remove',peer,'--json']);assert.equal(contact,undefined);assert.equal(member,undefined);
  const session=version;
  for(const args of [['--contact-requests'],['--notify-session',session,'--contact-requests'],['--notify-session',session,'--contacts','--contact-requests','--sender',peer],['--notify-session',session,'--contacts','--sender',peer],['--notify-session',session,'--contacts','--status']]) await run(['listen',...args],{exit:2});
  const token=['inert','invitation','x'.repeat(48)].join('_');
  const credential=['pconn','x'.repeat(48)].join('_');
  const preload=join(directory,'claim-fixture.mjs');
  await writeFile(preload,`globalThis.fetch=async(input,options)=>{if(String(input)!=='https://api.primitive.dev/v1/agent-connections/claim'||options.method!=='POST')throw new Error('Unexpected network');return Response.json(${JSON.stringify({success:true,data:{org_id:version,api_base_url:'https://api.primitive.dev/v1',api_key:credential,owner_address:'owner@example.test',connection:{address:agent,owner_address:'owner@example.test',status:'claimed'}}})});};`,{mode:0o600});
  const before=hits;
  const claim=await run(['agent','connect','--profile','work','--json'],{preload,stdin:JSON.stringify({token})});
  assert.equal(JSON.parse(claim.stdout).status,'claimed');assert.ok(!(claim.stdout+claim.stderr).includes(token)&&!(claim.stdout+claim.stderr).includes(credential));
  const deny=join(directory,'deny-network.mjs');
  await writeFile(deny,`globalThis.fetch=async()=>{throw new Error('Unexpected network');};`,{mode:0o600});
  const status=await run(['agent','connect','--profile','work','--status','--json'],{preload:deny});assert.equal(JSON.parse(status.stdout).status,'configured');
  const identity=await run(['whoami','--json'],{preload:deny,env:{PRIMITIVE_AGENT_PROFILE:'work'}});
  assert.equal(JSON.parse(identity.stdout).verification,'offline');
  assert.equal(JSON.parse(identity.stdout).identity.agentAddress,agent);
  assert.match(JSON.parse(identity.stdout).status_command,/agent connect --profile work --status --json/);
  for (const args of [
    ['agent','connect','--profile','work','--resume'],
    ['agent','connect','--profile','work','--receiver','external'],
    ['agent','connect','--profile','work','--session',session,'--receiver','unsupported'],
    ['agent','connect','--profile','work','--contact-requests'],
    ['agent','connect','--profile','work','--status','--session',session],
    ['listen','--email-id',session],
  ]) await run(args,{exit:2});
  await run(['listen','--once','--wake','--hook-session','--events','email.received'],{exit:1});
  const unusedHook=await run(['listen','--once','--wake','--hook-session','--events','email.received','--timeout','1'],{preload:deny,stdin:JSON.stringify({session_id:session})});
  assert.equal(unusedHook.stdout+unusedHook.stderr,'','an unpaired Claude session must not be woken or emit mail');
  const otherRuntimeHook=await run(['listen','--once','--wake','--hook-session','--events','email.received','--timeout','1'],{preload:deny,stdin:JSON.stringify({thread_id:session})});
  assert.equal(otherRuntimeHook.stdout+otherRuntimeHook.stderr,'','a different runtime hook must be ignored');
  const corruptHookProfile=join(config,'agent-connections','profiles',`session-${session}`);
  await mkdir(corruptHookProfile,{recursive:true,mode:0o700});
  await writeFile(join(corruptHookProfile,'setup.json'),'not-json',{mode:0o600});
  const corruptHook=await run(['listen','--once','--wake','--hook-session','--events','email.received','--timeout','1'],{preload:deny,stdin:JSON.stringify({session_id:session}),exit:1});
  assert.match(corruptHook.stderr,/setup state is unreadable/);
  const updatedSetupHelp=await run(['agent','connect','--help']);
  for(const flag of ['--session','--receiver','--resume','--contact-requests']) assert.ok(updatedSetupHelp.stdout.includes(flag));
  const diagnosticsHelp=await run(['listen','--help']);
  assert.ok(diagnosticsHelp.stdout.includes('--email-id'));
  assert.ok(diagnosticsHelp.stdout.includes('--json'));
  assert.ok(diagnosticsHelp.stdout.includes('--wake'));
  assert.ok(diagnosticsHelp.stdout.includes('--hook-session'));

  assert.ok(!identity.stdout.includes(credential));
  const humanIdentity=await run(['whoami'],{preload:deny,env:{PRIMITIVE_AGENT_PROFILE:'work'}});
  assert.match(humanIdentity.stdout,/not verified/);
  const doctor=await run(['doctor'],{preload:deny,env:{PRIMITIVE_AGENT_PROFILE:'work'}});
  assert.match(doctor.stdout,/offline/);assert.match(doctor.stdout,/whoami --json/);assert.ok(!doctor.stdout.includes('signin'));assert.ok(!doctor.stdout.includes(credential));
  const rawIdentity=await run(['whoami'],{preload:deny,env:{PRIMITIVE_API_KEY:credential},exit:1});
  assert.match(rawIdentity.stderr,/PRIMITIVE_AGENT_PROFILE/);
  await writeFile(join(config,'config.json'),JSON.stringify({version:1,current_environment:'staging',environments:{staging:{}}}));
  const notification=await run(['listen','--status','--notify-session',session],{preload:deny,env:{PRIMITIVE_AGENT_PROFILE:'work',PRIMITIVE_API_HEADERS:'invalid ambient JSON'}});assert.deepEqual(JSON.parse(notification.stdout).receipts,[]);assert.ok(!notification.stdout.includes(credential));
  const explicitNotification=await run(['listen','--status','--notify-session',session,'--json'],{preload:deny,env:{PRIMITIVE_AGENT_PROFILE:'work',PRIMITIVE_API_HEADERS:'invalid ambient JSON'}});
  assert.deepEqual(JSON.parse(explicitNotification.stdout),JSON.parse(notification.stdout),'explicit JSON preserves listener status shape');
  assert.ok(!(explicitNotification.stdout+explicitNotification.stderr).includes(credential));
  const rejected=await run(['agent-connections','claim-agent-connection','--profile','other','--token',token],{preload:deny,exit:2});
  assert.ok(!(rejected.stdout+rejected.stderr).includes(token)&&!(rejected.stdout+rejected.stderr).includes(credential));
  assert.equal(hits,before);
  const profile=JSON.parse(await readFile(join(config,'agent-connections','profiles','work','connection.json'),'utf8'));assert.equal(profile.api_key,credential);
  console.log('Built CLI: explicit/default JSON contact commands, bare parents, private stdin claim, offline profile/status and explicit JSON listener status, secret-safe claim alias, and contact notification flag conflicts pass. No external network or real email.');
} finally {await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
