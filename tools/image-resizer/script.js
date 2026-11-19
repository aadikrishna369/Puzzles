(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var MAXDIM = 16384, MAXPX = 150e6;
  var HINTS = {
    nearest: 'Copies the closest pixel — hard edges stay crisp. Best for pixel art, sprites and icons.',
    box: 'Averages the covered area. Clean, fast choice for shrinking.',
    bilinear: 'Linear blend of neighbours. Smooth but a little soft.',
    bicubic: 'Sharper than bilinear with smooth gradients (Catmull‑Rom).',
    mitchell: 'Balanced bicubic: smooth with minimal ringing.',
    lanczos: 'Highest detail for photos; may add slight halos on sharp edges.',
    native: 'Uses your browser’s built‑in smoothing. Fast, decent quality.'
  };
  var PI = Math.PI;
  function sinc(x) { return x === 0 ? 1 : Math.sin(PI * x) / (PI * x); }
  function cubic(B, C) {
    return function (x) {
      x = Math.abs(x);
      if (x < 1) return ((12 - 9 * B - 6 * C) * x * x * x + (-18 + 12 * B + 6 * C) * x * x + (6 - 2 * B)) / 6;
      if (x < 2) return ((-B - 6 * C) * x * x * x + (6 * B + 30 * C) * x * x + (-12 * B - 48 * C) * x + (8 * B + 24 * C)) / 6;
      return 0;
    };
  }
  var KERNELS = {
    box: { s: 0.5, box: true, f: function () { return 1; } },
    bilinear: { s: 1, f: function (x) { x = Math.abs(x); return x < 1 ? 1 - x : 0; } },
    bicubic: { s: 2, f: cubic(0, 0.5) },
    mitchell: { s: 2, f: cubic(1 / 3, 1 / 3) },
    lanczos: { s: 3, f: function (x) { x = Math.abs(x); return x < 3 ? sinc(x) * sinc(x / 3) : 0; } }
  };

  var S = { img: null, url: null, name: '', mime: '', size: 0, ow: 0, oh: 0, src: '', modified: null,
    w: 0, h: 0, unit: 'px', lock: true, res: null, resUrl: null, busy: false, view: 'orig', srcData: null };

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }
  function fmtName(m) {
    var t = (m || '').split('/')[1] || 'unknown';
    t = t.split('+')[0].replace('x-icon', 'ico').replace('vnd.microsoft.icon', 'ico').replace('jpeg', 'jpg');
    return t.toUpperCase();
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  function toast(msg, type) {
    var t = document.createElement('div');
    t.className = 'toast ' + (type || '');
    t.textContent = msg;
    $('toasts').appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s'; t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 320);
    }, 3800);
  }

  /* ---------- loading ---------- */
  function loadBlob(blob, name, source, modified) {
    if (!blob.type || blob.type.indexOf('image/') !== 0) {
      toast('That doesn’t look like an image file.', 'err'); return;
    }
    var url = URL.createObjectURL(blob);
    var im = new Image();
    im.onload = function () {
      if (S.url) URL.revokeObjectURL(S.url);
      clearResult();
      S.img = im; S.url = url; S.name = name || 'image'; S.mime = blob.type; S.size = blob.size;
      S.ow = im.naturalWidth || 300; S.oh = im.naturalHeight || 150; S.src = source;
      S.modified = modified || null; S.srcData = null; S.view = 'orig';
      S.w = S.ow; S.h = S.oh; S.unit = 'px'; S.lock = true;
      $('start').hidden = true; $('work').hidden = false; $('bar').hidden = false; $('resetBtn').hidden = false;
      renderAll();
      toast('Loaded ' + S.name, 'ok');
    };
    im.onerror = function () {
      URL.revokeObjectURL(url);
      toast('Couldn’t decode that image — the format may not be supported by your browser.', 'err');
    };
    im.src = url;
  }
  function loadFile(f, source) {
    var name = f.name;
    if (!name || /^image\.\w+$/i.test(name)) { if (source === 'Clipboard') name = 'pasted-image.' + ((f.type.split('/')[1] || 'png').split('+')[0]); }
    loadBlob(f, name, source, f.lastModified ? new Date(f.lastModified) : null);
  }
  function loadUrl(u) {
    var parsed;
    try { parsed = new URL(u); } catch (e) { toast('Please enter a valid URL.', 'err'); return; }
    if (!/^https?:$/.test(parsed.protocol)) { toast('Only http(s) URLs are supported.', 'err'); return; }
    toast('Fetching image…', 'info');
    fetch(parsed.href, { mode: 'cors' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(function (b) {
      var seg = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || 'image');
      if (!b.type || b.type.indexOf('image/') !== 0) {
        var ext = (seg.split('.').pop() || '').toLowerCase();
        var map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif', ico: 'image/x-icon' };
        if (map[ext]) b = b.slice(0, b.size, map[ext]);
      }
      loadBlob(b, seg, 'URL (' + parsed.hostname + ')', null);
    }).catch(function () {
      toast('Couldn’t load that URL. The site may block cross‑origin access (CORS) — download the image and drop it here instead.', 'err');
    });
  }

  /* ---------- rendering ---------- */
  function renderAll() { renderInfo(); renderSize(); renderPreview(); renderOpts(); }
  function addRow(dl, k, v) {
    var a = document.createElement('dt'), b = document.createElement('dd');
    a.textContent = k; b.textContent = v; dl.appendChild(a); dl.appendChild(b);
  }
  function renderInfo() {
    var dl = $('info'); dl.textContent = '';
    var g = gcd(S.ow, S.oh);
    addRow(dl, 'File name', S.name);
    addRow(dl, 'Dimensions', S.ow + ' × ' + S.oh + ' px');
    addRow(dl, 'File size', fmtBytes(S.size));
    addRow(dl, 'Format', fmtName(S.mime) + ' (' + S.mime + ')');
    addRow(dl, 'Aspect ratio', (S.ow / g) + ':' + (S.oh / g));
    addRow(dl, 'Megapixels', (S.ow * S.oh / 1e6).toFixed(2) + ' MP');
    addRow(dl, 'Source', S.src);
    if (S.modified) addRow(dl, 'Modified', S.modified.toLocaleString());
    if (S.res) {
      addRow(dl, 'Resized', S.res.w + ' × ' + S.res.h + ' px');
      var d = Math.round((S.res.blob.size / S.size - 1) * 100);
      addRow(dl, 'Output size', fmtBytes(S.res.blob.size) + ' (' + (d > 0 ? '+' : '') + d + '%)');
    }
  }
  function renderPreview() {
    var showRes = S.view === 'res' && S.res;
    var im = $('preview'), w, h;
    im.src = showRes ? S.resUrl : S.url;
    w = showRes ? S.res.w : S.ow; h = showRes ? S.res.h : S.oh;
    var small = w < 256 && h < 256;
    var crisp = small || (showRes && $('algo').value === 'nearest');
    im.classList.toggle('crisp', crisp);
    im.style.width = small ? Math.min(w * Math.ceil(256 / w), 400) + 'px' : '';
    $('viewOrig').setAttribute('aria-pressed', String(!showRes));
    $('viewRes').setAttribute('aria-pressed', String(!!showRes));
    $('viewRes').disabled = !S.res;
    $('dlBtn').disabled = !S.res;
    $('previewNote').textContent = showRes
      ? 'Resized preview — ' + w + ' × ' + h + ' px, ' + fmtBytes(S.res.blob.size)
      : 'Original — ' + w + ' × ' + h + ' px, ' + fmtBytes(S.size);
  }
  function fmtVal(px, ref) {
    return S.unit === 'px' ? String(Math.round(px)) : String(Math.round(px / ref * 10000) / 100);
  }
  function renderSize() {
    var act = document.activeElement;
    if (act !== $('wInput')) $('wInput').value = fmtVal(S.w, S.ow);
    if (act !== $('hInput')) $('hInput').value = fmtVal(S.h, S.oh);
    $('wSuf').textContent = $('hSuf').textContent = S.unit === 'px' ? 'px' : '%';
    $('unitPx').setAttribute('aria-pressed', String(S.unit === 'px'));
    $('unitPct').setAttribute('aria-pressed', String(S.unit === 'pct'));
    $('lockBtn').setAttribute('aria-pressed', String(S.lock));
    $('lockBtn').setAttribute('aria-label', S.lock ? 'Aspect ratio locked — click to unlock' : 'Aspect ratio unlocked — click to lock');
    var pct = S.w / S.ow * 100;
    $('scaleRange').value = Math.max(5, Math.min(400, Math.round(pct)));
    $('scaleOut').textContent = (Math.round(pct * 10) / 10) + '%';
    var dir = S.w * S.h > S.ow * S.oh ? 'upscale' : S.w * S.h < S.ow * S.oh ? 'downscale' : 'same size';
    var sum = S.ow + ' × ' + S.oh + ' → ' + S.w + ' × ' + S.h + ' px · ' + (S.w * S.h / 1e6).toFixed(2) + ' MP · ' + dir;
    $('sum').textContent = sum;
    $('sum').style.color = tooBig() ? 'var(--err)' : '';
    if (tooBig()) $('sum').textContent = 'Output too large — max ' + MAXDIM + ' px per side and ' + (MAXPX / 1e6) + ' MP.';
  }
  function renderOpts() {
    var f = $('fmt').value === 'auto' ? outMime() : $('fmt').value;
    $('qRow').hidden = f === 'image/png';
    $('bgRow').hidden = f !== 'image/jpeg';
    $('qOut').textContent = $('quality').value;
    $('algoHint').textContent = HINTS[$('algo').value];
  }
  function tooBig() { return S.w > MAXDIM || S.h > MAXDIM || S.w * S.h > MAXPX; }
  function outMime() {
    var v = $('fmt').value;
    if (v !== 'auto') return v;
    return /^image\/(png|jpeg|webp)$/.test(S.mime) ? S.mime : 'image/png';
  }

  /* ---------- size controls ---------- */
  function clampPx(v) { return Math.max(1, Math.round(v)); }
  function readPx(el, ref) {
    var v = parseFloat(el.value);
    if (!isFinite(v) || v <= 0) return null;
    return clampPx(S.unit === 'px' ? v : v / 100 * ref);
  }
  function setW(w) { S.w = w; if (S.lock) S.h = clampPx(w * S.oh / S.ow); }
  function setH(h) { S.h = h; if (S.lock) S.w = clampPx(h * S.ow / S.oh); }
  function changed() { clearResult(); renderSize(); renderPreview(); renderInfo(); renderOpts(); }

  /* ---------- resampling ---------- */
  function weights(sl, dl, k) {
    var scale = sl / dl, fs = Math.max(scale, 1), sup = k.s * fs, out = new Array(dl);
    for (var i = 0; i < dl; i++) {
      var c = (i + 0.5) * scale;
      var s = Math.max(0, Math.floor(c - sup)), e = Math.min(sl - 1, Math.ceil(c + sup) - 1);
      var w = new Float32Array(Math.max(1, e - s + 1)), sum = 0;
      for (var j = s; j <= e; j++) {
        var v = k.box ? Math.max(0, Math.min(j + 1, c + fs / 2) - Math.max(j, c - fs / 2)) : k.f((j + 0.5 - c) / fs);
        w[j - s] = v; sum += v;
      }
      if (!sum) { s = Math.min(sl - 1, Math.floor(c)); w = new Float32Array([1]); sum = 1; }
      for (var q = 0; q < w.length; q++) w[q] /= sum;
      out[i] = { s: s, w: w };
    }
    return out;
  }
  function resample(id, dw, dh, algo) {
    var sw = id.width, sh = id.height, src = id.data, out = new Uint8ClampedArray(dw * dh * 4), x, y, i, p;
    if (algo === 'nearest') {
      for (y = 0; y < dh; y++) {
        var sy = Math.min(sh - 1, Math.floor((y + 0.5) * sh / dh));
        for (x = 0; x < dw; x++) {
          var sx = Math.min(sw - 1, Math.floor((x + 0.5) * sw / dw));
          p = (sy * sw + sx) * 4; var o = (y * dw + x) * 4;
          out[o] = src[p]; out[o + 1] = src[p + 1]; out[o + 2] = src[p + 2]; out[o + 3] = src[p + 3];
        }
      }
      return new ImageData(out, dw, dh);
    }
    var k = KERNELS[algo], wx = weights(sw, dw, k), wy = weights(sh, dh, k);
    var tmp = new Float32Array(dw * sh * 4);
    for (y = 0; y < sh; y++) {
      for (x = 0; x < dw; x++) {
        var cx = wx[x], r = 0, g = 0, b = 0, a = 0;
        for (i = 0; i < cx.w.length; i++) {
          p = (y * sw + cx.s + i) * 4;
          var al = src[p + 3] / 255 * cx.w[i];
          r += src[p] * al; g += src[p + 1] * al; b += src[p + 2] * al; a += al;
        }
        var t = (y * dw + x) * 4; tmp[t] = r; tmp[t + 1] = g; tmp[t + 2] = b; tmp[t + 3] = a;
      }
    }
    for (y = 0; y < dh; y++) {
      var cy = wy[y];
      for (x = 0; x < dw; x++) {
        var r2 = 0, g2 = 0, b2 = 0, a2 = 0;
        for (i = 0; i < cy.w.length; i++) {
          var q = ((cy.s + i) * dw + x) * 4, wt = cy.w[i];
          r2 += tmp[q] * wt; g2 += tmp[q + 1] * wt; b2 += tmp[q + 2] * wt; a2 += tmp[q + 3] * wt;
        }
        var o2 = (y * dw + x) * 4;
        if (a2 > 0.0001) {
          if (a2 > 1) a2 = 1;
          out[o2] = r2 / a2; out[o2 + 1] = g2 / a2; out[o2 + 2] = b2 / a2; out[o2 + 3] = a2 * 255;
        }
      }
    }
    return new ImageData(out, dw, dh);
  }
  function getSrcData() {
    if (S.srcData) return S.srcData;
    var c = document.createElement('canvas'); c.width = S.ow; c.height = S.oh;
    var x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(S.img, 0, 0, S.ow, S.oh);
    S.srcData = x.getImageData(0, 0, S.ow, S.oh);
    return S.srcData;
  }

  function clearResult() {
    if (S.resUrl) URL.revokeObjectURL(S.resUrl);
    S.res = null; S.resUrl = null; S.view = 'orig';
  }
  function setBusy(b) {
    S.busy = b; $('spin').hidden = !b; $('resizeBtn').disabled = b;
    $('resizeLbl').textContent = b ? 'Resizing…' : 'Resize image';
  }
  function frame() { return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 0); }); }); }

  function doResize() {
    if (!S.img || S.busy) return;
    if (tooBig()) { toast('That output size is too large for the browser.', 'err'); return; }
    setBusy(true);
    var algo = $('algo').value, mime = outMime(), q = parseInt($('quality').value, 10) / 100;
    frame().then(function () {
      var dw = S.w, dh = S.h, c = document.createElement('canvas');
      c.width = dw; c.height = dh;
      var ctx = c.getContext('2d');
      if (mime === 'image/jpeg') { ctx.fillStyle = $('bgColor').value; ctx.fillRect(0, 0, dw, dh); }
      if (algo === 'native') {
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(S.img, 0, 0, dw, dh);
      } else {
        var out = resample(getSrcData(), dw, dh, algo);
        var t = document.createElement('canvas'); t.width = dw; t.height = dh;
        t.getContext('2d').putImageData(out, 0, 0);
        ctx.drawImage(t, 0, 0);
      }
      return new Promise(function (res) { c.toBlob(res, mime, q); }).then(function (blob) {
        if (!blob) throw new Error('encode');
        clearResult();
        S.res = { blob: blob, w: dw, h: dh, mime: blob.type || mime };
        S.resUrl = URL.createObjectURL(blob); S.view = 'res';
        renderInfo(); renderPreview();
        toast('Resized to ' + dw + ' × ' + dh + ' px', 'ok');
      });
    }).catch(function () {
      toast('Something went wrong while resizing. Try a smaller size or another format.', 'err');
    }).then(function () { setBusy(false); });
  }
  function download() {
    if (!S.res) return;
    var base = S.name.replace(/\.[^.]+$/, '') || 'image';
    var ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[S.res.mime] || 'png';
    var a = document.createElement('a');
    a.href = S.resUrl; a.download = base + '-' + S.res.w + 'x' + S.res.h + '.' + ext;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- events ---------- */
  function bind() {
    var fi = $('fileInput');
    fi.addEventListener('change', function () { if (fi.files[0]) loadFile(fi.files[0], 'Local file'); fi.value = ''; });
    $('replaceBtn').addEventListener('click', function () { fi.click(); });
    $('urlForm').addEventListener('submit', function (e) { e.preventDefault(); var v = $('urlInput').value.trim(); if (v) loadUrl(v); });

    var depth = 0, ov = document.querySelector('.overlay');
    window.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') > -1) { depth++; ov.classList.toggle('on', !$('work').hidden); $('drop').classList.add('over'); } });
    window.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) { ov.classList.remove('on'); $('drop').classList.remove('over'); } });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) {
      e.preventDefault(); depth = 0; ov.classList.remove('on'); $('drop').classList.remove('over');
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) loadFile(f, 'Dropped file');
      else {
        var u = e.dataTransfer && e.dataTransfer.getData('text/uri-list');
        if (u && /^https?:/.test(u)) loadUrl(u.split('\n')[0]);
      }
    });
    document.addEventListener('paste', function (e) {
      var t = e.target, cd = e.clipboardData; if (!cd) return;
      var items = cd.items || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.indexOf('image/') === 0) {
          e.preventDefault(); loadFile(items[i].getAsFile(), 'Clipboard'); return;
        }
      }
      var txt = cd.getData('text');
      if (t === $('urlInput')) return;
      if (/^https?:\/\/\S+$/i.test((txt || '').trim())) { e.preventDefault(); $('urlInput').value = txt.trim(); loadUrl(txt.trim()); }
    });

    var rb = $('resetBtn'), rt;
    rb.addEventListener('click', function () {
      if (rb.classList.contains('confirm')) { location.reload(); return; }
      rb.classList.add('confirm'); rb.textContent = 'Click again to confirm';
      rt = setTimeout(function () { rb.classList.remove('confirm'); rb.textContent = '↻ New project'; }, 3500);
    });
    rb.addEventListener('blur', function () { clearTimeout(rt); rb.classList.remove('confirm'); rb.textContent = '↻ New project'; });

    $('viewOrig').addEventListener('click', function () { S.view = 'orig'; renderPreview(); });
    $('viewRes').addEventListener('click', function () { if (S.res) { S.view = 'res'; renderPreview(); } });
    $('unitPx').addEventListener('click', function () { S.unit = 'px'; renderSize(); });
    $('unitPct').addEventListener('click', function () { S.unit = 'pct'; renderSize(); });
    $('wInput').addEventListener('input', function () { var v = readPx($('wInput'), S.ow); if (v) { setW(v); $('preset').value = ''; changed(); } });
    $('hInput').addEventListener('input', function () { var v = readPx($('hInput'), S.oh); if (v) { setH(v); $('preset').value = ''; changed(); } });
    ['wInput', 'hInput'].forEach(function (id) { $(id).addEventListener('blur', renderSize); });
    $('lockBtn').addEventListener('click', function () {
      S.lock = !S.lock;
      if (S.lock) S.h = clampPx(S.w * S.oh / S.ow);
      changed();
    });
    $('scaleRange').addEventListener('input', function () {
      var p = parseFloat(this.value) / 100;
      S.w = clampPx(S.ow * p); S.h = clampPx(S.oh * p); $('preset').value = ''; changed();
    });
    $('chips').addEventListener('click', function (e) {
      var b = e.target.closest('[data-pct]'); if (!b) return;
      var p = parseFloat(b.dataset.pct) / 100;
      S.w = clampPx(S.ow * p); S.h = clampPx(S.oh * p); $('preset').value = ''; changed();
    });
    $('preset').addEventListener('change', function () {
      if (!this.value) return;
      var a = this.value.split(',');
      S.w = parseInt(a[0], 10); S.h = parseInt(a[1], 10);
      if (Math.abs(S.w / S.h - S.ow / S.oh) > 0.01) { S.lock = false; toast('Aspect ratio unlocked — this preset may stretch the image.', 'warn'); }
      changed();
    });
    $('resetSize').addEventListener('click', function () { S.w = S.ow; S.h = S.oh; S.lock = true; $('preset').value = ''; changed(); });
    ['algo', 'fmt', 'quality', 'bgColor'].forEach(function (id) { $(id).addEventListener('input', changed); });
    $('resizeBtn').addEventListener('click', doResize);
    $('dlBtn').addEventListener('click', download);
  }
  bind();
})();
