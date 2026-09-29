import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';

// Packaged commands, real local HTTP/WebSocket, inert credentials, no real email.
const binary = resolve(process.argv[2] ?? 'cli-node/bin/run.js');
const root = await mkdtemp(join(tmpdir(), 'primitive-contact-controls-'));
const config = join(root, 'config'); await mkdir(config, { mode: 0o700 });
const agent = 'agent@sender.example', peer = 'agent@neutral.primitive-staging.email';
const org = randomUUID(), endpoint = randomUUID(), version = randomUUID();
const credential = ['pconn', 'x'.repeat(48)].join('_');
const old = '2026-01-01T00:00:00.000Z';
const sends = new Map(), emails = new Map(), parts = new Map(), failures = [];
let member, directoryContact, posts = 0, replies = 0, authenticated = 0;
let automaticAcceptance = true, loseNextResponse = false;
let searchFailureStatus = 0, searchAttempts = 0;
let directoryFailureStatus = 0, directoryAttempts = 0;
let attachmentFailuresRemaining = 2;
function envelope(step, parent) {
  return { interaction_version: 1, interaction_id: parent?.interaction_id ?? `${randomUUID()}@peer.example`, protocol: 'primitive.contact', protocol_version: 1,
    step, step_id: randomUUID(), prev_step_id: parent?.step_id ?? null, expires_at: parent?.expires_at ?? new Date(Date.now() + 86400000).toISOString(), payload: step === 'request' ? { reason: 'Public research coordination' } : {} };
}
function inbound(control, parent = null) {
  const id = randomUUID(), bytes = Buffer.from(JSON.stringify(control));
  const detail = { id, from_email: peer, from_header: peer, recipient: agent, to_email: agent, status: 'completed', message_id: `<${id}@peer.example>`,
    received_at: new Date().toISOString(), body_text: 'Contact correspondence', body_html: null, reply_to_sent_email_id: parent,
    parsed: { status: 'complete', attachments: [{ filename: 'interaction.json', content_type: 'application/json', part_index: 0, size_bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }] },
    auth: { spf: 'pass', dmarc: 'pass', dmarcFromDomain: 'primitive-staging.email', dmarcSpfAligned: true, dmarcDkimAligned: true,
      dkimSignatures: [{ domain: 'primitive-staging.email', selector: 'default', result: 'pass', aligned: true, keyBits: 2048, algo: 'rsa-sha256' }] } };
  emails.set(id, detail); parts.set(id, bytes); return detail;
}
function sent() {
  const row = { id: randomUUID(), from: agent, from_address: agent, from_header: agent, to_address: peer, to_header: peer, subject: 'Contact', status: 'delivered', delivery_status: 'delivered', accepted: [peer], rejected: [], idempotent_replay: false, request_id: randomUUID(), queue_id: null };
  sends.set(row.id, row); return row;
}
function json(res, data, meta) { res.setHeader('content-type','application/json'); res.end(JSON.stringify({ success:true, data, ...(meta ? { meta } : {}) })); }
const server = createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://localhost'); let raw=''; for await (const chunk of req) raw+=chunk;
    const body = raw ? JSON.parse(raw) : null;
    if (url.pathname === '/v1/agent-connections/claim') return json(res,{ org_id:org, api_base_url:'https://api.primitive.dev/v1', api_key:credential, owner_address:'owner@sender.example', connection:{ address:agent, owner_address:'owner@sender.example',status:'claimed' } });
    assert.equal(req.headers.authorization,`Bearer ${credential}`);
    if (url.pathname === '/v1/endpoints' && req.method === 'POST') return json(res,{ id:endpoint,name:body.name,kind:'pull',enabled:true,recipient:agent,rules:{event_types:['email.received']},receiver_capabilities:{completion_modes:['sdk'],stream_protocols:['primitive.events.v1']} });
    if (url.pathname === '/v1/send-mail' && req.method === 'POST') {
      assert.ok(authenticated > 0,'subscribe before sending'); assert.equal(body.from,agent); assert.equal(body.to,peer);
      if(!body.attachments?.length){
        assert.match(req.headers['idempotency-key'],/^primitive-chat-/);posts++;const row=sent();
        const answer=inbound(envelope('accept'),row.id);answer.parsed.attachments=[];answer.body_text='Ordinary reply';
        return json(res,row);
      }
      assert.match(req.headers['idempotency-key'],/^contact-/);
      assert.equal(directoryContact?.address,peer,'requested contact is saved before sending');
      const control=JSON.parse(Buffer.from(body.attachments[0].content_base64,'base64').toString()); assert.equal(control.protocol,'primitive.contact'); assert.equal(control.step,'request');
      posts++; const row=sent(); row.control=control; row.client_idempotency_key=req.headers["idempotency-key"];
      if(automaticAcceptance) inbound(envelope('accept',control),row.id);
      if(loseNextResponse){loseNextResponse=false;res.destroy();return;}
      return json(res,row);
    }
    if(url.pathname==='/v1/sent-emails'){assert.equal(url.searchParams.get("limit"),"2");const key=url.searchParams.get("idempotency_key");assert.ok(key);return json(res,[...sends.values()].filter(row=>row.client_idempotency_key===key),{cursor:null});}
    if (url.pathname === '/v1/emails/search') {
      searchAttempts++;
      if (searchFailureStatus) {
        res.statusCode = searchFailureStatus;
        res.setHeader('content-type', 'application/json');
        res.setHeader('Retry-After', searchFailureStatus === 429 ? '32' : 'private-search-header');
        return res.end(JSON.stringify({ error: { message: 'private-search-response' } }));
      }
      assert.equal(url.searchParams.get('from'),peer); assert.equal(url.searchParams.get('to'),agent);
      const parent=url.searchParams.get('reply_to_sent_email_id'); assert.ok(sends.has(parent),'only exact sent-parent recovery');
      return json(res,[...emails.values()].filter(e=>e.reply_to_sent_email_id===parent),{cursor:null,count:1});
    }
    const attachment = url.pathname.match(/^\/v1\/emails\/([^/]+)\/attachments\/0$/);
    if(attachment){ assert.ok(parts.has(attachment[1])); res.setHeader('content-type','application/json'); if(attachmentFailuresRemaining>0){attachmentFailuresRemaining--;res.statusCode=503;return res.end(JSON.stringify({error:'temporary_unavailability'}));} return res.end(parts.get(attachment[1])); }
    const detail=url.pathname.match(/^\/v1\/emails\/([^/]+)$/);
    if(detail){assert.ok(emails.has(detail[1]));return json(res,emails.get(detail[1]));}
    const prior=url.pathname.match(/^\/v1\/sent-emails\/([^/]+)$/);
    if(prior){assert.ok(sends.has(prior[1]));return json(res,sends.get(prior[1]));}
    if((url.pathname==='/v1/contact-policy') || (url.pathname===`/v1/agent-contact-policy/${encodeURIComponent(agent)}` && req.method==='PUT')){
      if(req.method==='PUT'){assert.ok(body.if_absent===true || typeof body.if_version==='string');assert.ok(Array.isArray(body.rules));}
      res.statusCode=403;res.setHeader('content-type','application/json');return res.end(JSON.stringify({success:false,error:{code:'forbidden',message:'Owner session required'}}));
    }
    if(url.pathname===`/v1/agent-contact-policy/${encodeURIComponent(agent)}`){
      const doc={rules:[],contact_request_since:null,contact_request_generation:null,version:null,updated_at:null};
      return json(res,{agent_address:agent,org_policy:{...doc,allow_contact_requests:false},agent_policy:{...doc,allow_contact_requests:null},effective_version:'a'.repeat(64),effective_since:old,allow_contact_requests:false,contact_request_since:null,contact_request_generation:null});
    }
    if(url.pathname===`/v1/agent-contacts/${encodeURIComponent(agent)}`) return json(res,member?[member]:[],{cursor:null,count:member?1:0});
    if(url.pathname==='/v1/contacts' && req.method==='GET') return json(res,directoryContact?[directoryContact]:[],{cursor:null});
    if(url.pathname===`/v1/contacts/${encodeURIComponent(peer)}` && req.method==='PUT'){
      directoryAttempts++;assert.deepEqual(body,{if_absent:true});
      if(directoryFailureStatus){res.statusCode=directoryFailureStatus;res.setHeader('content-type','application/json');return res.end(JSON.stringify({error:{message:'private-directory-response'}}));}
      directoryContact??={address:peer,display_name:null,version,created_at:old,updated_at:old};return json(res,directoryContact);
    }
    if(url.pathname===`/v1/agent-contacts/${encodeURIComponent(agent)}/${encodeURIComponent(peer)}` && req.method==='PUT'){
      assert.equal(body.if_absent,true); assert.equal(body.notify,true); assert.ok(directoryContact);
      member={agent_address:agent,contact_address:peer,purpose:body.purpose??null,notify:true,notify_since:old,notification_generation:version,version,created_at:old,updated_at:old};return json(res,member);
    }
    const reply=url.pathname.match(/^\/v1\/emails\/([^/]+)\/reply$/);
    if(reply && req.method==='POST'){
      assert.equal(member?.notify,true,'local preference precedes acceptance'); const original=JSON.parse(parts.get(reply[1]).toString());
      const accepted=JSON.parse(Buffer.from(body.attachments[0].content_base64,'base64').toString());
      assert.equal(accepted.step,'accept');assert.equal(accepted.prev_step_id,original.step_id);assert.equal(accepted.interaction_id,original.interaction_id);
      replies++;return json(res,sent());
    }
    throw new Error(`Unexpected fixture route ${req.method} ${url.pathname}`);
  } catch(error){failures.push(error);res.statusCode=500;json(res,{});}
});
const sockets=new WebSocketServer({server});
sockets.on('connection',socket=>{let ready=false;socket.on('message',data=>{const frame=JSON.parse(data.toString());if(frame.type==='authenticate'){ready=true;authenticated++;socket.send(JSON.stringify({type:'ready',protocol:'primitive.events.v1'}));}else assert.ok(['receive','pong'].includes(frame.type));});socket.on('close',()=>{if(ready)authenticated--;});});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const preload=join(root,'local-boundaries.mjs');
await writeFile(preload,`const realFetch=globalThis.fetch;const RealSocket=globalThis.WebSocket;const base=${JSON.stringify(base)};function local(value){const u=new URL(value);if(u.hostname!=='api.primitive.dev')throw new Error('External network forbidden');return base+u.pathname+u.search;}globalThis.fetch=async(input,init)=>{const r=new Request(input,init);return realFetch(local(r.url),{method:r.method,headers:r.headers,body:r.body,signal:r.signal,duplex:'half',redirect:'error'});};globalThis.WebSocket=class extends RealSocket{constructor(url,protocol){super(local(url).replace('http:','ws:'),protocol);}};`,{mode:0o600});
const env={...process.env,PRIMITIVE_CONFIG_DIR:config,XDG_CONFIG_HOME:config,PRIMITIVE_SKIP_NEW_VERSION_CHECK:'1',NO_COLOR:'1'};
for(const name of Object.keys(env))if((name.startsWith('PRIMITIVE_')&&!['PRIMITIVE_CONFIG_DIR','PRIMITIVE_SKIP_NEW_VERSION_CHECK'].includes(name))||/proxy/i.test(name))delete env[name];
for(const name of ['CODEX_SESSION_ID','CODEX_THREAD_ID','CLAUDE_CODE_SESSION_ID'])delete env[name];
async function run(args,{code=0,stdin='',profile=true,errorPattern,extraEnv={}}={}){
  const selectedProfile=profile===true?'smoke':profile;
  const child=spawn(process.execPath,['--import',pathToFileURL(preload).href,binary,...args],{cwd:root,env:{...env,...(selectedProfile?{PRIMITIVE_AGENT_PROFILE:selectedProfile}:{}),...extraEnv},stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.stdin.end(stdin);
  const timer=setTimeout(()=>child.kill('SIGKILL'),20000);const actual=await new Promise((res,rej)=>{child.once('error',rej);child.once('close',res);});clearTimeout(timer);
  assert.equal(actual,code,`${args.slice(0,2).join(' ')} failed: ${stderr}`);assert.ok(!stdout.includes(credential)&&!stderr.includes(credential));assert.ok(!/private-(?:search-(?:response|header)|directory-response)/.test(stdout+stderr),'diagnostics must not expose server content');if(failures.length)throw failures[0];if(errorPattern)assert.match(stderr.replace(/^[\t ]*›[\t ]*/gm,'').replace(/\s+/g,' '),errorPattern);return stdout.trim() ? JSON.parse(stdout) : null;
}
try{
  await run(['agent','connect','--profile','smoke','--json'],{profile:false,stdin:JSON.stringify({token:['inert','invite','x'.repeat(48)].join('_')})});
  await run(['contacts','get-agent-contact-policy','--agent-address',agent]);
  await run(['contacts','get-contact-policy'],{code:1});
  const policyFile=join(root,'policy.json');await writeFile(policyFile,JSON.stringify({if_absent:true,rules:[{pattern:'*@peer.example',effect:'allow'}],allow_contact_requests:true}));
  await run(['contacts','put-contact-policy','--body-file',policyFile],{code:1});
  await run(['contacts','put-agent-contact-policy','--agent-address',agent,'--body-file',policyFile],{code:1});
  await writeFile(policyFile,JSON.stringify({if_version:version,rules:[],allow_contact_requests:null}));
  await run(['contacts','put-agent-contact-policy','--agent-address',agent,'--body-file',policyFile],{code:1});
  directoryFailureStatus=429;
  await run(['contacts','request',peer,'--reason','Directory failure fixture','--wait','--timeout','5','--json'],{code:1,errorPattern:/No contact email was sent/});
  assert.equal(posts,0,'directory failure cannot submit email');assert.equal(directoryAttempts,1,'directory failure is not automatically retried');assert.equal(member,undefined);
  directoryFailureStatus=0;
  const accepted=await run(['contacts','request',peer,'--reason','Public research coordination','--wait','--timeout','5','--json']);assert.equal(accepted.contact_accepted,true);assert.equal(posts,1);assert.equal(member,undefined,'waiting alone grants no future notification permission');
  assert.equal(attachmentFailuresRemaining,0,'temporary attachment failures retry within the same wait');
  const directory=await run(['contacts','list','--json']);assert.equal(directory.data.length,1);assert.equal(directory.data[0].address,peer);
  const memberships=await run(['agent','contacts','list','--json']);assert.deepEqual(memberships.data,[],'saving a requested address must not create a notification preference');
  directoryContact.display_name='Existing owner label';const directoryVersion=directoryContact.version;
  automaticAcceptance=false;
  const pending=await run(['contacts','request',peer,'--reason','A second independent relationship check','--json']);assert.equal(pending.contact_accepted,false);assert.match(pending.next_command,/contacts wait --id/);assert.equal(posts,2);
  assert.equal(directoryContact.display_name,'Existing owner label');assert.equal(directoryContact.version,directoryVersion,'address-only ensure must preserve an existing contact');
  const directoryWritesBeforeWait=directoryAttempts;
  await run(['contacts','wait','--id',pending.sent_id,'--timeout','1','--json'],{code:3});
  inbound(envelope('accept',sends.get(pending.sent_id).control),pending.sent_id);
  const resumed=await run(['contacts','wait','--id',pending.sent_id,'--timeout','5','--json']);assert.equal(resumed.contact_accepted,true);assert.equal(posts,2,'resume must not resend');
  const repeated=await run(['contacts','wait','--id',pending.sent_id,'--timeout','1','--json']);assert.equal(repeated.contact_accepted,true);
  assert.equal(directoryAttempts,directoryWritesBeforeWait,'resuming a wait must not write contacts');
  automaticAcceptance=true;loseNextResponse=true;
  const uncertain=await run(['contacts','request',peer,'--reason','Recover exact lost response','--json'],{code:4});
  assert.match(uncertain.next_command,/contacts wait --request-id/);const sendsBeforeRecovery=posts;
  const recovered=await run(['contacts','wait','--request-id',uncertain.request_id,'--timeout','5','--json']);
  assert.equal(recovered.contact_accepted,true);assert.equal(posts,sendsBeforeRecovery,'uncertain recovery must never resend');
  const request=inbound(envelope('request'));
  const local=await run(['contacts','accept','--id',request.id,'--json']);assert.equal(local.local_preference_saved,true);assert.equal(local.acceptance_sent,true);assert.ok(!Object.hasOwn(local,'contact_accepted'));assert.equal(replies,1);
  const localAgain=await run(['contacts','accept','--id',request.id,'--json']);assert.equal(localAgain.outcome,'already_sent');assert.equal(localAgain.acceptance_sent,true);assert.ok(!Object.hasOwn(localAgain,'contact_accepted'));assert.equal(replies,1,'repeated acceptance must not send twice');
  member={...member,notify:false,notify_since:null,notification_generation:null};
  await run(['contacts','accept','--id',inbound(envelope('request')).id,'--json'],{code:1});assert.equal(replies,1,'explicit silence cannot be overwritten');
  const unauthenticated=inbound(envelope('request'));unauthenticated.auth.dmarc='fail';
  await run(['contacts','accept','--id',unauthenticated.id,'--json'],{code:1,errorPattern:/reason:\s+auth-suspicious;\s+retryable: false/});
  const transient=inbound(envelope('request'));transient.auth.dmarc='temperror';
  await run(['contacts','accept','--id',transient.id,'--json'],{code:1,errorPattern:/reason: dmarc-temperror; retryable: true/});
  assert.equal(replies,1,'authentication failures cannot send acceptance');
  const beforeChat=posts;
  await run(['chat',peer,'hello','--from','another@sender.example','--json'],{code:1,errorPattern:/pinned address/});
  assert.equal(posts,beforeChat,'pinned sender mismatch cannot send');
  const chat=await run(['chat',peer,'hello','--json','--timeout','5']);
  assert.equal(chat.outcome,'replied');assert.equal(chat.reply.body_text,'Ordinary reply');assert.equal(posts,beforeChat+1);
  automaticAcceptance=false;
  for (const [status, errorPattern] of [
    [429, /rate limited.*Retry after 32 seconds/],
    [403, /access was denied.*HTTP 403/],
    [404, /unavailable on this API endpoint.*HTTP 404/],
    [503, /temporarily unavailable.*HTTP 503/],
  ]) {
    searchFailureStatus=status;
    const sendsBefore=posts, searchesBefore=searchAttempts;
    const failedWait=await run(['contacts','request',peer,'--reason','Diagnostic recovery fixture','--wait','--timeout','5','--json'],{code:3});
    assert.equal(failedWait.outcome,'sent_awaiting_reply');
    assert.equal(failedWait.contact_accepted,false);
    assert.equal(posts,sendsBefore+1,'request wait must send only once');
    assert.equal(searchAttempts,searchesBefore+1,'failed search must not retry');
    await run(['contacts','wait','--id',failedWait.sent_id,'--timeout','5','--json'],{code:1,errorPattern});
    await run(['contacts','wait','--request-id',failedWait.request_id,'--timeout','5','--json'],{code:1,errorPattern});
    assert.equal(posts,sendsBefore+1,'both resume command forms must never resend');
    assert.equal(searchAttempts,searchesBefore+3,'each resume performs one targeted search');
  }
  searchFailureStatus=0;
  const session=randomUUID(), sessionProfile=`session-${session}`;
  await run(['agent','connect','--profile',sessionProfile,'--json'],{profile:false,stdin:JSON.stringify({token:['inert','invite',randomUUID()].join('_')})});
  const savedProfile=JSON.parse(await readFile(join(config,'agent-connections','profiles',sessionProfile,'connection.json'),'utf8'));
  await writeFile(join(config,'agent-connections','profiles',sessionProfile,'setup.json'),JSON.stringify({
    version:1,session,receiverMode:'external',invitationHash:savedProfile.invitation_hash,
    since:new Date().toISOString(),contactRequests:true,challenge:null,phase:'sent',
    receipt:{id:randomUUID(),status:'delivered'},
  }),{mode:0o600});
  automaticAcceptance=true;
  const bound=await run(['contacts','request',peer,'--reason','Exact session notification fixture','--json'],{profile:sessionProfile});
  assert.equal(bound.contact_accepted,false);
  const searchesBeforeWrongSession=searchAttempts, sendsBeforeWrongSession=posts;
  await run(['contacts','wait','--id',bound.sent_id,'--timeout','5','--json'],{
    profile:sessionProfile,extraEnv:{CLAUDE_CODE_SESSION_ID:randomUUID()},code:1,
    errorPattern:/exact coding session|unbound session/,
  });
  assert.equal(searchAttempts,searchesBeforeWrongSession,'another session cannot inspect acceptance');
  assert.equal(posts,sendsBeforeWrongSession,'another session cannot resend a request');
  const boundAcceptance=await run(['contacts','wait','--id',bound.sent_id,'--timeout','5','--json'],{profile:sessionProfile});
  assert.equal(boundAcceptance.contact_accepted,true,'verified external setup recovers the exact request without ambient session variables');
  assert.deepEqual(failures,[]);
  console.log('Built contact commands with explicit --json: bare connected profile request/manual wait, verified external session binding, timeout and restart recovery, correlated acceptance, no duplicate sends, and explicit silence passed. Local fixtures only.');
}finally{for(const socket of sockets.clients)socket.terminate();await new Promise(r=>sockets.close(r));server.closeAllConnections();await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
