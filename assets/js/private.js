/* =============================================================================
   PRIVATE — the key to the pages that are not public yet.

   This site is served from a public repo, so hiding a page in the browser hides
   nothing: the file is still there to read. So the private pages are not stored
   as pages at all. They are published as ciphertext (.enc), and this script
   turns the passphrase into the key that opens them, in your browser, on
   demand. What GitHub holds is unreadable without it.

   AES-256-GCM, key from PBKDF2-SHA256(passphrase, SALT, ITER). One derivation
   opens every file, so the key is derived once and kept for the session.

   Unlocking, either way:
     · append ?key=<passphrase> to the URL once (it is scrubbed from the bar)
     · or type the passphrase into the gate on the page
   The derived key is remembered per browser until JCPrivate.lock() is called.

   Changing the passphrase — re-encrypt every .enc with the new one and replace
   VERIFY:
     node scripts/tools/private_crypto.js verifier --pass '<new>'
   Needs a secure context (https, or localhost). Opening a private page from
   file:// will not work: crypto.subtle is not there.
   ========================================================================== */
(function () {
  "use strict";

  var STORE  = "jc-private-key";
  var SALT   = b64("k3Hn8pQvLx2ZrTf9WmCd4A==");
  var ITER   = 310000;
  var VERIFY = b64("SkNFMclEqVdT0HwfIM3OpdwpJMzWYhlxCnFuvRt9sooJ07OLOWHPzK5zdA37");
  var OK     = "jc-private-ok";

  var subtle = (window.crypto && window.crypto.subtle) || null;
  var KEY = null;                       /* the live CryptoKey, once we have it */

  function b64(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function b64out(u) {
    var s = "", a = new Uint8Array(u);
    for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
    return btoa(s);
  }
  function read()   { try { return localStorage.getItem(STORE); } catch (e) { return null; } }
  function write(v) { try { v === null ? localStorage.removeItem(STORE) : localStorage.setItem(STORE, v); } catch (e) {} }

  /* passphrase -> AES key */
  function derive(pass) {
    return subtle.importKey("raw", new TextEncoder().encode(String(pass).trim().toLowerCase()),
                            "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return subtle.deriveKey({ name: "PBKDF2", salt: SALT, iterations: ITER, hash: "SHA-256" },
                                base, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
      });
  }

  /* "JCE1" | iv(12) | ciphertext||tag  ->  plaintext bytes */
  function open(buf, k) {
    var a = new Uint8Array(buf);
    if (a.length < 32 || a[0] !== 74 || a[1] !== 67 || a[2] !== 69 || a[3] !== 49)
      return Promise.reject(new Error("not a private file"));
    return subtle.decrypt({ name: "AES-GCM", iv: a.slice(4, 16) }, k, a.slice(16));
  }

  function check(k) {                   /* does this key open the verifier? */
    return open(VERIFY.buffer, k)
      .then(function (p) { return new TextDecoder().decode(p) === OK; })
      .catch(function () { return false; });
  }

  /* Restore a remembered key, then honour ?key= if it is there. */
  var ready = (function () {
    if (!subtle) return Promise.resolve(false);
    var saved = read();
    var step = saved
      ? subtle.importKey("raw", b64(saved), "AES-GCM", true, ["decrypt"])
          .then(function (k) { return check(k).then(function (ok) { if (ok) KEY = k; return ok; }); })
          .catch(function () { return false; })
      : Promise.resolve(false);

    return step.then(function (open_) {
      var m = /[?&]key=([^&]*)/.exec(location.search);
      if (!m) return open_;
      var pass = decodeURIComponent(m[1].replace(/\+/g, " "));
      /* take the passphrase back out of the address bar, history and referrer */
      if (history.replaceState) {
        var q = location.search.replace(/([?&])key=[^&]*/, "$1").replace(/[?&]+$/, "");
        history.replaceState(null, "", location.pathname + (q === "?" ? "" : q) + location.hash);
      }
      return open_ ? true : unlock(pass);
    });
  })();

  function unlock(pass) {
    if (!subtle) return Promise.resolve(false);
    return derive(pass).then(function (k) {
      return check(k).then(function (ok) {
        if (!ok) return false;
        KEY = k;
        return subtle.exportKey("raw", k).then(function (raw) { write(b64out(raw)); return true; });
      });
    }).catch(function () { return false; });
  }

  /* Fetch a .enc and give back what is inside it. */
  function bytes(url) {
    if (!KEY) return Promise.reject(new Error("locked"));
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(url + " — " + r.status);
      return r.arrayBuffer();
    }).then(function (buf) { return open(buf, KEY); });
  }

  window.JCPrivate = {
    ready:    ready,
    supported: !!subtle,
    unlocked: function () { return !!KEY; },
    unlock:   unlock,
    lock:     function () { KEY = null; write(null); },
    bytes:    bytes,
    text:     function (url) { return bytes(url).then(function (b) { return new TextDecoder().decode(b); }); },
    json:     function (url) { return this.text(url).then(JSON.parse); },
    blobUrl:  function (url, type) {
      return bytes(url).then(function (b) { return URL.createObjectURL(new Blob([b], { type: type || "application/octet-stream" })); });
    }
  };
})();
