#!/usr/bin/env node
/* =============================================================================
   private_crypto.js — publish a file as ciphertext.

   The site is served from a public repo, so "private" can only mean one thing:
   what GitHub holds is unreadable without the passphrase, and the browser does
   the decrypting. AES-256-GCM, key from PBKDF2-SHA256 over a site-wide salt, so
   one derivation opens every file.

   Container:  "JCE1" | iv(12) | ciphertext || GCM tag(16)

   Usage
     node scripts/tools/private_crypto.js encrypt <in> <out> [--pass X]
     node scripts/tools/private_crypto.js decrypt <in> <out> [--pass X]
     node scripts/tools/private_crypto.js verifier [--pass X]     # blob for private.js
   The passphrase comes from --pass, else $JC_PRIVATE_PASS.
   ========================================================================== */
"use strict";
const fs = require("fs"), crypto = require("crypto");

/* Fixed site-wide. Changing either makes every published .enc unreadable. */
const SALT = Buffer.from("k3Hn8pQvLx2ZrTf9WmCd4A==", "base64");
const ITER = 310000;
const MAGIC = Buffer.from("JCE1", "ascii");

const key = pass => crypto.pbkdf2Sync(pass.trim().toLowerCase(), SALT, ITER, 32, "sha256");

function encrypt(buf, pass) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(pass), iv);
  const ct = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIC, iv, ct, c.getAuthTag()]);
}

function decrypt(buf, pass) {
  if (!buf.slice(0, 4).equals(MAGIC)) throw new Error("not a JCE1 container");
  const iv = buf.slice(4, 16), tag = buf.slice(buf.length - 16), ct = buf.slice(16, buf.length - 16);
  const d = crypto.createDecipheriv("aes-256-gcm", key(pass), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const pi = argv.indexOf("--pass");
const pass = pi >= 0 ? argv[pi + 1] : process.env.JC_PRIVATE_PASS;
if (!pass) { console.error("no passphrase: pass --pass or set JC_PRIVATE_PASS"); process.exit(1); }

if (cmd === "encrypt" || cmd === "decrypt") {
  const [, src, dst] = argv;
  if (!src || !dst) { console.error("usage: " + cmd + " <in> <out>"); process.exit(1); }
  const out = (cmd === "encrypt" ? encrypt : decrypt)(fs.readFileSync(src), pass);
  fs.writeFileSync(dst, out);
  console.log(`${cmd} ${src} -> ${dst}  (${fs.statSync(src).size} -> ${out.length} bytes)`);
} else if (cmd === "verifier") {
  /* the small blob private.js decrypts to prove a passphrase is right */
  console.log(encrypt(Buffer.from("jc-private-ok", "utf8"), pass).toString("base64"));
} else {
  console.error("commands: encrypt | decrypt | verifier");
  process.exit(1);
}
