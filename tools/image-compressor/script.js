(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var FMT = {
    png: { mime: 'image/png', ext: 'png' },
    jpg: { mime: 'image/jpeg', ext: 'jpg' },
    jpeg: { mime: 'image/jpeg', ext: 'jpeg' },
    webp: { mime: 'image/webp', ext: 'webp' }
  };
  var PRESETS = { low: 20, medium: 45, high: 70 };
  var state = { items: [], fmt: 'webp', level: 45, uid: 0, timer: null };
  var el = {
    file: $('#file'), drop: $('#drop'), list: $('#list'), level: $('#level'), levelVal: $('#levelVal'),
    hint: $('#hint'), sCur: $('#sCur'), sEst: $('#sEst'), sSave: $('#sSave'), bar: $('#bar'),
    dl: $('#dl'), clear: $('#clear'), reset: $('#reset'), toast: $('#toast')
  };

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  var toastTimer;
  function toast(msg, type) {
    el.toast.textContent = msg;
    el.toast.className = 'toast show ' + (type || 'ok');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 3600);
  }

  /* ---------- encoding ---------- */
  function posterize(ctx, w, h) {
    var shift = Math.round(state.level / 90 * 5);
    if (!shift) return;
    var d = ctx.getImageData(0, 0, w, h), p = d.data, half = 1 << (shift - 1);
    for (var i = 0; i < p.length; i += 4) {
      for (var k = 0; k < 3; k++) p[i + k] = Math.min(255, ((p[i + k] >> shift) << shift) + half);
    }
    ctx.putImageData(d, 0, 0);
  }
  function encode(it) {
    var job = ++it.job;
    it.busy = true; paint(it); totals();
    var f = FMT[state.fmt], fmtAtStart = state.fmt;
    var c = document.createElement('canvas');
    c.width = it.img.naturalWidth; c.height = it.img.naturalHeight;
    var x = c.getContext('2d');
    if (f.mime === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
    x.drawImage(it.img, 0, 0);
    if (f.mime === 'image/png') { try { posterize(x, c.width, c.height); } catch (e) {} }
    c.toBlob(function (b) {
      if (job !== it.job) return;
      it.busy = false;
      it.blob = b; it.fmt = fmtAtStart;
      if (!b) toast('Couldn’t compress ' + it.name + '.', 'err');
      else if (b.type !== f.mime) toast('This browser can’t encode ' + fmtAtStart.toUpperCase() + '; saved as ' + b.type.replace('image/', '').toUpperCase() + ' instead.', 'warn');
      paint(it); totals();
    }, f.mime, (100 - state.level) / 100);
  }
  function encodeAll() { state.items.forEach(encode); }
  function queueAll() {
    state.items.forEach(function (it) { it.job++; it.busy = true; paint(it); });
    totals();
    clearTimeout(state.timer);
    state.timer = setTimeout(encodeAll, 220);
  }

  /* ---------- items ---------- */
  function mk(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt) n.textContent = txt;
    return n;
  }
  function addFiles(files) {
    var list = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
    if (!list.length) { toast('Add image files such as PNG, JPG or WebP.', 'err'); return; }
    list.forEach(function (file) {
      var it = { id: ++state.uid, file: file, name: file.name || 'pasted-image.png', size: file.size, url: URL.createObjectURL(file), img: null, blob: null, busy: true, job: 0, fmt: state.fmt };
      var img = new Image();
      img.onload = function () { it.img = img; build(it); state.items.push(it); sync(); encode(it); };
      img.onerror = function () { URL.revokeObjectURL(it.url); toast('Couldn’t read ' + it.name + '.', 'err'); };
      img.src = it.url;
    });
  }
  function build(it) {
    var li = mk('li', 'item');
    var th = mk('img', 'th'); th.src = it.url; th.alt = '';
    var info = mk('div', 'info');
    var nm = mk('div', 'nm', it.name); nm.title = it.name;
    var mt = mk('div', 'mt');
    var cur = mk('span', '', 'Current ' + fmtBytes(it.size));
    var est = mk('span', 'est');
    var pct = mk('span', 'pct');
    mt.appendChild(cur); mt.appendChild(mk('span', '', '→')); mt.appendChild(est); mt.appendChild(pct);
    info.appendChild(nm); info.appendChild(mt);
    var dl = mk('button', 'ic', '⬇'); dl.type = 'button'; dl.setAttribute('aria-label', 'Download ' + it.name);
    var rm = mk('button', 'ic rm', '✕'); rm.type = 'button'; rm.setAttribute('aria-label', 'Remove ' + it.name);
    dl.addEventListener('click', function () { if (it.blob) save(it.blob, outName(it)); });
    rm.addEventListener('click', function () {
      URL.revokeObjectURL(it.url); it.job++;
      state.items = state.items.filter(function (o) { return o !== it; });
      li.remove(); sync(); totals();
    });
    li.appendChild(th); li.appendChild(info); li.appendChild(dl); li.appendChild(rm);
    it.ui = { est: est, pct: pct, dl: dl };
    el.list.appendChild(li);
    paint(it);
  }
  function paint(it) {
    if (!it.ui) return;
    var u = it.ui;
    u.dl.disabled = it.busy || !it.blob;
    if (it.busy) {
      u.est.textContent = ''; u.est.appendChild(mk('span', 'spin')); u.est.appendChild(document.createTextNode(' Estimating…')); u.pct.textContent = '';
      return;
    }
    if (!it.blob) { u.est.textContent = 'Failed'; u.pct.textContent = ''; return; }
    u.est.textContent = 'Estimated ' + fmtBytes(it.blob.size);
    var s = Math.round((1 - it.blob.size / it.size) * 100);
    u.pct.className = 'pct' + (s < 0 ? ' bad' : '');
    u.pct.textContent = s >= 0 ? '−' + s + '%' : '+' + (-s) + '% larger';
  }
  function totals() {
    var cur = 0, est = 0, busy = false, n = state.items.length;
    state.items.forEach(function (it) {
      cur += it.size;
      if (it.busy) busy = true; else if (it.blob) est += it.blob.size; else est += it.size;
    });
    if (!n) { el.sCur.textContent = el.sEst.textContent = el.sSave.textContent = '—'; return; }
    el.sCur.textContent = fmtBytes(cur);
    if (busy) { el.sEst.textContent = '…'; el.sSave.textContent = '…'; return; }
    el.sEst.textContent = fmtBytes(est);
    var s = Math.round((1 - est / cur) * 100);
    el.sSave.textContent = s >= 0 ? '−' + s + '%' : '+' + (-s) + '%';
    el.sSave.style.color = s >= 0 ? '' : 'var(--warn)';
  }
  function sync() {
    var has = state.items.length > 0;
    el.bar.hidden = !has; el.reset.hidden = !has;
    el.dl.disabled = !has;
    if (!has) totals();
  }

  /* ---------- download ---------- */
  function outName(it) {
    var base = it.name.replace(/\.[^.]+$/, '') || 'image';
    var ext = it.blob && it.blob.type !== FMT[it.fmt].mime ? it.blob.type.replace('image/', '').replace('jpeg', 'jpg') : FMT[it.fmt].ext;
    return base + '-compressed.' + ext;
  }
  function save(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function crcTable() {
    var t = [], c, n, k;
    for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  }
  function zip(files) {
    var T = crcTable(), parts = [], cent = [], off = 0, enc = new TextEncoder();
    files.forEach(function (f) {
      var nm = enc.encode(f.name), d = f.data, crc = 0xFFFFFFFF, i;
      for (i = 0; i < d.length; i++) crc = T[(crc ^ d[i]) & 255] ^ (crc >>> 8);
      crc = (crc ^ 0xFFFFFFFF) >>> 0;
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true);
      h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true);
      h.setUint32(22, d.length, true); h.setUint16(26, nm.length, true);
      parts.push(h.buffer, nm, d);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true);
      c.setUint32(24, d.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
      cent.push(c.buffer, nm);
      off += 30 + nm.length + d.length;
    });
    var size = 0; cent.forEach(function (p) { size += p.byteLength; });
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob(parts.concat(cent, [e.buffer]), { type: 'application/zip' });
  }
  function downloadAll() {
    var ready = state.items.filter(function (it) { return it.blob && !it.busy; });
    if (!ready.length) { toast('Still compressing—try again in a moment.', 'warn'); return; }
    if (ready.length === 1) { save(ready[0].blob, outName(ready[0])); toast('Downloaded.'); return; }
    var seen = {};
    Promise.all(ready.map(function (it) {
      return it.blob.arrayBuffer().then(function (buf) {
        var n = outName(it), k = 1;
        while (seen[n]) { n = outName(it).replace(/(\.[^.]+)$/, '-' + (++k) + '$1'); }
        seen[n] = 1;
        return { name: n, data: new Uint8Array(buf) };
      });
    })).then(function (files) {
      save(zip(files), 'compressed-images.zip');
      toast('Downloaded ' + files.length + ' images as a ZIP.');
    }).catch(function () { toast('Couldn’t build the ZIP.', 'err'); });
  }

  /* ---------- settings ---------- */
  function setFmt(f) {
    state.fmt = f;
    Array.prototype.forEach.call(document.querySelectorAll('[data-fmt]'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-fmt') === f));
    });
    el.hint.textContent = f === 'png'
      ? 'PNG is lossless, so compression here reduces colour depth. Photos usually shrink far more as WEBP or JPG.'
      : (f === 'jpg' || f === 'jpeg') ? 'JPG has no transparency—transparent areas become white.' : '';
  }
  function setLevel(v) {
    state.level = v; el.level.value = v;
    el.levelVal.textContent = 'Compression ' + v + '% (quality ' + (100 - v) + '%)';
    Array.prototype.forEach.call(document.querySelectorAll('[data-preset]'), function (b) {
      b.setAttribute('aria-pressed', String(PRESETS[b.getAttribute('data-preset')] === v));
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-fmt]'), function (b) {
    b.addEventListener('click', function () { setFmt(b.getAttribute('data-fmt')); queueAll(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-preset]'), function (b) {
    b.addEventListener('click', function () { setLevel(PRESETS[b.getAttribute('data-preset')]); queueAll(); });
  });
  el.level.addEventListener('input', function () { setLevel(+el.level.value); queueAll(); });

  /* ---------- input: pick, drop, paste ---------- */
  el.file.addEventListener('change', function () { addFiles(el.file.files); el.file.value = ''; });
  ['dragenter', 'dragover'].forEach(function (t) {
    window.addEventListener(t, function (e) { e.preventDefault(); if (e.target.closest && e.target.closest('#drop')) el.drop.classList.add('over'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    window.addEventListener(t, function (e) { e.preventDefault(); if (t === 'drop' || e.target === el.drop) el.drop.classList.remove('over'); });
  });
  window.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });
  document.addEventListener('paste', function (e) {
    var files = [], items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].kind === 'file' && /^image\//.test(items[i].type)) files.push(items[i].getAsFile());
    }
    if (files.length) { e.preventDefault(); addFiles(files); toast('Pasted ' + files.length + (files.length > 1 ? ' images.' : ' image.')); }
  });

  /* ---------- actions ---------- */
  el.dl.addEventListener('click', downloadAll);
  el.clear.addEventListener('click', function () {
    state.items.forEach(function (it) { URL.revokeObjectURL(it.url); it.job++; });
    state.items = []; el.list.textContent = ''; sync();
  });
  var armed = false, armTimer;
  el.reset.addEventListener('click', function () {
    if (armed) { location.reload(); return; }
    armed = true; el.reset.classList.add('confirm'); el.reset.textContent = 'Click again to confirm';
    armTimer = setTimeout(function () { armed = false; el.reset.classList.remove('confirm'); el.reset.textContent = '↻ New project'; }, 3000);
  });

  setFmt('webp'); setLevel(45); sync();
})();
