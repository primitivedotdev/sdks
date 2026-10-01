#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareSignalEmail, sendPreparedSignal } from '@primitivedotdev/sdk/interactions';
import { PrimitiveApiError, run as connection } from './connection.mjs';

export const commands = Object.freeze({
  send: 'send OPERATION_ID < message.json    {"to":"...","subject":"...","text":"..."}',
  reply: 'reply EMAIL_ID OPERATION_ID < reply.txt',
  signal: 'signal EMAIL_ID OPERATION_ID < signal.json    {"kind":"typing"}, {"kind":"working"}, {"kind":"read"}, or {"kind":"ack","status":"received"}',
});
export const help = `Usage: mail.mjs ${Object.values(commands).join('\n       mail.mjs ')}\n\nEMAIL_ID is a received email record ID. Reuse OPERATION_ID for the same operation.\nBodies come from stdin. Signals are ordinary emails. Verify the sender before replying or reporting progress.`;
class MailError extends Error {}
function check(value, message) { if (!value) throw new MailError(message); }
function address(value) {
  check(typeof value === 'string' && value.length <= 320 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value), 'Expected a bare email address.');
  return value.toLowerCase();
}
function header(value) {
  check(typeof value === 'string' && value.trim() && Buffer.byteLength(value, 'utf8') <= 998 && !/[\x00-\x1f\x7f]/.test(value), 'Missing or invalid email threading header.');
  return value;
}
function bodyText(value) {
  check(typeof value === 'string' && value.trim() && value.length <= 100000, 'Supply a nonempty message of up to 100,000 characters.');
  return value;
}
async function read(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function save(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(value));
    await file.sync();
    await file.close();
    await rename(temporary, path);
    // Windows FlushFileBuffers requires a writable handle; directories use read handles.
    if (process.platform !== 'win32') {
      const directory = await open(dirname(path), 'r');
      try { await directory.sync(); }
      finally { await directory.close(); }
    }
  } finally {
    await file.close();
    await rm(temporary, { force: true });
  }
}
function receipt(data) {
  check(typeof data?.id === 'string' && data.id.length > 0, 'Send outcome is unknown. Reconcile using the same operation ID.');
  return { id: data.id, status: typeof data.status === 'string' ? data.status : 'accepted' };
}

