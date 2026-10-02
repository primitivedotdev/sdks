#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ORIGIN = 'https://api.primitive.dev';
const API = `${ORIGIN}/v1`;

export class PrimitiveApiError extends Error {
  constructor(status, code) {
    status = Number.isInteger(status) && status >= 100 && status <= 599 ? status : undefined;
    const safeCode = typeof code === 'string' && /^[a-z_]{1,80}$/.test(code) ? code : undefined;
    super(`Primitive returned HTTP ${status ?? 'unknown'}${safeCode ? ` (${safeCode})` : ''}.${status === 401 ? ' Stop and ask the owner for a fresh invitation.' : ''}`);
    this.status = status;
    this.code = safeCode;
  }
}

function fail(message) { throw new Error(message); }
function json(text) {
  try { return JSON.parse(text); }
  catch { fail('Invalid JSON. Inspect private state without printing credentials.'); }
}
async function optionalFile(path) {
  try { return await readFile(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function writePrivate(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await file.sync();
    await file.close();
    await rename(temporary, path);
  } finally {
    await file.close();
    await rm(temporary, { force: true });
  }
}
function invitationToken(instruction) {
  const matches = instruction.match(/https:\/\/api\.primitive\.dev\/v1\/agent-connections\/setup[^\s<>"']*/g);
  if (matches?.length !== 1) fail('Supply one owner-provided setup URL or copied instruction on stdin.');
  const url = new URL(matches[0]);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const token = fragment.get('token');
  if (url.origin !== ORIGIN || url.pathname !== '/v1/agent-connections/setup' || url.search ||
      url.username || url.password || fragment.size !== 1 || !token || /\s/.test(token)) {
    fail('Invalid setup URL. Get a fresh instruction from the owner app.');
  }
  return token;
}
function validateState(value) {
  if (!value || typeof value.api_key !== 'string' || !value.api_key ||
      value.api_base_url !== API || typeof value.org_id !== 'string' || !value.org_id ||
      typeof value.owner_address !== 'string' || !value.owner_address.includes('@') ||
      typeof value.connection?.address !== 'string' || !value.connection.address.includes('@')) {
    fail('Invalid connection credential response. Get a fresh owner invitation if claiming failed.');
  }
  return value;
}
function summary(state) {
  return {
    address: state.connection.address,
    // Send reports and questions here: the owner's personal mailbox. Null when
    // there is none or the server does not report it yet.
    owner_member_address: typeof state.owner_member_address === 'string' ? state.owner_member_address : null,
    owner_address: state.owner_address,
    org_id: state.org_id,
    credential_saved: true,
    verification: 'Confirm with the owner app after replying using this credential.',
  };
}
async function call(fetcher, url, options) {
  let response;
  try { response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(35000) }); }
  catch { fail('Request outcome is unknown. Do not blindly retry a claim or send; reconcile or obtain a fresh invitation.'); }
  let envelope;
  try { envelope = await response.json(); }
  catch { fail('Unreadable API response. A mutation may have succeeded; do not blindly retry it.'); }
  if (!response.ok || envelope.success === false) {
    throw new PrimitiveApiError(response.status, envelope?.error?.code);
  }
  return envelope;
}

export async function run(args, { input = '', directory, fetcher = fetch } = {}) {
  const stateDir = directory ?? process.env.PRIMITIVE_AGENT_STATE_DIR ?? join(homedir(), '.local', 'state', 'primitive-connect');
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  await chmod(stateDir, 0o700);
  const statePath = join(stateDir, 'connection.json');
  const [command, method, path, idempotencyKey] = args;
  if (command === 'claim') {
    if (args.length !== 1) fail('Pass the setup instruction on stdin, never as a command argument.');
    const token = invitationToken(input);
    const digest = createHash('sha256').update(token).digest('hex');
    const lockPath = join(stateDir, 'claim.lock');
    try { await mkdir(lockPath, { mode: 0o700 }); }
    catch (error) {
      if (error.code === 'EEXIST') fail('A claim is running or was interrupted. Check that process before removing the private claim.lock directory.');
      throw error;
    }
    try {
      const previousText = await optionalFile(statePath);
      const previous = previousText ? validateState(json(previousText)) : null;
      if (previous?.invitation_sha256 === digest) return summary(previous);
      const pendingPath = join(stateDir, 'pending-claim.json');
      const pending = await optionalFile(pendingPath);
      if (pending && json(pending).invitation_sha256 === digest) {
        fail('This invitation was already attempted. Its one-time response may be lost; ask the owner for a fresh invitation.');
      }
      await writePrivate(pendingPath, { invitation_sha256: digest, attempted_at: new Date().toISOString() });
      const envelope = await call(fetcher, `${API}/agent-connections/claim`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token }),
      });
      const state = validateState(envelope.data);
      if (previous && (previous.org_id !== state.org_id || previous.connection.address !== state.connection.address ||
          previous.owner_address !== state.owner_address)) {
        fail('The invitation changes the saved identity or owner. Existing state was preserved. Confirm the intended identity with the owner.');
      }
      await writePrivate(statePath, { ...state, invitation_sha256: digest });
      await rm(pendingPath, { force: true });
      return summary(state);
    } finally { await rm(lockPath, { recursive: true, force: true }); }
  }
  const saved = await optionalFile(statePath);
  if (!saved) fail('No saved connection. Claim the owner-provided setup instruction first.');
  const state = validateState(json(saved));
  if (command === 'status' && args.length === 1) return summary(state);
  if (command !== 'request' || !method || !path || args.length > 4) {
    fail('Usage: connection.mjs claim | status | request METHOD /path [idempotency-key]. JSON bodies come from stdin.');
  }
  const url = new URL(`${API}${path}`);
  if (!url.pathname.startsWith('/v1/')) fail('This helper supports only the documented address-scoped email and notes paths.');
  const pathname = url.pathname.slice('/v1'.length);
  let ownNote = false;
  if (method === 'PUT') {
    const parts = pathname.split('/');
    if (parts.length === 4 && parts[1] === 'address-notes') {
      let address, name;
      try { address = decodeURIComponent(parts[2]); name = decodeURIComponent(parts[3]); }
      catch { fail('Invalid address-note path encoding.'); }
      ownNote = address === state.connection.address && Boolean(name) && !name.includes('/');
      if (ownNote) url.pathname = `/v1/address-notes/${encodeURIComponent(address)}/${encodeURIComponent(name)}`;
    }
  }
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const conversationRead = method === 'GET' && !url.search && (
    new RegExp(`^/threads/${uuid}$`, 'i').test(pathname) ||
    new RegExp(`^/emails/${uuid}/conversation$`, 'i').test(pathname)
  );
  const allowed = url.pathname.startsWith('/v1/') && url.origin === ORIGIN && !url.hash && !url.username && !url.password && path.startsWith('/') && (
    (method === 'GET' && (/^\/(emails|sent-emails)(\/[^/]+)?$/.test(pathname) || pathname === '/address-notes' ||
      (pathname === '/agent-connections/me' && !url.search))) ||
    conversationRead ||
    (method === 'POST' && pathname === '/send-mail') ||
    (method === 'PUT' && ownNote)
  );
  if (!allowed) fail('This helper supports only the documented address-scoped email, thread and notes paths.');
  const headers = { Authorization: `Bearer ${state.api_key}`, Accept: 'application/json' };
  let body;
  if (method !== 'GET') {
    body = json(input);
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Expected a JSON object on stdin.');
    if (method === 'POST') {
      if (!idempotencyKey || /[\r\n]/.test(idempotencyKey)) fail('Provide a stable idempotency key for sending.');
      if (body.from && body.from !== state.connection.address) fail('The sender must match the saved connection address.');
      body.from = state.connection.address;
      headers['Idempotency-Key'] = idempotencyKey;
    }
    headers['Content-Type'] = 'application/json';
  }
  return call(fetcher, url.href, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    const needsInput = args[0] === 'claim' || (args[0] === 'request' && args[1] !== 'GET');
    let input = '';
    if (needsInput) {
      for await (const chunk of process.stdin) {
        input += chunk;
        if (input.length > 1024 * 1024) fail('Input is too large.');
      }
    }
    console.log(JSON.stringify(await run(args, { input }), null, 2));
  } catch (error) {
    // Never print response bodies, request bodies, URLs, or raw runtime exceptions.
    const known = error instanceof PrimitiveApiError || (error instanceof Error && error.constructor === Error);
    console.error(known ? error.message : 'Local connection operation failed. Check private storage and permissions.');
    process.exitCode = 1;
  }
}
