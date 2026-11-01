// THE MAILER: how the relay sends its one kind of email (the "email yourself your link" mail, relay/linkmail.js).
// One interface, three transports. Product mail never goes through Fauna's own outbox (fauna-send-email).
//   "gmail-api"  (Harry's route, 2026-10-23: no new Workspace seat) the Gmail API with a SEND-ONLY OAuth token
//                (scope https://www.googleapis.com/auth/gmail.send) for an existing Workspace user (<email>),
//                sending From hello@turnipworks.net, a verified send-as alias of that user. POST users/me/messages/send
//                with the RFC 822 message (base64url); the access token is refreshed from the refresh token as needed.
//                Credentials: a mode-600 JSON file {client_id, client_secret, refresh_token} at credentialsFile /
//                TW_GMAIL_CREDENTIALS (default /etc/turnipworks/gmail-oauth.json); a file readable by others is refused.
//   "smtp"       the alternative: SMTP to Google Workspace with STARTTLS required, smtp-relay.gmail.com:587 (the Workspace
//                SMTP relay service) or smtp.gmail.com:587 with a user + app password.
//   "outbox"     THE DEFAULT, and what any transport falls back to while its credentials are missing: nothing leaves the
//                box; each mail is written to <DATA_DIR>/linkmail/outbox/ (mode 600, the newest 200 kept, the full MIME
//                message included; not in the backups: the mails carry seat links).
//
// CONFIG (nothing secret in the checkout): <DATA_DIR>/mail-config.json (or TW_MAIL_CONFIG), each overridable by env.
// Example: engine/relay/mail-config.example.json.
//   transport  "gmail-api" | "smtp" | "outbox"                     TW_MAIL_TRANSPORT (default "outbox")
//   fromName   "Turnip Works"                                      TW_MAIL_FROM_NAME
//   from       "hello@turnipworks.net" (or "Name <addr>")          TW_MAIL_FROM
//   replyTo    "hello@turnipworks.net"                             TW_MAIL_REPLY_TO
//   allow      ["<email>"]: ONLY these recipients go out for real, the rest go to the outbox; TW_MAIL_ALLOW
//              (commas). The dev relay keeps one, so a test never mails a stranger.
//   gmail-api: credentialsFile (TW_GMAIL_CREDENTIALS), gmailUser (default "me")
//   smtp:      host (TW_SMTP_HOST), port 587 (TW_SMTP_PORT), user (TW_SMTP_USER; optional, the relay service can authorise
//              by IP), helo ("turnipworks.net"); the password never in the config file: env TW_SMTP_PASSWORD or a mode-600
//              file at passwordFile / TW_SMTP_PASSWORD_FILE (default /etc/turnipworks/smtp-password)
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';

const OUTBOX_KEEP = 200;
export const DEFAULT_PASSWORD_FILE = '/etc/turnipworks/smtp-password';
export const DEFAULT_GMAIL_CREDENTIALS = '/etc/turnipworks/gmail-oauth.json';
export const DEFAULTS = { fromName: 'Turnip Works', from: 'hello@turnipworks.net', replyTo: 'hello@turnipworks.net' };

// a secret file must be its owner's only: anything readable by group or others is refused (and said so)
function readSecret(file, log) {
  try {
    const st = fs.statSync(file);
    if (st.mode & 0o077) { log?.(`mailer: ${file} is readable by others (mode ${(st.mode & 0o777).toString(8)}): not used; chmod 600 it`); return null; }
    return fs.readFileSync(file, 'utf8');
  } catch { return null; }
}