/** Optional adapter: inject the runtime's existing credential transport. Never claim again. */
export function createMailer({ identity, request, directory, now = Date.now, uuid = randomUUID }) {
  const own = address(identity.address);
  check(typeof identity.org_id === 'string' && identity.org_id, 'Pin the organization from the connection claim.');
  check(typeof directory === 'string' && directory, 'Choose private durable outbox storage.');
  const scope = { address: own, org_id: identity.org_id };
  async function parent(id, signalOnly = false) {
    check(typeof id === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(id), 'Supply a received email record ID.');
    const message = (await request('GET', `/emails/${encodeURIComponent(id)}`)).data;
    check(address(message.recipient) === own && address(message.from_email) !== own, 'The parent must be incoming mail addressed to this agent.');
    if (signalOnly) {
      const parts = message.parsed?.attachments ?? message.attachments;
      check(Array.isArray(parts), 'Inspect the parent attachment inventory before reporting progress.');
      check(!parts.some(part => part.filename?.toLowerCase() === 'interaction.json'), 'Do not automatically report progress on interaction emails.');
    }
    const references = message.references ?? message.parsed?.references ?? [];
    check(Array.isArray(references), 'Invalid parent references.');
    return {
      accountScope: identity.org_id, from: address(message.from_email), to: own,
      messageId: header(message.message_id), subject: header(message.subject || 'Conversation'),
      references: references.map(header),
    };
  }
  async function operation(id, intent, prepare) {
    check(typeof id === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(id), 'Use a stable operation ID of up to 128 letters, digits, colons, underscores, or hyphens.');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    const hash = createHash('sha256').update(JSON.stringify([scope, id])).digest('hex');
    const path = join(directory, `${hash}.json`), lock = join(directory, `${hash}.lock`);
    try { await mkdir(lock, { mode: 0o700 }); }
    catch (error) {
      if (error.code === 'EEXIST') throw new MailError('This operation is running or was interrupted. Inspect its process before removing the private lock directory.');
      throw error;
    }
    try {
      let record = await read(path);
      if (record) {
        check(JSON.stringify(record.scope) === JSON.stringify(scope) && JSON.stringify(record.intent) === JSON.stringify(intent), 'This operation ID already belongs to a different message.');
      } else {
        record = { scope, intent, prepared: await prepare(), attempted: false, receipt: null };
        await save(path, record);
      }
      if (record.receipt) return record.receipt;
      const prepared = record.prepared;
      if (record.attempted) {
        const found = (await request('GET', `/sent-emails?idempotency_key=${encodeURIComponent(prepared.idempotencyKey)}`)).data;
        const body = JSON.parse(prepared.requestJson);
        check(Array.isArray(found), 'Unable to reconcile this send. Keep its operation ID.');
        const matches = found.filter(row => row.from_address?.toLowerCase() === own && row.to_address?.toLowerCase() === body.to.toLowerCase());
        check(matches.length === 1, 'Send outcome is still unknown. Keep the same operation ID and check again; do not send a duplicate.');
        record.receipt = receipt(matches[0]);
        await save(path, record);
        return record.receipt;
      }
      if (prepared.expiresAtMs !== null && now() >= prepared.expiresAtMs)
        return { status: 'expired' };
      record.attempted = true;
      await save(path, record);
      const send = async (body, key) => {
        try { return (await request('POST', '/send-mail', body, key)).data; }
        catch (error) {
          // Only a typed send refusal proves deletion. Missing reads remain unknown.
          if (!(error instanceof PrimitiveApiError) || error.status !== 410 || error.code !== 'sent_email_deleted') throw error;
          record.receipt = { status: 'deleted' };
          await save(path, record);
          return null;
        }
      };
      const result = intent.kind === 'signal'
        ? await sendPreparedSignal(send, prepared, { accountScope: identity.org_id, now })
        : { status: 'response', result: await send(JSON.parse(prepared.requestJson), prepared.idempotencyKey) };
      if (record.receipt) return record.receipt;
      if (result.status === 'expired') {
        record.attempted = false;
        await save(path, record);
        return { status: 'expired' };
      }
      record.receipt = receipt(result.result);
      await save(path, record);
      return record.receipt;
    } finally { await rm(lock, { recursive: true, force: true }); }
  }
  const preparedMail = body => ({ accountScope: identity.org_id, expiresAtMs: null, idempotencyKey: uuid(), requestJson: JSON.stringify(body) });
  return {
    send: (id, { to, subject, text }) => operation(id, { kind: 'send', to, subject, text }, async () =>
      preparedMail({ from: own, to: address(to), subject: header(subject), body_text: bodyText(text) })),
    reply: (id, emailId, text) => operation(id, { kind: 'reply', emailId, text }, async () => {
      const p = await parent(emailId);
      return preparedMail({ from: own, to: p.from, subject: p.subject,
        body_text: bodyText(text), in_reply_to: p.messageId, references: [...new Set([...p.references, p.messageId])] });
    }),
    signal: (id, emailId, input) => operation(id, { kind: 'signal', emailId, input }, async () => {
      check(input && ['ack', 'read', 'working', 'typing'].includes(input.kind), 'Choose ack, read, working, or typing.');
      const p = await parent(emailId, true);
      const result = prepareSignalEmail({ ...input, parent: p,
        ...(['working', 'typing'].includes(input.kind) ? { expiresAtMs: now() + (input.kind === 'typing' ? 30000 : 60000) } : {}) }, { now, uuid });
      check(result.status === 'prepared', 'Wait for the parent email Message-ID before reporting progress.');
      return result.prepared;
    }),
  };
}

export async function run(args, { input = '', directory, fetcher } = {}) {
  if (!args.length || (args.length === 1 && ['help', '--help'].includes(args[0]))) return help;
  const [command, first, second] = args;
  check(Object.hasOwn(commands, command) && args.length === (command === 'send' ? 2 : 3), help);
  const root = directory ?? process.env.PRIMITIVE_AGENT_STATE_DIR ?? join(homedir(), '.local', 'state', 'primitive-connect');
  const options = { directory: root, fetcher };
  const identity = await connection(['status'], options);
  const mail = createMailer({ identity, directory: join(root, 'outbox'), request: (method, path, body, key) =>
    connection(['request', method, path, ...(key ? [key] : [])], { ...options, input: body ? JSON.stringify(body) : '' }) });
  if (command === 'reply') return mail.reply(second, first, input);
  let value;
  try { value = JSON.parse(input); } catch { throw new MailError('Supply valid JSON on stdin.'); }
  return command === 'send' ? mail.send(first, value) : mail.signal(second, first, value);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    let input = '';
    const needsInput = Object.hasOwn(commands, args[0]) && args.length === (args[0] === 'send' ? 2 : 3);
    if (needsInput) for await (const chunk of process.stdin) {
      input += chunk;
      check(input.length <= 1024 * 1024, 'Input is too large.');
    }
    const result = await run(args, { input });
    console.log(typeof result === 'string' ? result : JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof MailError ? error.message : 'Mail operation failed. Inspect private connection state and reconcile using the same operation ID.');
    process.exitCode = 1;
  }
}
