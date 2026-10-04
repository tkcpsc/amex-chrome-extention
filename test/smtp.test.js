import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { buildMessage, sendMail } from '../emailer/smtp.js';

test('buildMessage produces multipart MIME with encoded subject', () => {
  const msg = buildMessage({ from: 'a@example.com', to: 'b@example.com', subject: 'Amex · 30% bonus', text: 'hi', html: '<p>hi</p>' });
  assert.match(msg, /^From: Amex Offers <a@example.com>\r\n/);
  assert.match(msg, /Subject: =\?UTF-8\?B\?/);
  assert.match(msg, /multipart\/alternative/);
  assert.ok(msg.includes(Buffer.from('<p>hi</p>').toString('base64')));
});

test('rejects header injection', () => {
  assert.throws(() => buildMessage({ from: 'a@x.com', to: 'b@x.com\r\nBcc: evil@x.com', subject: 's', text: '', html: '' }), /line break/);
});

test('refuses to send when server lacks STARTTLS', async () => {
  const server = net.createServer((sock) => {
    sock.write('220 fake ESMTP\r\n');
    sock.on('data', (d) => {
      const line = d.toString();
      if (line.startsWith('EHLO')) sock.write('250-fake\r\n250 AUTH PLAIN\r\n');
      else if (line.startsWith('QUIT')) sock.end('221 bye\r\n');
      else sock.write('500 no\r\n');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  await assert.rejects(
    sendMail({ host: '127.0.0.1', port, user: 'u', pass: 'p', from: 'a@x.com', to: 'b@x.com', subject: 's', text: 't', html: 'h' }),
    /STARTTLS/
  );
  server.close();
});
