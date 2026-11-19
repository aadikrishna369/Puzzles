(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NAMES = ('Alice Blue=f0f8ff,Antique White=faebd7,Aqua=00ffff,Aquamarine=7fffd4,Azure=f0ffff,Beige=f5f5dc,Bisque=ffe4c4,Black=000000,Blanched Almond=ffebcd,Blue=0000ff,Blue Violet=8a2be2,Brown=a52a2a,Burlywood=deb887,Cadet Blue=5f9ea0,Chartreuse=7fff00,Chocolate=d2691e,Coral=ff7f50,Cornflower Blue=6495ed,Cornsilk=fff8dc,Crimson=dc143c,Dark Blue=00008b,Dark Cyan=008b8b,Dark Goldenrod=b8860b,Dark Gray=a9a9a9,Dark Green=006400,Dark Khaki=bdb76b,Dark Magenta=8b008b,Dark Olive Green=556b2f,Dark Orange=ff8c00,Dark Orchid=9932cc,Dark Red=8b0000,Dark Salmon=e9967a,Dark Sea Green=8fbc8f,Dark Slate Blue=483d8b,Dark Slate Gray=2f4f4f,Dark Turquoise=00ced1,Dark Violet=9400d3,Deep Pink=ff1493,Deep Sky Blue=00bfff,Dim Gray=696969,Dodger Blue=1e90ff,Firebrick=b22222,Floral White=fffaf0,Forest Green=228b22,Gainsboro=dcdcdc,Ghost White=f8f8ff,Gold=ffd700,Goldenrod=daa520,Gray=808080,Green=008000,Green Yellow=adff2f,Honeydew=f0fff0,Hot Pink=ff69b4,Indian Red=cd5c5c,Indigo=4b0082,Ivory=fffff0,Khaki=f0e68c,Lavender=e6e6fa,Lavender Blush=fff0f5,Lawn Green=7cfc00,Lemon Chiffon=fffacd,Light Blue=add8e6,Light Coral=f08080,Light Cyan=e0ffff,Light Goldenrod=fafad2,Light Gray=d3d3d3,Light Green=90ee90,Light Pink=ffb6c1,Light Salmon=ffa07a,Light Sea Green=20b2aa,Light Sky Blue=87cefa,Light Slate Gray=778899,Light Steel Blue=b0c4de,Light Yellow=ffffe0,Lime=00ff00,Lime Green=32cd32,Linen=faf0e6,Magenta=ff00ff,Maroon=800000,Medium Aquamarine=66cdaa,Medium Blue=0000cd,Medium Orchid=ba55d3,Medium Purple=9370db,Medium Sea Green=3cb371,Medium Slate Blue=7b68ee,Medium Spring Green=00fa9a,Medium Turquoise=48d1cc,Medium Violet Red=c71585,Midnight Blue=191970,Mint Cream=f5fffa,Misty Rose=ffe4e1,Moccasin=ffe4b5,Navajo White=ffdead,Navy=000080,Old Lace=fdf5e6,Olive=808000,Olive Drab=6b8e23,Orange=ffa500,Orange Red=ff4500,Orchid=da70d6,Pale Goldenrod=eee8aa,Pale Green=98fb98,Pale Turquoise=afeeee,Pale Violet Red=db7093,Papaya Whip=ffefd5,Peach Puff=ffdab9,Peru=cd853f,Pink=ffc0cb,Plum=dda0dd,Powder Blue=b0e0e6,Purple=800080,Rebecca Purple=663399,Red=ff0000,Rosy Brown=bc8f8f,Royal Blue=4169e1,Saddle Brown=8b4513,Salmon=fa8072,Sandy Brown=f4a460,Sea Green=2e8b57,Seashell=fff5ee,Sienna=a0522d,Silver=c0c0c0,Sky Blue=87ceeb,Slate Blue=6a5acd,Slate Gray=708090,Snow=fffafa,Spring Green=00ff7f,Steel Blue=4682b4,Tan=d2b48c,Teal=008080,Thistle=d8bfd8,Tomato=ff6347,Turquoise=40e0d0,Violet=ee82ee,Wheat=f5deb3,White=ffffff,White Smoke=f5f5f5,Yellow=ffff00,Yellow Green=9acd32')
    .split(',').map(function (s) {
      var p = s.split('='), h = parseInt(p[1], 16);
      return { n: p[0], r: h >> 16, g: (h >> 8) & 255, b: h & 255 };
    });

  var S = { name: '', size: 0, ow: 0, oh: 0, k: 1, cur: null, picks: [], pal: [], dom: null, px: [], n: 6, zoom: 15, src: 'pal', fmt: 'json', newId: 0, uid: 0, has: false };
  var cv = $('cv'), ov = $('ov'), ctx = cv.getContext('2d', { willReadFrequently: true }), octx = ov.getContext('2d');
  var lp = $('loupe'), lctx = lp.getContext('2d');

  /* ---------- color maths ---------- */
  function hex(c) { return '#' + [c.r, c.g, c.b].map(function (v) { return (v < 16 ? '0' : '') + v.toString(16); }).join('').toUpperCase(); }
  function hsl(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function cmyk(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255, k = 1 - Math.max(r, g, b);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
    return { c: Math.round((1 - r - k) / (1 - k) * 100), m: Math.round((1 - g - k) / (1 - k) * 100), y: Math.round((1 - b - k) / (1 - k) * 100), k: Math.round(k * 100) };
  }
  function nameOf(c) {
    var best = null, bd = 1e12;
    NAMES.forEach(function (n) {
      var rm = (c.r + n.r) / 2, dr = c.r - n.r, dg = c.g - n.g, db = c.b - n.b;
      var d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
      if (d < bd) { bd = d; best = n; }
    });
    return bd === 0 ? best.n : '≈ ' + best.n;
  }
  function fmts(c) {
    var h = hsl(c), k = cmyk(c);
    return {
      hex: hex(c),
      rgb: c.a != null && c.a < 255 ? 'rgba(' + c.r + ', ' + c.g + ', ' + c.b + ', ' + (Math.round(c.a / 2.55) / 100) + ')' : 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')',
      hsl: 'hsl(' + h.h + ', ' + h.s + '%, ' + h.l + '%)',
      cmyk: 'cmyk(' + k.c + '%, ' + k.m + '%, ' + k.y + '%, ' + k.k + '%)'
    };
  }
  function ink(c) { return (c.r * 299 + c.g * 587 + c.b * 114) / 1000 > 140 ? '#0D0F17' : '#F4F3FF'; }

  /* ---------- helpers ---------- */
  function toast(msg, type) {
    var box = $('toasts'), t = document.createElement('div');
    t.className = 'toast ' + (type || ''); t.textContent = msg;
    while (box.children.length > 3) box.firstChild.remove();
    box.appendChild(t);
    setTimeout(function () { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(function () { t.remove(); }, 320); }, 2600);
  }
  function copy(text, label) {
    function ok() { toast('Copied ' + (label || text), 'ok'); }
    function fb() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? ok() : toast('Couldn’t copy — please copy manually.', 'err'); } catch (e) { toast('Couldn’t copy — please copy manually.', 'err'); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fb); else fb();
  }
  function fmtBytes(n) { return n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB'; }
  function dl(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ---------- loading ---------- */
  function loadFile(f) {
    if (!f || f.type.indexOf('image/') !== 0) { toast('That doesn’t look like an image file.', 'err'); return; }
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      var w = im.naturalWidth || 300, h = im.naturalHeight || 150;
      if (w * h > 100e6) { URL.revokeObjectURL(url); toast('That image is too large for the browser.', 'err'); return; }
      cv.width = ov.width = w; cv.height = ov.height = h; S.ow = w; S.oh = h;
      ctx.clearRect(0, 0, w, h); ctx.drawImage(im, 0, 0, w, h);
      URL.revokeObjectURL(url);
      S.name = f.name || 'pasted-image.png'; S.size = f.size; S.picks = []; S.newId = 0; S.has = true;
      $('start').hidden = true; $('work').hidden = false; $('bar').hidden = false; $('resetBtn').hidden = false;
      $('meta').textContent = S.name + ' · ' + w + ' × ' + h + ' px · ' + fmtBytes(f.size);
      fit(); analyse();
      S.cur = { x: w >> 1, y: h >> 1 }; hover(S.cur.x, S.cur.y);
      renderPicks(); renderExport();
      toast('Loaded ' + S.name, 'ok');
    };
    im.onerror = function () { URL.revokeObjectURL(url); toast('Couldn’t decode that image — the format may not be supported.', 'err'); };
    im.src = url;
  }
  function fit() {
    if (!S.has) return;
    var avail = Math.max(120, $('stage').clientWidth - 20), maxH = Math.max(280, innerHeight * 0.7);
    var sc = Math.min(avail / S.ow, maxH / S.oh);
    if (sc > 1) sc = Math.max(1, Math.floor(sc));
    var w = Math.max(1, Math.round(S.ow * sc)) + 'px', h = Math.max(1, Math.round(S.oh * sc)) + 'px';
    cv.style.width = ov.style.width = w; cv.style.height = ov.style.height = h;
    cv.classList.toggle('crisp', sc > 1); S.k = 1 / sc;
    drawOverlay();
  }

  /* ---------- palette & dominant ---------- */
  function analyse() {
    var sc = Math.min(1, 160 / Math.max(S.ow, S.oh)), sw = Math.max(1, Math.round(S.ow * sc)), sh = Math.max(1, Math.round(S.oh * sc));
    var c = document.createElement('canvas'); c.width = sw; c.height = sh;
    var x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0, sw, sh);
    var d = x.getImageData(0, 0, sw, sh).data, px = [], bins = {}, i, bestK = null, bestN = 0;
    for (i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 125) continue;
      px.push([d[i], d[i + 1], d[i + 2]]);
      var key = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | d[i + 2] >> 4, b = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 });
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
    }
    S.px = px; S.dom = null;
    for (var k in bins) if (bins[k].n > bestN) { bestN = bins[k].n; bestK = bins[k]; }
    if (bestK) S.dom = { r: Math.round(bestK.r / bestK.n), g: Math.round(bestK.g / bestK.n), b: Math.round(bestK.b / bestK.n), pct: bestK.n / px.length };
    buildPalette();
  }
  function medianCut(px, k) {
    var boxes = [px], total = px.length;
    while (boxes.length < k) {
      var best = -1, bs = 0, ch = 0;
      boxes.forEach(function (b, i) {
        if (b.length < 2) return;
        var mn = [255, 255, 255], mx = [0, 0, 0], j, q;
        for (j = 0; j < b.length; j++) for (q = 0; q < 3; q++) { if (b[j][q] < mn[q]) mn[q] = b[j][q]; if (b[j][q] > mx[q]) mx[q] = b[j][q]; }
        var rg = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]], m = Math.max(rg[0], rg[1], rg[2]);
        if (m > 0 && b.length * m > bs) { bs = b.length * m; best = i; ch = rg.indexOf(m); }
      });
      if (best < 0) break;
      var bx = boxes[best]; bx.sort(function (p, q) { return p[ch] - q[ch]; });
      var mid = bx.length >> 1; boxes.splice(best, 1, bx.slice(0, mid), bx.slice(mid));
    }
    return boxes.map(function (b) {
      var r = 0, g = 0, bl = 0;
      b.forEach(function (p) { r += p[0]; g += p[1]; bl += p[2]; });
      return { r: Math.round(r / b.length), g: Math.round(g / b.length), b: Math.round(bl / b.length), pct: b.length / total };
    }).sort(function (a, b) { return b.pct - a.pct; });
  }
  function buildPalette() {
    S.pal = S.px.length ? medianCut(S.px, S.n) : [];
    var dm = $('dom'), pl = $('pal'); dm.textContent = ''; pl.textContent = '';
    if (!S.dom) { dm.textContent = 'No opaque pixels to analyse.'; renderExport(); return; }
    var sw = document.createElement('button'); sw.type = 'button'; sw.className = 'sw'; sw.style.background = hex(S.dom);
    sw.setAttribute('aria-label', 'Copy dominant color ' + hex(S.dom)); sw.onclick = function () { copy(hex(S.dom)); };
    var tx = document.createElement('div');
    var a = document.createElement('strong'); a.textContent = 'Dominant color';
    var b = document.createElement('div'); b.textContent = hex(S.dom) + ' · ' + nameOf(S.dom);
    var c = document.createElement('div'); c.className = 'small muted'; c.textContent = 'Most common shade, about ' + Math.max(1, Math.round(S.dom.pct * 100)) + '% of the image';
    tx.appendChild(a); tx.appendChild(b); tx.appendChild(c); dm.appendChild(sw); dm.appendChild(tx);
    S.pal.forEach(function (col) {
      var s = document.createElement('button'); s.type = 'button'; s.className = 'chip-sw';
      s.style.background = hex(col); s.style.color = ink(col); s.textContent = hex(col);
      s.title = nameOf(col) + ' · ' + Math.round(col.pct * 100) + '% — click to copy';
      s.setAttribute('aria-label', 'Copy ' + hex(col) + ', ' + nameOf(col));
      s.onclick = function () { copy(hex(col)); };
      pl.appendChild(s);
    });
    renderExport();
  }

  /* ---------- picking ---------- */
  function clampPt(e) {
    var r = cv.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(S.ow - 1, Math.floor((e.clientX - r.left) * S.ow / r.width))),
      y: Math.max(0, Math.min(S.oh - 1, Math.floor((e.clientY - r.top) * S.oh / r.height)))
    };
  }
  function pixel(x, y) { var d = ctx.getImageData(x, y, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] }; }
  function hover(x, y) {
    S.cur = { x: x, y: y };
    var c = pixel(x, y), f = fmts(c);
    $('coord').textContent = 'x: ' + x + ' · y: ' + y + ' · ' + f.hex;
    $('liveHex').textContent = f.hex + ' · ' + nameOf(c);
    $('liveRgb').textContent = 'x: ' + x + ', y: ' + y + ' · ' + f.rgb;
    $('liveSw').style.background = f.hex;
    drawLoupe(x, y); drawOverlay();
  }
  function drawLoupe(cx, cy) {
    var n = S.zoom, cell = lp.width / n, half = n >> 1, d = ctx.getImageData(cx - half, cy - half, n, n).data, i, j;
    lctx.clearRect(0, 0, lp.width, lp.height);
    for (j = 0; j < n; j++) for (i = 0; i < n; i++) {
      var o = (j * n + i) * 4, x = cx - half + i, y = cy - half + j;
      lctx.fillStyle = (x < 0 || y < 0 || x >= S.ow || y >= S.oh) ? '#0D0F17' : d[o + 3] ? 'rgb(' + d[o] + ',' + d[o + 1] + ',' + d[o + 2] + ')' : '#121522';
      lctx.fillRect(i * cell, j * cell, cell + 0.5, cell + 0.5);
    }
    if (cell >= 11) {
      lctx.strokeStyle = 'rgba(0,0,0,.28)'; lctx.lineWidth = 1; lctx.beginPath();
      for (i = 1; i < n; i++) { lctx.moveTo(i * cell, 0); lctx.lineTo(i * cell, lp.height); lctx.moveTo(0, i * cell); lctx.lineTo(lp.width, i * cell); }
      lctx.stroke();
    }
    lctx.strokeStyle = '#0D0F17'; lctx.lineWidth = 4; lctx.strokeRect(half * cell, half * cell, cell, cell);
    lctx.strokeStyle = '#fff'; lctx.lineWidth = 2; lctx.strokeRect(half * cell, half * cell, cell, cell);
  }
  function drawOverlay() {
    if (!S.has) return;
    var k = S.k; octx.clearRect(0, 0, S.ow, S.oh);
    S.picks.forEach(function (p) {
      if (p.x == null) return;
      octx.beginPath(); octx.arc(p.x + .5, p.y + .5, 7 * k, 0, 7);
      octx.lineWidth = 4 * k; octx.strokeStyle = '#0D0F17'; octx.stroke();
      octx.lineWidth = 2 * k; octx.strokeStyle = '#fff'; octx.stroke();
    });
    if (!S.cur || !S.hov) return;
    var x = S.cur.x + .5, y = S.cur.y + .5, g = 4 * k, l = 14 * k;
    [[3 * k, '#0D0F17'], [1.2 * k, '#fff']].forEach(function (s) {
      octx.lineWidth = s[0]; octx.strokeStyle = s[1]; octx.beginPath();
      octx.moveTo(x - g, y); octx.lineTo(x - l, y); octx.moveTo(x + g, y); octx.lineTo(x + l, y);
      octx.moveTo(x, y - g); octx.lineTo(x, y - l); octx.moveTo(x, y + g); octx.lineTo(x, y + l); octx.stroke();
    });
  }
  function pick(x, y) {
    if (S.picks.length >= 60) { toast('Picked list is full (60). Remove a color first.', 'warn'); return; }
    var c = pixel(x, y); c.x = x; c.y = y; c.id = ++S.uid; S.newId = c.id; S.picks.push(c);
    renderPicks(); drawOverlay(); toast('Picked ' + hex(c), 'ok');
  }
  function addColor(c) { var p = { r: c.r, g: c.g, b: c.b, a: 255, x: null, y: null, id: ++S.uid }; S.newId = p.id; S.picks.push(p); }
  function renderPicks() {
    var box = $('picks'); box.textContent = '';
    S.picks.forEach(function (p) {
      var f = fmts(p), el = document.createElement('article'); el.className = 'pick' + (p.id === S.newId ? ' new' : '');
      var sw = document.createElement('button'); sw.type = 'button'; sw.className = 'sw'; sw.style.background = f.hex;
      sw.setAttribute('aria-label', 'Copy ' + f.hex); sw.onclick = function () { copy(f.hex); };
      var pm = document.createElement('div'); pm.className = 'pm';
      var nm = document.createElement('strong'); nm.textContent = nameOf(p);
      var xy = document.createElement('div'); xy.className = 'xy'; xy.textContent = p.x == null ? 'From palette' : 'x: ' + p.x + ' · y: ' + p.y;
      var fm = document.createElement('div'); fm.className = 'fmts';
      ['hex', 'rgb', 'hsl', 'cmyk'].forEach(function (key) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'cp';
        b.setAttribute('aria-label', 'Copy ' + key.toUpperCase() + ' ' + f[key]);
        var k = document.createElement('span'); k.className = 'k'; k.textContent = key.toUpperCase();
        var v = document.createElement('span'); v.className = 'v'; v.textContent = f[key];
        b.appendChild(k); b.appendChild(v); b.onclick = function () { copy(f[key]); }; fm.appendChild(b);
      });
      var x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.textContent = '✕';
      x.setAttribute('aria-label', 'Remove ' + f.hex);
      x.onclick = function () { S.picks = S.picks.filter(function (q) { return q !== p; }); S.newId = 0; renderPicks(); drawOverlay(); };
      pm.appendChild(nm); pm.appendChild(xy); pm.appendChild(fm); el.appendChild(sw); el.appendChild(pm); el.appendChild(x); box.appendChild(el);
    });
    $('pickCount').textContent = S.picks.length; $('clearPicks').disabled = !S.picks.length; $('empty').hidden = !!S.picks.length;
    renderExport();
  }

  /* ---------- export ---------- */
  function colors() { return S.src === 'pal' ? S.pal : S.picks; }
  function renderExport() {
    var n = colors().length, f = S.fmt;
    ['srcSeg', 'fmtSeg'].forEach(function (id) {
      Array.prototype.forEach.call($(id).querySelectorAll('button'), function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.v === (id === 'srcSeg' ? S.src : S.fmt)));
      });
    });
    $('expBtn').textContent = 'Export ' + f.toUpperCase() + ' ↓';
    $('expBtn').disabled = !n; $('copyBtn').disabled = !n || f === 'png';
    $('expNote').textContent = n ? n + ' color' + (n > 1 ? 's' : '') + ' will be exported' + (f === 'png' ? ' as a swatch image.' : '.') : 'Nothing to export yet — pick some colors on the image first.';
  }
  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function text(fmt) {
    var cs = colors(), base = S.name.replace(/\.[^.]+$/, '') || 'image';
    if (fmt === 'json') {
      return JSON.stringify({
        tool: 'Image Color Picker', image: { name: S.name, width: S.ow, height: S.oh }, source: S.src === 'pal' ? 'extracted palette' : 'picked colors',
        colors: cs.map(function (c) {
          var o = { hex: hex(c), rgb: { r: c.r, g: c.g, b: c.b }, hsl: hsl(c), cmyk: cmyk(c), name: nameOf(c).replace('≈ ', '') };
          if (c.pct != null) o.share = Math.round(c.pct * 1000) / 10;
          if (c.x != null) o.position = { x: c.x, y: c.y };
          return o;
        })
      }, null, 2);
    }
    if (fmt === 'txt') {
      return cs.map(function (c) { var f = fmts(c); return [f.hex, f.rgb, f.hsl, f.cmyk, nameOf(c)].join('  '); }).join('\n') + '\n';
    }
    return '/* Palette from ' + S.name + ' */\n:root {\n' + cs.map(function (c, i) { return '  --color-' + (i + 1) + ': ' + hex(c) + '; /* ' + nameOf(c) + ' */'; }).join('\n') + '\n}\n';
  }
  function rr(x, a, b, w, h, r) {
    x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
  }
  function png(cs) {
    var cols = Math.min(cs.length, 6), rows = Math.ceil(cs.length / cols), cw = 200, bh = 190, ch = 292, pad = 28, gap = 20;
    var c = document.createElement('canvas'); c.width = pad * 2 + cols * cw + (cols - 1) * gap; c.height = pad * 2 + rows * ch + (rows - 1) * gap;
    var x = c.getContext('2d'), sans = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    x.fillStyle = '#0D0F17'; x.fillRect(0, 0, c.width, c.height);
    cs.forEach(function (col, i) {
      var ox = pad + (i % cols) * (cw + gap), oy = pad + Math.floor(i / cols) * (ch + gap);
      x.fillStyle = '#171A27'; rr(x, ox, oy, cw, ch, 18); x.fill();
      x.fillStyle = hex(col); rr(x, ox + 8, oy + 8, cw - 16, bh, 12); x.fill();
      x.fillStyle = '#F4F3FF'; x.font = '600 20px ' + sans; x.fillText(hex(col), ox + 16, oy + bh + 42);
      x.fillStyle = '#A0A3B8'; x.font = '14px ' + sans; x.fillText(nameOf(col), ox + 16, oy + bh + 64);
      x.fillText('rgb(' + col.r + ', ' + col.g + ', ' + col.b + ')', ox + 16, oy + bh + 82 - 0);
    });
    return c;
  }
  function doExport() {
    var cs = colors(); if (!cs.length) return;
    var base = (S.name.replace(/\.[^.]+$/, '') || 'image') + '-' + (S.src === 'pal' ? 'palette' : 'colors');
    if (S.fmt === 'png') {
      png(cs).toBlob(function (b) { if (b) { dl(b, base + '.png'); toast('Exported PNG', 'ok'); } else toast('Couldn’t create the PNG.', 'err'); }, 'image/png');
    } else {
      var mime = { json: 'application/json', txt: 'text/plain', css: 'text/css' }[S.fmt];
      dl(new Blob([text(S.fmt)], { type: mime + ';charset=utf-8' }), base + '.' + S.fmt);
      toast('Exported ' + S.fmt.toUpperCase(), 'ok');
    }
  }

  /* ---------- events ---------- */
  function bind() {
    var fi = $('fileInput');
    fi.addEventListener('change', function () { if (fi.files[0]) loadFile(fi.files[0]); fi.value = ''; });
    $('replaceBtn').addEventListener('click', function () { fi.click(); });
    var depth = 0, ovl = document.querySelector('.overlay');
    window.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') > -1) { depth++; ovl.classList.toggle('on', S.has); $('drop').classList.add('over'); } });
    window.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) { ovl.classList.remove('on'); $('drop').classList.remove('over'); } });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) {
      e.preventDefault(); depth = 0; ovl.classList.remove('on'); $('drop').classList.remove('over');
      if (e.dataTransfer && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });
    document.addEventListener('paste', function (e) {
      var it = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < it.length; i++) if (it[i].kind === 'file' && it[i].type.indexOf('image/') === 0) { e.preventDefault(); loadFile(it[i].getAsFile()); return; }
    });
    var rb = $('resetBtn'), rt;
    rb.addEventListener('click', function () {
      if (rb.classList.contains('confirm')) { location.reload(); return; }
      rb.classList.add('confirm'); rb.textContent = 'Click again to confirm';
      rt = setTimeout(function () { rb.classList.remove('confirm'); rb.textContent = '↻ New project'; }, 3500);
    });
    rb.addEventListener('blur', function () { clearTimeout(rt); rb.classList.remove('confirm'); rb.textContent = '↻ New project'; });

    var down = false;
    cv.addEventListener('pointerdown', function (e) { if (e.button) return; down = true; S.hov = true; try { cv.setPointerCapture(e.pointerId); } catch (x) {} var p = clampPt(e); hover(p.x, p.y); });
    cv.addEventListener('pointermove', function (e) { S.hov = true; var p = clampPt(e); hover(p.x, p.y); });
    cv.addEventListener('pointerleave', function () { if (!down) { S.hov = false; drawOverlay(); } });
    cv.addEventListener('pointerup', function (e) { if (!down) return; down = false; var p = clampPt(e); hover(p.x, p.y); pick(p.x, p.y); if (e.pointerType !== 'mouse') { S.hov = false; drawOverlay(); } });
    cv.addEventListener('pointercancel', function () { down = false; });
    cv.addEventListener('keydown', function (e) {
      var s = e.shiftKey ? 10 : 1, d = { ArrowLeft: [-s, 0], ArrowRight: [s, 0], ArrowUp: [0, -s], ArrowDown: [0, s] }[e.key];
      if (d) { e.preventDefault(); S.hov = true; hover(Math.max(0, Math.min(S.ow - 1, S.cur.x + d[0])), Math.max(0, Math.min(S.oh - 1, S.cur.y + d[1]))); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(S.cur.x, S.cur.y); }
    });
    var rq; window.addEventListener('resize', function () { cancelAnimationFrame(rq); rq = requestAnimationFrame(fit); });

    $('zoomSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; S.zoom = +b.dataset.n;
      Array.prototype.forEach.call($('zoomSeg').children, function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      if (S.cur) drawLoupe(S.cur.x, S.cur.y);
    });
    $('palN').addEventListener('input', function () { S.n = +this.value; $('palOut').textContent = this.value; if (S.has) buildPalette(); });
    $('addAll').addEventListener('click', function () {
      if (!S.pal.length) return;
      var room = 60 - S.picks.length; if (room <= 0) { toast('Picked list is full (60).', 'warn'); return; }
      S.pal.slice(0, room).forEach(addColor); renderPicks(); drawOverlay(); toast('Added palette to picked colors', 'ok');
    });
    $('clearPicks').addEventListener('click', function () { S.picks = []; S.newId = 0; renderPicks(); drawOverlay(); });
    $('srcSeg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { S.src = b.dataset.v; renderExport(); } });
    $('fmtSeg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { S.fmt = b.dataset.v; renderExport(); } });
    $('expBtn').addEventListener('click', doExport);
    $('copyBtn').addEventListener('click', function () { if (S.fmt !== 'png' && colors().length) copy(text(S.fmt), S.fmt.toUpperCase()); });
  }
  bind();
})();
