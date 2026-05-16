#!/usr/bin/env node
/**
 * encrypt-dashboard.js
 *
 * One-shot tool to take a plaintext HTML file (dashboard source) and produce
 * a self-contained, password-gated dashboard HTML. The output asks for the
 * password in the browser, derives an AES-GCM 256-bit key via PBKDF2
 * (100,000 iterations, SHA-256), and decrypts the original HTML on the fly.
 *
 * Without the right password the dashboard content is unrecoverable:
 * - PBKDF2 makes brute force expensive
 * - AES-GCM verifies the auth tag so any wrong password fails cleanly
 * - View Source on the gated dashboard shows only base64 ciphertext
 *
 * Usage:
 *   node encrypt-dashboard.js <source.html> <output.html> <password>
 *
 * Example:
 *   node encrypt-dashboard.js dashboard-source.html dashboard.html 'mypass'
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 32;     // 256-bit
const SALT_LENGTH = 16;
const IV_LENGTH = 12;      // recommended for AES-GCM

function encryptHtml(plaintext, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // ciphertext blob layout for the browser: enc + tag (AES-GCM appends tag separately
  // in Node, but Web Crypto's AES-GCM expects them concatenated).
  return {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: Buffer.concat([enc, tag]).toString('base64'),
    iterations: PBKDF2_ITERATIONS,
  };
}

function buildGatePage(blob, meta = {}) {
  const title = meta.title || 'Locked — Dashboard';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="robots" content="noindex,nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='64' y2='64' gradientUnits='userSpaceOnUse'%3E%3Cstop offset='0%25' stop-color='%23818cf8'/%3E%3Cstop offset='50%25' stop-color='%23a78bfa'/%3E%3Cstop offset='100%25' stop-color='%23f472b6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='4' y='4' width='56' height='56' rx='14' fill='url(%23g)'/%3E%3Cpath d='M20 28 V22 a12 12 0 1 1 24 0 V28' fill='none' stroke='%230a0e1a' stroke-width='4' stroke-linecap='round'/%3E%3Crect x='16' y='28' width='32' height='22' rx='4' fill='%230a0e1a'/%3E%3Ccircle cx='32' cy='38' r='3' fill='url(%23g)'/%3E%3Crect x='30' y='38' width='4' height='8' fill='url(%23g)'/%3E%3C/svg%3E">
<style>
*, *::before, *::after { box-sizing: border-box; }
:root {
  --bg: #0a0e1a;
  --surface: rgba(28, 34, 64, 0.55);
  --surface-2: rgba(22, 27, 48, 0.85);
  --border: rgba(148, 163, 184, 0.10);
  --border-strong: rgba(148, 163, 184, 0.20);
  --text: #f1f5f9;
  --muted: #94a3b8;
  --indigo: #818cf8;
  --purple: #a78bfa;
  --pink: #f472b6;
  --danger: #f87171;
  --gradient: linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #f472b6 100%);
}
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  background-image:
    radial-gradient(at 15% 0%, rgba(129,140,248,.14), transparent 45%),
    radial-gradient(at 85% 100%, rgba(244,114,182,.10), transparent 45%);
  background-attachment: fixed;
  color: var(--text);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  min-height: 100vh;
  display: grid; place-items: center;
  -webkit-font-smoothing: antialiased;
  padding: 20px;
}
.gate {
  width: 100%; max-width: 420px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 22px;
  padding: 36px 32px 30px;
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  box-shadow: 0 30px 60px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04);
  animation: rise .35s ease both;
}
@keyframes rise { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.lock-icon {
  width: 56px; height: 56px;
  margin: 0 auto 18px;
  border-radius: 18px;
  background: var(--gradient);
  display: grid; place-items: center;
  box-shadow: 0 8px 22px rgba(167,139,250,.35);
}
.lock-icon svg { width: 26px; height: 26px; color: white; }
h1 {
  margin: 0 0 6px;
  font-size: 22px; font-weight: 800; letter-spacing: -0.02em;
  text-align: center;
}
h1 span {
  background: var(--gradient);
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent;
}
p.sub {
  margin: 0 0 26px;
  font-size: 13.5px; color: var(--muted);
  text-align: center;
  line-height: 1.5;
}
form { display: flex; flex-direction: column; gap: 12px; }
label {
  font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--muted);
}
.input-wrap {
  position: relative;
  display: flex; align-items: center;
}
input[type="password"], input[type="text"] {
  width: 100%;
  background: rgba(15, 20, 36, 0.7);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 13px 44px 13px 16px;
  font-size: 15px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  color: var(--text);
  outline: none;
  transition: border-color .15s, background .15s;
  letter-spacing: 0.05em;
}
input[type="password"]:focus, input[type="text"]:focus {
  border-color: var(--indigo);
  background: rgba(15, 20, 36, 0.95);
}
.eye {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  width: 32px; height: 32px;
  border: none; background: none; cursor: pointer;
  color: var(--muted);
  border-radius: 8px;
  display: grid; place-items: center;
  transition: background .15s, color .15s;
}
.eye:hover { background: rgba(148,163,184,.10); color: var(--text); }
.eye svg { width: 16px; height: 16px; }
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--gradient);
  color: white;
  padding: 12px 18px;
  font-size: 14.5px; font-weight: 700;
  border: none; border-radius: 12px;
  cursor: pointer; font-family: inherit;
  letter-spacing: -0.01em;
  box-shadow: 0 4px 14px rgba(167,139,250,.32), inset 0 1px 0 rgba(255,255,255,.18);
  transition: transform .12s, box-shadow .15s, opacity .15s;
}
.btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(167,139,250,.45), inset 0 1px 0 rgba(255,255,255,.18); }
.btn:active { transform: translateY(0); }
.btn:disabled { opacity: 0.55; cursor: wait; }
.btn svg { width: 16px; height: 16px; }
.spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.error {
  color: #fca5a5;
  font-size: 12.5px;
  font-weight: 500;
  background: rgba(248,113,113,.10);
  border: 1px solid rgba(248,113,113,.20);
  padding: 10px 13px;
  border-radius: 10px;
  display: none;
  align-items: center; gap: 8px;
  margin-top: 4px;
}
.error.show { display: flex; animation: shake .35s ease; }
.error svg { width: 14px; height: 14px; flex-shrink: 0; }
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
.footer {
  margin-top: 22px;
  text-align: center;
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.6;
}
.footer .lock-bits {
  display: inline-flex; align-items: center; gap: 4px;
  background: rgba(148,163,184,.08);
  padding: 3px 9px; border-radius: 100px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: var(--text);
}
.footer .lock-bits svg { width: 10px; height: 10px; color: var(--indigo); }
.footer a { color: var(--indigo); text-decoration: none; }
.footer a:hover { text-decoration: underline; }
</style>
</head>
<body>

<div class="gate" id="gate">
  <div class="lock-icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  </div>
  <h1>Dashboard <span>locked</span></h1>
  <p class="sub">Encrypted with AES-GCM. Enter the password to decrypt and view the dashboard.</p>

  <form id="form" autocomplete="off">
    <label for="pwd">Password</label>
    <div class="input-wrap">
      <input id="pwd" type="password" autocomplete="current-password" placeholder="••••••••••••" required autofocus spellcheck="false">
      <button type="button" class="eye" id="toggle" aria-label="Show password">
        <svg id="eyeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
    </div>
    <button class="btn" id="submitBtn" type="submit">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
      <span id="submitLabel">Unlock</span>
    </button>
    <div class="error" id="error">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <span id="errorText">Wrong password</span>
    </div>
  </form>

  <div class="footer">
    <span class="lock-bits">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      AES-GCM 256 · PBKDF2 ${blob.iterations.toLocaleString()}
    </span>
    <div style="margin-top: 10px;"><a href="./">← Back to Meet</a></div>
  </div>
</div>

<script id="payload" type="application/octet-stream+meta">
${JSON.stringify({ salt: blob.salt, iv: blob.iv, ciphertext: blob.ciphertext, iterations: blob.iterations })}
</script>

<script>
(function () {
  const PAYLOAD = JSON.parse(document.getElementById('payload').textContent);

  const b64ToBuf = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  async function deriveKey(password, salt, iterations) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  async function decrypt(password) {
    const salt = b64ToBuf(PAYLOAD.salt);
    const iv = b64ToBuf(PAYLOAD.iv);
    const ciphertext = b64ToBuf(PAYLOAD.ciphertext);
    const key = await deriveKey(password, salt, PAYLOAD.iterations);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(plaintext);
  }

  function setLoading(loading) {
    const btn = document.getElementById('submitBtn');
    const lbl = document.getElementById('submitLabel');
    btn.disabled = loading;
    if (loading) {
      btn.innerHTML = '<div class="spinner"></div><span>Decrypting…</span>';
    } else {
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg><span>Unlock</span>';
    }
  }

  function showError(msg) {
    const e = document.getElementById('error');
    document.getElementById('errorText').textContent = msg;
    e.classList.add('show');
    const input = document.getElementById('pwd');
    input.select();
  }

  function hideError() {
    document.getElementById('error').classList.remove('show');
  }

  document.getElementById('toggle').addEventListener('click', () => {
    const input = document.getElementById('pwd');
    const icon = document.getElementById('eyeIcon');
    if (input.type === 'password') {
      input.type = 'text';
      icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
    } else {
      input.type = 'password';
      icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
    }
  });

  document.getElementById('pwd').addEventListener('input', hideError);

  document.getElementById('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const pwd = document.getElementById('pwd').value;
    if (!pwd) return;
    setLoading(true);
    try {
      const html = await decrypt(pwd);
      // Replace the entire document with the decrypted HTML.
      // document.open/write/close also re-runs <script> tags in the new doc.
      document.open();
      document.write(html);
      document.close();
    } catch (err) {
      // AES-GCM throws on bad password (auth tag mismatch).
      setLoading(false);
      showError('Wrong password — try again');
      console.warn('Decrypt failed:', err?.name || err);
    }
  });
})();
</script>
</body>
</html>`;
}

// ---------- main ----------

function main() {
  const [src, out, password] = process.argv.slice(2);
  if (!src || !out || !password) {
    console.error('Usage: node encrypt-dashboard.js <source.html> <output.html> <password>');
    process.exit(1);
  }
  const source = fs.readFileSync(src, 'utf8');
  console.error(`Read ${source.length.toLocaleString()} bytes from ${src}`);
  const blob = encryptHtml(source, password);
  const html = buildGatePage(blob, { title: 'Locked — Meeting Hub' });
  fs.writeFileSync(out, html);
  console.error(`Wrote ${html.length.toLocaleString()} bytes to ${out}`);
  console.error(`Ciphertext: ${blob.ciphertext.length.toLocaleString()} base64 chars`);
  console.error('Done.');
}

main();
