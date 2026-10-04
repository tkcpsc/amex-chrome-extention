// Minimal SMTP client (no dependencies). Always encrypted:
//   port 465 → implicit TLS; any other port → STARTTLS is required, and the
//   connection is refused if the server doesn't offer it.
// Certificates are verified (Node's default); TLS 1.2+ only.
import net from 'node:net';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n').trimEnd();
const encodeHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

function assertSafeHeader(value, name) {
  if (/[\r\n]/.test(value)) throw new Error(`Invalid ${name}: contains a line break`);
  return value;
}

export function buildMessage({ from, to, subject, text, html, date = new Date() }) {
  assertSafeHeader(from, 'from');
  assertSafeHeader(to, 'to');
  assertSafeHeader(subject, 'subject');
  const boundary = `b_${randomBytes(12).toString('hex')}`;
  const domain = from.split('@')[1]?.replace(/>.*/, '') || 'localhost';
  return [
    `From: Amex Offers <${from}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${date.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${randomBytes(16).toString('hex')}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(text)),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(html)),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

// Reads complete (possibly multi-line) SMTP replies from a socket.
function replyReader(socket) {
  let buf = '';
  let lines = [];
  const queue = [];
  const waiters = [];
  const onData = (chunk) => {
    buf += chunk.toString('utf8');
    let i;
    while ((i = buf.indexOf('\r\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      lines.push(line);
      if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) {
        const reply = { code: Number(line.slice(0, 3)), text: lines.join('\n') };
        lines = [];
        const w = waiters.shift();
        w ? w.resolve(reply) : queue.push(reply);
      }
    }
  };
  const onError = (err) => { while (waiters.length) waiters.shift().reject(err); };
  socket.on('data', onData);
  socket.on('error', onError);
  socket.on('close', () => onError(new Error('SMTP connection closed')));
  return {
    next: () => (queue.length ? Promise.resolve(queue.shift()) : new Promise((resolve, reject) => waiters.push({ resolve, reject }))),
    detach: () => { socket.off('data', onData); socket.off('error', onError); },
  };
}

function connectTls(opts) {
  return new Promise((resolve, reject) => {
    const s = tls.connect({ ...opts, minVersion: 'TLSv1.2' }, () => resolve(s));
    s.once('error', reject);
  });
}

// With `authOnly`, connects, upgrades to TLS and logs in, then quits without
// sending — used by `send-digest.js --check`. Returns the server's TLS info.
export async function sendMail({ host, port, user, pass, from, to, subject, text, html, timeoutMs = 30000, authOnly = false }) {
  const implicit = Number(port) === 465;
  let socket = implicit
    ? await connectTls({ host, port, servername: host })
    : await new Promise((resolve, reject) => {
      const s = net.connect({ host, port }, () => resolve(s));
      s.once('error', reject);
    });
  socket.setTimeout(timeoutMs, () => socket.destroy(new Error('SMTP timeout')));

  let reader = replyReader(socket);
  const expect = async (codes, what) => {
    const r = await reader.next();
    if (!codes.includes(r.code)) throw new Error(`SMTP ${what} failed: ${r.text.replace(pass, '***')}`);
    return r;
  };
  const cmd = async (line, codes, what = line.split(' ')[0]) => {
    socket.write(`${line}\r\n`);
    return expect(codes, what);
  };

  try {
    await expect([220], 'greeting');
    let ehlo = await cmd('EHLO localhost', [250]);

    if (!implicit) {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error('Server does not offer STARTTLS; refusing to send in plaintext.');
      await cmd('STARTTLS', [220]);
      reader.detach();
      socket = await connectTls({ socket, servername: host });
      socket.setTimeout(timeoutMs, () => socket.destroy(new Error('SMTP timeout')));
      reader = replyReader(socket);
      ehlo = await cmd('EHLO localhost', [250]);
    }

    if (/AUTH[ =][^\n]*PLAIN/i.test(ehlo.text)) {
      await cmd(`AUTH PLAIN ${b64(`\0${user}\0${pass}`)}`, [235], 'AUTH');
    } else {
      await cmd('AUTH LOGIN', [334]);
      await cmd(b64(user), [334], 'AUTH user');
      await cmd(b64(pass), [235], 'AUTH');
    }
    if (authOnly) {
      const info = { protocol: socket.getProtocol(), authorized: socket.authorized, cert: socket.getPeerCertificate()?.subject?.CN };
      await cmd('QUIT', [221]).catch(() => {});
      return info;
    }
    await cmd(`MAIL FROM:<${assertSafeHeader(from, 'from')}>`, [250]);
    await cmd(`RCPT TO:<${assertSafeHeader(to, 'to')}>`, [250, 251]);
    await cmd('DATA', [354]);
    const body = buildMessage({ from, to, subject, text, html }).replace(/^\./gm, '..');
    socket.write(`${body}\r\n.\r\n`);
    await expect([250], 'message');
    await cmd('QUIT', [221]).catch(() => {});
  } finally {
    socket.end();
  }
}
