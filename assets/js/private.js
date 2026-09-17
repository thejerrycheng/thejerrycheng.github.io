/* =============================================================================
   PRIVATE — the unlock gate for the pages that are not public yet.

   What it is: a passphrase held as a hash, a flag in localStorage, and nothing
   else. It keeps a page off the public path — a visitor lands on "coming soon"
   and goes away. It is NOT security: this site is served from a public repo, so
   everything a gated page contains is still in the source a determined reader
   can open. Use it for "not ready yet", never for anything that would hurt.

   Unlocking, either way:
     · append ?key=<passphrase> to the URL once (it is scrubbed from the bar)
     · or type the passphrase into the gate on the page
   The unlock is remembered per browser until JCPrivate.lock() is called.

   Changing the passphrase — put the new hash in KEYHASH:
     python3 -c "s=input().strip().lower();v=0x811c9dc5
     [ (v:=((v^ord(c))*16777619)&0xFFFFFFFF) for c in s ];print(format(v,'08x'))"
   (FNV-1a, 32-bit, over the trimmed lower-cased passphrase.)
   ========================================================================== */
(function () {
  "use strict";

  var STORE   = "jc-private-key";
  var KEYHASH = "575c7b92";

  function hash(s) {
    s = String(s == null ? "" : s).trim().toLowerCase();
    var v = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      v ^= s.charCodeAt(i);
      v = (v + ((v << 1) + (v << 4) + (v << 7) + (v << 8) + (v << 24))) >>> 0;
    }
    return ("0000000" + v.toString(16)).slice(-8);
  }

  function read()  { try { return localStorage.getItem(STORE); } catch (e) { return null; } }
  function write(v){ try { v === null ? localStorage.removeItem(STORE) : localStorage.setItem(STORE, v); } catch (e) {} }

  var open = read() === KEYHASH;

  /* ?key=… — unlock from a bookmark, then take it back out of the address bar
     so the passphrase is not left in the URL, the history or a referrer. */
  var m = /[?&]key=([^&]*)/.exec(location.search);
  if (m) {
    if (!open && hash(decodeURIComponent(m[1].replace(/\+/g, " "))) === KEYHASH) {
      write(KEYHASH); open = true;
    }
    if (history.replaceState) {
      var q = location.search.replace(/([?&])key=[^&]*/, "$1").replace(/[?&]+$/, "").replace(/[?&]&+/g, "$1");
      if (q === "?" ) q = "";
      history.replaceState(null, "", location.pathname + q + location.hash);
    }
  }

  window.JCPrivate = {
    unlocked: function ()     { return open; },
    unlock:   function (pass) { if (hash(pass) !== KEYHASH) return false; write(KEYHASH); open = true; return true; },
    lock:     function ()     { write(null); open = false; }
  };
})();
