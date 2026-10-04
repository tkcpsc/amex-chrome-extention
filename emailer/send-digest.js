#!/usr/bin/env node
// Weekly digest: reads the newest snapshot the extension saved, ranks offers
// with the same code as the dashboard, then emails you and/or shows a macOS
// notification.
//
//   node emailer/send-digest.js              # use config.json "mode"
//   node emailer/send-digest.js --dry-run    # write preview HTML, send nothing
//   node emailer/send-digest.js --period=month
//   node emailer/send-digest.js --snapshot=/path/to/file.json
//   node emailer/send-digest.js --check      # test TLS + login, send nothing
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDigest } from '../extension/lib/digest.js';
import { renderEmail, renderNotification } from './render.js';
import { sendMail } from './smtp.js';
import { getKeychainPassword } from './keychain.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);
const expandHome = (p) => p.replace(/^~(?=$|\/)/, homedir());

function loadConfig() {
  const path = join(here, 'config.json');
  const defaults = { mode: 'email', snapshotDir: '~/Downloads', smtpPort: 465, keychainService: 'amex-offers-smtp' };
  if (!existsSync(path)) {
    if (args['dry-run']) return defaults; // previews don't need email settings
    throw new Error('Missing emailer/config.json — copy emailer/config.example.json and fill it in.');
  }
  const cfg = JSON.parse(readFileSync(path, 'utf8'));
  if ('password' in cfg || 'pass' in cfg) {
    throw new Error('Remove the password from config.json — it belongs in the Keychain (scripts/setup-keychain.sh).');
  }
  return { ...defaults, ...cfg };
}

function newestSnapshot(dir) {
  const files = readdirSync(dir)
    .filter((f) => /^amex-offers-snapshot.*\.json$/i.test(f))
    .map((f) => ({ path: join(dir, f), mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0]?.path || null;
}

function notify(title, message) {
  // Passed as argv to AppleScript, never interpolated into the script source.
  execFileSync('/usr/bin/osascript', [
    '-e', 'on run argv',
    '-e', 'display notification (item 2 of argv) with title (item 1 of argv)',
    '-e', 'end run',
    title, message,
  ]);
}

async function check(cfg) {
  for (const k of ['to', 'from', 'smtpHost', 'smtpUser']) {
    if (!cfg[k]) throw new Error(`config.json is missing "${k}"`);
  }
  console.log(`1/3 config.json OK (sending ${cfg.from} → ${cfg.to} via ${cfg.smtpHost}:${cfg.smtpPort})`);
  const pass = getKeychainPassword(cfg.keychainService, cfg.smtpUser);
  console.log(`2/3 Keychain item found for ${cfg.smtpUser}`);
  const info = await sendMail({ host: cfg.smtpHost, port: cfg.smtpPort, user: cfg.smtpUser, pass, from: cfg.from, to: cfg.to, authOnly: true });
  console.log(`3/3 Logged in to ${cfg.smtpHost} over ${info.protocol} (certificate ${info.authorized ? 'verified' : 'NOT verified'} for ${info.cert})`);
  console.log('Email is ready. Send a real digest with: npm run digest');
}

async function main() {
  const cfg = loadConfig();
  if (args.check) return check(cfg);
  const snapshotDir = expandHome(cfg.snapshotDir);
  const snapPath = args.snapshot ? expandHome(String(args.snapshot)) : newestSnapshot(snapshotDir);

  const now = new Date();
  // First week of the month → monthly view, otherwise weekly (override with --period).
  const period = args.period || (now.getDate() <= 7 ? 'month' : 'week');

  let state;
  if (snapPath) {
    state = JSON.parse(readFileSync(snapPath, 'utf8'));
    if (state.app !== 'amex-offers') throw new Error(`${snapPath} is not an Amex Offers snapshot`);
    console.log(`Using snapshot ${snapPath} (exported ${state.exportedAt})`);
  } else {
    console.warn(`No amex-offers-snapshot*.json found in ${snapshotDir}`);
    state = { offers: {}, transferBonuses: {}, settings: {}, lastScanAt: null };
  }

  const digest = buildDigest(state, { period, now });
  const email = renderEmail(digest);

  if (args['dry-run']) {
    const out = join(here, 'out');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'preview.html'), email.html);
    writeFileSync(join(out, 'preview.txt'), `Subject: ${email.subject}\n\n${email.text}`);
    console.log(`Subject: ${email.subject}\nPreview written to ${join(out, 'preview.html')}`);
    return;
  }

  const mode = String(args.mode || cfg.mode);
  if (mode === 'notify' || mode === 'both') {
    const n = renderNotification(digest);
    notify(n.title, n.message);
    console.log('Notification shown.');
  }
  if (mode === 'email' || mode === 'both') {
    for (const k of ['to', 'from', 'smtpHost', 'smtpUser']) {
      if (!cfg[k]) throw new Error(`config.json is missing "${k}"`);
    }
    const pass = getKeychainPassword(cfg.keychainService, cfg.smtpUser);
    await sendMail({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      user: cfg.smtpUser,
      pass,
      from: cfg.from,
      to: cfg.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    console.log(`Emailed ${cfg.to}: ${email.subject}`);
  }
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] ${err.message}`);
  try { notify('Amex Offers digest failed', err.message.slice(0, 200)); } catch {}
  process.exit(1);
});
