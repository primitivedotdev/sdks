import assert from "node:assert/strict";
import { scopedMailFixture } from "./scoped-mail-smoke-fixture.mjs";
const f=await scopedMailFixture(process.argv[2]);
const args=parent=>["emails","wait","--reply-to-sent-email-id",parent.id,"--from",f.peer,"--timeout","2"];
try {
  const parent=await f.run(["emails"]);assert.equal(parent.code,0,parent.stderr);assert.match(parent.stdout+parent.stderr,/emails wait/);
  const help=await f.run(["emails","wait","--help"]);assert.equal(help.code,0);assert.match(help.stdout,/never scan inbox history/);
  const bare=await f.run(["emails","wait"]);assert.equal(bare.code,1);assert.match(bare.stderr,/require --reply-to-sent-email-id/);assert.equal(f.requests.length,0);
  for(const extra of [[],["--to",f.owner],["--table"]]){
    const sent=f.sent(),reply=f.inbound(sent.id,{created_at:"2026-01-01T00:00:00Z",received_at:"2026-02-01T00:00:00Z"});f.emails.set(reply.id,reply);
    const result=await f.run([...args(sent),...extra]);assert.equal(result.code,0,result.stderr);
    if(extra.includes("--table"))assert.match(result.stdout,new RegExp(reply.id));else assert.equal(JSON.parse(result.stdout).id,reply.id);
  }
  const sent=f.sent(),wait=f.invoke(args(sent));await f.until(()=>f.searched.has(sent.id),"Exact-parent recovery must precede pushed reply");
  const progress=f.inbound(sent.id,{parsed:{status:"complete",attachments:[{filename:"interaction.json",size_bytes:10}]}});f.push(progress);
  const reply=f.inbound(sent.id);f.push(reply);await wait.closed;
  assert.equal(wait.code,0,wait.stderr);assert.equal(JSON.parse(wait.stdout).id,reply.id);assert.match(wait.stderr,/interaction attachment/);
  const filtered=f.sent(),old=f.inbound(filtered.id,{created_at:"2026-01-01T00:00:00Z",received_at:"2026-01-01T00:00:00Z"});f.emails.set(old.id,old);
  const excluded=await f.run([...args(filtered),"--since","2026-02-01"]);assert.equal(excluded.code,1);assert.equal(excluded.stdout,"");
  const later=f.inbound(filtered.id,{created_at:"2026-01-01T00:00:00Z",received_at:"2026-02-01T00:00:00Z"});f.emails.set(later.id,later);
  const recovered=await f.run([...args(filtered),"--since","2026-02-01"]);assert.equal(recovered.code,0,recovered.stderr);assert.equal(JSON.parse(recovered.stdout).id,later.id);
  const stalled=f.sent();f.stall(`/v1/sent-emails/${stalled.id}`);const start=Date.now(),timed=await f.run(args(stalled));
  assert.equal(timed.code,1,timed.stderr);assert.match(timed.stderr,/Timed out/);assert.doesNotMatch(timed.stderr,/AbortError/);assert.ok(Date.now()-start<5000);
  assert.equal(f.posts(),0);assert.equal(f.maximumStreams(),1);assert.ok(f.requests.every(request=>request.url.pathname!=="/v1/emails"));assert.deepEqual(f.failures,[]);
  console.log("Scoped emails wait packaged smoke passed: bare parent/help, existing and pushed exact replies, received cutoff, resume, deadline, zero inbox scans.");
} finally {await f.close();}