export function loadMailConfig(dataDir, env = process.env, log = null) {
  const file = env.TW_MAIL_CONFIG || path.join(dataDir, 'mail-config.json');
  let c = {};
  try { c = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { c = {}; }
  delete c.password; delete c.refresh_token; delete c.client_secret; // secrets written into the config file are ignored on purpose
  const e = (k) => env[k] != null && env[k] !== '' ? env[k] : undefined;
  const fromRaw = e('TW_MAIL_FROM') || c.from || DEFAULTS.from, fromName = e('TW_MAIL_FROM_NAME') || c.fromName || DEFAULTS.fromName;
  const cfg = {
    transport: e('TW_MAIL_TRANSPORT') || c.transport || 'outbox',
    from: /</.test(fromRaw) ? fromRaw : `${fromName} <${fromRaw}>`, replyTo: e('TW_MAIL_REPLY_TO') || c.replyTo || DEFAULTS.replyTo,
    allow: e('TW_MAIL_ALLOW') ? e('TW_MAIL_ALLOW').split(',').map(s => s.trim()).filter(Boolean) : Array.isArray(c.allow) ? c.allow : null,
    host: e('TW_SMTP_HOST') || c.host || null, port: Number(e('TW_SMTP_PORT') || c.port || 587),
    user: e('TW_SMTP_USER') || c.user || null, helo: e('TW_SMTP_HELO') || c.helo || 'turnipworks.net',
    requireTLS: c.requireTLS !== false, file: fs.existsSync(file) ? file : null,
    gmailUser: c.gmailUser || 'me', credentialsFile: e('TW_GMAIL_CREDENTIALS') || c.credentialsFile || DEFAULT_GMAIL_CREDENTIALS,
  };
  cfg.passwordFile = e('TW_SMTP_PASSWORD_FILE') || c.passwordFile || DEFAULT_PASSWORD_FILE;
  cfg.password = e('TW_SMTP_PASSWORD') || null;
  if (cfg.transport === 'smtp' && !cfg.password && cfg.user) cfg.password = readSecret(cfg.passwordFile, log)?.trim() || null;
  cfg.gmail = null;
  if (cfg.transport === 'gmail-api') { try { const g = JSON.parse(readSecret(cfg.credentialsFile, log) || 'null'); if (g?.client_id && g?.client_secret && g?.refresh_token) cfg.gmail = { client_id: g.client_id, client_secret: g.client_secret, refresh_token: g.refresh_token }; } catch { log?.(`mailer: ${cfg.credentialsFile} is not JSON`); } }
  return cfg;
}

// ---------------- the Gmail API: a send-only token, refreshed as needed ----------------
export function makeGmailSender(gmail, { user = 'me', fetchImpl = globalThis.fetch, now = Date.now, log = () => {} } = {}) {
  let token = null, until = 0;
  async function refresh() {
    const r = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: gmail.client_id, client_secret: gmail.client_secret, refresh_token: gmail.refresh_token, grant_type: 'refresh_token' }).toString() });
    const b = await r.json().catch(() => ({}));
    if (!r.ok || !b.access_token) throw new Error(`token refresh: ${r.status} ${b.error || ''} ${b.error_description || ''}`.trim());
    token = b.access_token; until = now() + Math.max(60, Number(b.expires_in) || 3600) * 1000 - 60e3;
  }
  return async function send({ data }) {
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!token || now() >= until) await refresh();
        const r = await fetchImpl(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(user)}/messages/send`, { method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ raw: Buffer.from(data, 'utf8').toString('base64url') }) });
        if (r.status === 401 && attempt === 0) { token = null; continue; } // revoked or expired early: refresh once and retry
        const b = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, why: `gmail api ${r.status} ${b?.error?.status || ''} ${b?.error?.message || ''}`.trim().slice(0, 300) };
        return { ok: true, id: b.id || null };
      }
      return { ok: false, why: 'gmail api: still unauthorised after a refresh' };
    } catch (e) { return { ok: false, why: e.message.slice(0, 300) }; }
  };
}

// ---------------- MIME: multipart/alternative, text + html, base64 bodies (no line-length or charset surprises) ----------------
const b64lines = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n');
const encWord = (s) => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
const addrOf = (s) => (String(s).match(/<([^>]+)>/)?.[1] || String(s)).trim();
function encodeFromHeader(from) { const m = String(from).match(/^\s*(.*?)\s*<([^>]+)>\s*$/); return m ? `${encWord(m[1].replace(/"/g, ''))} <${m[2]}>` : from; }
export function buildMime({ from, to, replyTo, subject, text, html, now = Date.now }) {
  const boundary = 'tw_' + crypto.randomBytes(12).toString('hex'), domain = addrOf(from).split('@')[1] || 'turnipworks.net';
  const head = [
    `From: ${encodeFromHeader(from)}`, `To: <${to}>`, ...(replyTo ? [`Reply-To: <${addrOf(replyTo)}>`] : []),
    `Subject: ${encWord(String(subject).replace(/[\r\n]+/g, ' '))}`, `Date: ${new Date(now()).toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${crypto.randomBytes(12).toString('hex')}@${domain}>`, 'MIME-Version: 1.0', 'Auto-Submitted: auto-generated',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', b64lines(body)].join('\r\n');
  return [...head, '', part('text/plain', text), part('text/html', html || text), `--${boundary}--`, ''].join('\r\n');
}

// ---------------- a small SMTP client: EHLO, STARTTLS, EHLO, AUTH (PLAIN, else LOGIN), MAIL, RCPT, DATA, QUIT ----------------
export function smtpSend({ host, port = 587, user = null, password = null, helo = 'turnipworks.net', requireTLS = true, timeoutMs = 20000 }, { from, to, data }) {
  return new Promise((resolve) => {
    let sock = net.connect({ host, port }), buf = '', waiter = null, finished = false, log = [];
    const done = (r) => { if (finished) return; finished = true; clearTimeout(timer); try { sock.end(); sock.destroy(); } catch { } resolve({ ...r, log }); };
    const timer = setTimeout(() => done({ ok: false, why: 'the mail server did not answer in time' }), timeoutMs);
    // one reply = lines "250-…" ending with "250 …"; handed to whoever waits for it
    const parse = () => {
      if (!waiter) return;
      const lines = []; let rest = buf;
      for (;;) {
        const i = rest.indexOf('\n'); if (i < 0) return;
        const line = rest.slice(0, i).replace(/\r$/, ''); rest = rest.slice(i + 1);
        const m = line.match(/^(\d{3})([ -]?)(.*)$/); if (!m) continue;
        lines.push(m[3]);
        if (m[2] !== '-') { buf = rest; const w = waiter; waiter = null; w({ code: +m[1], lines }); return; }
      }
    };
    const onData = (d) => { buf += d.toString('utf8'); parse(); };
    const read = () => new Promise((r) => { waiter = r; parse(); });
    const cmd = async (line, hide = false) => { log.push(hide ? line.split(' ').slice(0, 2).join(' ') + ' …' : line); sock.write(line + '\r\n'); return read(); };
    const expect = (res, ok, what) => { if (!ok.includes(res.code)) throw new Error(`${what}: ${res.code} ${res.lines.join(' ').slice(0, 200)}`); return res; };
    sock.on('data', onData);
    sock.on('error', (e) => done({ ok: false, why: `mail server connection: ${e.code || e.message}` }));
    (async () => {
      expect(await read(), [220], 'greeting');
      let ehlo = expect(await cmd(`EHLO ${helo}`), [250], 'EHLO');
      const has = (r, k) => r.lines.some(l => l.toUpperCase().startsWith(k));
      if (has(ehlo, 'STARTTLS')) {
        expect(await cmd('STARTTLS'), [220], 'STARTTLS');
        sock.removeListener('data', onData);
        sock = tls.connect({ socket: sock, servername: host });
        await new Promise((r, j) => { sock.once('secureConnect', r); sock.once('error', j); });
        sock.on('data', onData); sock.on('error', (e) => done({ ok: false, why: `TLS: ${e.code || e.message}` }));
        ehlo = expect(await cmd(`EHLO ${helo}`), [250], 'EHLO after STARTTLS');
      } else if (requireTLS) throw new Error('the mail server does not offer STARTTLS: refused');
      if (user) {
        const auth = ehlo.lines.find(l => /^AUTH\b/i.test(l)) || '';
        if (/\bPLAIN\b/i.test(auth)) expect(await cmd(`AUTH PLAIN ${Buffer.from(`\0${user}\0${password || ''}`).toString('base64')}`, true), [235], 'AUTH');
        else { expect(await cmd('AUTH LOGIN'), [334], 'AUTH LOGIN'); expect(await cmd(Buffer.from(user).toString('base64'), true), [334], 'AUTH user'); expect(await cmd(Buffer.from(password || '').toString('base64'), true), [235], 'AUTH'); }
      }
      expect(await cmd(`MAIL FROM:<${addrOf(from)}>`), [250], 'MAIL FROM');
      expect(await cmd(`RCPT TO:<${to}>`), [250, 251], 'RCPT TO');
      expect(await cmd('DATA'), [354], 'DATA');
      const body = data.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
      log.push(`(${body.length} bytes)`); sock.write(body.endsWith('\r\n') ? body : body + '\r\n');
      const sent = expect(await cmd('.'), [250], 'end of DATA');
      try { await cmd('QUIT'); } catch { }
      done({ ok: true, id: sent.lines.join(' ').slice(0, 120) });
    })().catch((e) => done({ ok: false, why: e.message }));
  });
}

export function makeMailer({ dataDir, config = null, log = () => {}, now = Date.now, sendImpl = smtpSend, fetchImpl = globalThis.fetch } = {}) {
  const cfg = config || loadMailConfig(dataDir, process.env, log);
  let kind = 'outbox', deliver = null;
  if (cfg.transport === 'gmail-api') {
    if (cfg.gmail) { kind = 'gmail-api'; const g = makeGmailSender(cfg.gmail, { user: cfg.gmailUser || 'me', fetchImpl, now, log }); deliver = (m) => g(m); }
    else log(`mailer: mail-config asks for gmail-api but ${cfg.credentialsFile} is missing, unreadable or incomplete: using the outbox`);
  } else if (cfg.transport === 'smtp') {
    if (cfg.host && (!cfg.user || cfg.password)) { kind = 'smtp'; deliver = (m) => sendImpl(cfg, m); }
    else log(`mailer: mail-config asks for smtp but ${!cfg.host ? 'names no host' : 'has no password (env TW_SMTP_PASSWORD or ' + cfg.passwordFile + ')'}: using the outbox`);
  }
  const real = !!deliver;
  const allow = Array.isArray(cfg.allow) ? new Set(cfg.allow.map(a => String(a).toLowerCase())) : null;
  const from = cfg.from || `${DEFAULTS.fromName} <${DEFAULTS.from}>`, replyTo = cfg.replyTo || DEFAULTS.replyTo;

  function toOutbox(dir, mail, why) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const id = `${new Date(now()).toISOString().replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(path.join(dir, id + '.json'), JSON.stringify({ at: now(), from, replyTo, ...mail, mime: buildMime({ from, replyTo, now, ...mail }), transport: 'outbox', why }, null, 1), { mode: 0o600 });
    try { const all = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort(); for (const f of all.slice(0, Math.max(0, all.length - OUTBOX_KEEP))) fs.unlinkSync(path.join(dir, f)); } catch { }
    return { ok: true, transport: 'outbox', id, why };
  }
  // mail: { to, subject, text, html }   opts: { outboxDir, test }  -> { ok, transport, id?, why? }
  async function send(mail, { outboxDir = path.join(dataDir, 'linkmail', 'outbox'), test = false } = {}) {
    const to = String(mail.to || '').toLowerCase();
    if (test) return toOutbox(outboxDir, mail, 'test sandbox');
    if (!real) return toOutbox(outboxDir, mail, 'no mail transport configured (or its credentials are missing)');
    if (allow && !allow.has(to)) return toOutbox(outboxDir, mail, 'not on this relay\'s allow list');
    const r = await deliver({ from, to, data: buildMime({ from, replyTo, to, subject: mail.subject, text: mail.text, html: mail.html, now }) });
    if (!r.ok) { log(`mailer: ${kind} failed: ${r.why}`); return { ok: false, transport: kind, why: 'the mail could not be sent just now' }; }
    return { ok: true, transport: kind, id: r.id || null };
  }
  return { send, transport: kind, from, replyTo, describe: () => ({ transport: kind, wanted: cfg.transport, ...(kind === 'smtp' && { host: `${cfg.host}:${cfg.port}`, auth: !!cfg.user }), ...(cfg.transport === 'gmail-api' && { credentials: cfg.credentialsFile, user: cfg.gmailUser || 'me' }), from, replyTo, allowList: allow ? allow.size : null, config: cfg.file ? path.basename(cfg.file) : null }) };
}
