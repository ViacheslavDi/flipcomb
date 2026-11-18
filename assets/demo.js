// Flipcomb in the browser: the same field, pieces and rules as the app, for a few demo levels.
// Geometry follows Reference/prototype.html form() exactly. The field stands upright, as on iPhone.
(() => {
  const D = window.FLIPCOMB_DEMO, T = window.FLIPCOMB_TEXT || {};
  const ART_BASE = (document.currentScript && document.currentScript.src || "").replace(/demo\.js.*$/, "");
  const root = document.getElementById("demo");
  if (!D || !root) return;
  const canvas = root.querySelector("canvas"), ctx = canvas.getContext("2d");
  const SQ3 = Math.sqrt(3), W = D.W, H = D.H;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const img = name => { const i = new Image(); i.src = ART_BASE + name + ".webp"; i.onload = () => draw(); return i; };
  const ART = { cell: img("comb_cell"), drop: img("sym_drop"), ring: img("sym_ring"), jelly: D.pieces.map((_, i) => img("jelly_" + i)) };

  // A form of piece i after a flip and a rotation: [a, b, hasMark, symbol] in axial coordinates.
  function form(i, fl, r) {
    const cs = D.pieces[i].map(([a, b], k) => {
      const val = (((b % 2) + 2) % 2 + fl + D.phi[i]) % 2;
      let x = fl ? b : a, y = fl ? a : b;
      for (let t = 0; t < r; t++) [x, y] = [-y, x + y];
      return [x, y, D.marked[i][k], val];
    });
    const ma = Math.min(...cs.map(c => c[0])), mb = Math.min(...cs.map(c => c[1]));
    return cs.map(c => [c[0] - ma, c[1] - mb, c[2], c[3]]);
  }
  const colOf = (a, b) => a + (b >> 1);
  const axialOf = (c, r) => [c - (r >> 1), r];
  // On a tall screen the field stands upright (flat x,y turned by 90 degrees), as on iPhone; on a wide one it lies flat,
  // as on iPad, and the art is turned to match, exactly like the app does.
  const flat = (a, b) => [SQ3 * (a + b / 2), 1.5 * b];
  const place = (a, b, ox, oy, R) => { const [x, y] = flat(a, b); return G.upright ? [ox - y * R, oy + x * R] : [ox + x * R, oy + y * R]; };
  function fromScreen(px, py) {
    const x = G.upright ? (py - G.oy) / G.R : (px - G.ox) / G.R, y = G.upright ? -(px - G.ox) / G.R : (py - G.oy) / G.R;
    const b = y / 1.5, a = x / SQ3 - b / 2;
    let ra = Math.round(a), rb = Math.round(b), rc = Math.round(-a - b);
    const da = Math.abs(ra - a), db = Math.abs(rb - b), dc = Math.abs(rc + a + b);
    if (da > db && da > dc) ra = -rb - rc; else if (db > dc) rb = -ra - rc;
    return [ra, rb];
  }
  // Points of a form around its own centre, at radius R.
  function points(cells, R) {
    const p = cells.map(c => place(c[0], c[1], 0, 0, R));
    const cx = p.reduce((s, q) => s + q[0], 0) / p.length, cy = p.reduce((s, q) => s + q[1], 0) / p.length;
    return p.map(q => [q[0] - cx, q[1] - cy]);
  }

  let level = 0, L, S, G = {}, drag = null, won = false, toastTimer = 0;
  const anim = {}; // per piece: { spin, flip, pop }
  const saved = (() => { try { return +localStorage.getItem("flipcomb.demo") || 0; } catch (e) { return 0; } })();

  function load(n) {
    level = n; L = D.levels[n];
    const rnd = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)((L.n * 2654435761) >>> 0);
    S = { placed: {}, orient: {}, fixedAt: {} };
    L.answer.forEach((cells, i) => {
      if (L.fixed.includes(i)) cells.forEach(([c, r]) => { S.fixedAt[c + "," + r] = i; });
      else S.orient[i] = { fl: rnd() < .5 ? 1 : 0, r: Math.floor(rnd() * 6) };
    });
    won = false; drag = null;
    root.classList.remove("won");
    try { localStorage.setItem("flipcomb.demo", String(n)); } catch (e) { /* storage is optional */ }
    root.querySelector("[data-level]").textContent = (T.level || "Level {n}").replace("{n}", L.n);
    root.querySelectorAll("[data-step]").forEach((el, k) => el.classList.toggle("on", k <= n));
    intro = performance.now();
    layout(); info(); loop();
  }
  let intro = 0;

  function info() {
    const left = Object.keys(S.orient).filter(i => !S.placed[i]).length;
    root.querySelector("[data-left]").textContent = (T.left || "Pieces left: {n}").replace("{n}", left);
  }
  function toast(t) {
    const el = root.querySelector(".demo-toast");
    el.textContent = t; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }
  function occupied() {
    const o = Object.assign({}, S.fixedAt);
    for (const i in S.placed) S.placed[i].forEach(([c, r]) => { o[c + "," + r] = +i; });
    return o;
  }
  // The one rule check, as in the app: on the field, nothing under it, the symbol on the same symbol.
  function check(cells) {
    const o = occupied();
    for (const [c, r, mk, v] of cells) {
      if (c < 0 || r < 0 || c >= W || r >= H) return T.out || "The piece does not fit on the field.";
      if ((c + "," + r) in o) return T.overlap || "Another piece is already there.";
      if (mk && (r % 2) !== v) return T.symbol || "The symbol does not match. Move or flip the piece.";
    }
    return null;
  }

  function layout() {
    const box = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = box.width, ch = box.height, wide = cw > ch * 1.05;
    G.upright = !wide;
    const fieldW = 1.5 * (H - 1) + 2, fieldH = SQ3 * (W + .5); // upright, in units of R
    let R, tray;
    if (wide) {
      // Lying flat: 9 cells across, 6 rows down; the pieces wait to the right.
      R = Math.min((cw * .66) / fieldH, (ch - 12) / fieldW);
      G.ox = SQ3 / 2 * R + 6; G.oy = R + (ch - fieldW * R) / 2;
      tray = { x: fieldH * R + 24, y: 6, w: cw - fieldH * R - 30, h: ch - 12 };
    } else {
      R = Math.min((cw - 6) / fieldW, (ch * .64) / fieldH);
      const left = (cw - fieldW * R) / 2;
      G.ox = left + fieldW * R - R; G.oy = SQ3 / 2 * R + 2;
      tray = { x: 4, y: fieldH * R + 16, w: cw - 8, h: ch - fieldH * R - 20 };
    }
    Object.assign(G, { R, tray, cw, ch, wide });
    layoutTray();
  }
  // Each waiting piece gets a slot big enough for all its turns, so turning never shifts the tray.
  function layoutTray() {
    const ids = Object.keys(S.orient).map(Number), t = G.tray, n = ids.length;
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols), w = t.w / cols, h = t.h / rows, side = Math.min(w, h);
      if (!best || side > best.side) best = { cols, rows, side, w, h };
    }
    let reach = 0;
    ids.forEach(i => { for (let fl = 0; fl < 2; fl++) for (let r = 0; r < 6; r++) points(form(i, fl, r), 1).forEach(p => { reach = Math.max(reach, Math.hypot(p[0], p[1])); }); });
    G.trayR = Math.min(G.R * .62, best.side / (2 * reach + 2.4));
    G.slot = {};
    ids.forEach((i, k) => {
      const row = Math.floor(k / best.cols), inRow = Math.min(best.cols, n - row * best.cols);
      const shift = (t.w - inRow * best.w) / 2;
      G.slot[i] = [t.x + shift + best.w * (k % best.cols + .5), t.y + best.h * (row + .5)];
    });
  }

  function hexPath(cx, cy, R) {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) { const ang = Math.PI / 3 * k + (G.upright ? 0 : Math.PI / 6), x = cx + R * Math.cos(ang), y = cy + R * Math.sin(ang); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath();
  }
  function sprite(image, cx, cy, R) {
    if (!image.complete || !image.naturalWidth) { hexPath(cx, cy, R); ctx.fillStyle = "#c78a1e"; ctx.fill(); return; }
    const w = R * 2.05, h = SQ3 * R * 1.04;
    if (G.upright) { ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h); return; }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 2); ctx.drawImage(image, -w / 2, -h / 2, w, h); ctx.restore();
  }
  function symbol(v, cx, cy, R) {
    const im = v === 0 ? ART.drop : ART.ring;
    if (!im.complete || !im.naturalWidth) return;
    const w = R * (v === 0 ? .74 : 1.04), h = R * (v === 0 ? 1.08 : .94);
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.85)"; ctx.shadowBlur = R * .18; ctx.shadowOffsetY = R * .05;
    ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h); ctx.restore();
  }
  // A piece drawn round its centre. spin turns the cells round the centre while each tile stays upright.
  function drawPiece(i, cells, cx, cy, R, o) {
    o = o || {};
    const pts = points(cells, R), a = (o.spin || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const sx = o.flip == null ? 1 : o.flip;
    const at = p => [cx + (p[0] * ca - p[1] * sa) * sx, cy + (p[0] * sa + p[1] * ca)];
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    if (o.shadow) { ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = R * .9; ctx.shadowOffsetY = R * .5; }
    pts.forEach(p => { const [x, y] = at(p); hexPath(x, y, R * 1.1); ctx.fillStyle = "#120801"; ctx.fill(); });
    ctx.shadowColor = "transparent";
    pts.forEach(p => { const [x, y] = at(p); ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(.02, Math.abs(sx)), 1); sprite(ART.jelly[i], 0, 0, R); ctx.restore(); });
    cells.forEach((c, k) => {
      if (!c[2]) return;
      const [x, y] = at(pts[k]);
      ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(.02, Math.abs(sx)), 1);
      ctx.filter = "brightness(.55)"; sprite(ART.jelly[i], 0, 0, R * .66); ctx.filter = "none";
      symbol(c[3], 0, 0, R * .98); ctx.restore();
    });
    if (o.ring) pts.forEach(p => { const [x, y] = at(p); hexPath(x, y, R); ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = 2; ctx.stroke(); });
    ctx.restore();
  }
  function fieldCenter(cells) {
    const p = cells.map(([c, r]) => { const [a, b] = axialOf(c, r); return place(a, b, G.ox, G.oy, G.R); });
    return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  }
  const asAxial = cells => cells.map(([c, r, mk, v]) => { const [a, b] = axialOf(c, r); return [a, b, mk, v]; });

  function draw() {
    if (!L) return;
    const now = performance.now(), t0 = reduce ? 1e9 : now - intro, R = G.R;
    ctx.clearRect(0, 0, G.cw, G.ch);
    // The tray.
    const t = G.tray;
    ctx.save(); ctx.fillStyle = "rgba(10,5,1,.55)"; ctx.strokeStyle = "rgba(255,190,80,.22)"; ctx.lineWidth = 1;
    roundRect(t.x, t.y, t.w, t.h, 18); ctx.fill(); ctx.stroke(); ctx.restore();
    // Field cells in a quick ripple, deep so the jelly and symbols stand out.
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const [a, b] = axialOf(c, r), [x, y] = place(a, b, G.ox, G.oy, R);
      const k = Math.min(1, Math.max(0, (t0 - (c + r) * 28) / 260));
      if (k <= 0) continue;
      ctx.save(); ctx.globalAlpha = k; ctx.translate(x, y); ctx.scale(.7 + .3 * ease(k), .7 + .3 * ease(k));
      ctx.filter = "brightness(.5) sepia(.25)"; sprite(ART.cell, 0, 0, R); ctx.filter = "none";
      symbol(r % 2, 0, 0, R); ctx.restore();
    }
    const fixedK = Math.min(1, Math.max(0, (t0 - 380) / 320));
    L.answer.forEach((cells, i) => {
      if (!L.fixed.includes(i) || fixedK <= 0) return;
      const [cx, cy] = fieldCenter(cells);
      drawPiece(i, asAxial(cells.map(([c, r]) => [c, r, 0, 0])), cx, cy - (1 - ease(fixedK)) * R, R, { alpha: fixedK });
    });
    for (const i in S.placed) {
      if (drag && drag.id === +i && drag.moved) continue;
      const [cx, cy] = fieldCenter(S.placed[i]), pop = anim[i] && anim[i].pop || 0;
      const s = 1 + .08 * Math.sin(Math.min(1, pop) * Math.PI);
      drawPiece(+i, asAxial(S.placed[i]), cx, cy, R * s);
    }
    // Waiting pieces slide in.
    const trayK = Math.min(1, Math.max(0, (t0 - 650) / 420));
    for (const i in G.slot) {
      if (S.placed[i] || (drag && drag.id === +i && drag.moved)) continue;
      const [sx, sy] = G.slot[i], a = anim[i] || {}, o = S.orient[i], sel = drag && drag.id === +i;
      drawPiece(+i, form(+i, o.fl, o.r), sx + (1 - ease(trayK)) * 60, sy, G.trayR * (sel ? 1.12 : 1) * (1 + (a.lift || 0)), { spin: a.spin || 0, flip: a.flip, alpha: trayK, shadow: sel });
    }
    if (drag && drag.moved) {
      const snap = snapCells();
      if (snap) {
        const err = check(snap);
        ctx.save();
        snap.forEach(([c, r, mk]) => {
          if (c < 0 || r < 0 || c >= W || r >= H) return;
          const [a, b] = axialOf(c, r), [x, y] = place(a, b, G.ox, G.oy, R);
          hexPath(x, y, R * .96); ctx.lineWidth = 3; ctx.strokeStyle = err ? "rgba(255,110,90,.95)" : "rgba(120,240,150,.95)"; ctx.stroke();
          if (mk) { hexPath(x, y, R * .3); ctx.fillStyle = err ? "rgba(255,110,90,.85)" : "rgba(120,240,150,.85)"; ctx.fill(); }
        });
        ctx.restore();
      }
      const o = S.orient[drag.id];
      drawPiece(drag.id, form(drag.id, o.fl, o.r), drag.x, drag.y, R, { shadow: true, alpha: .96 });
    }
    if (won) drawWin(now);
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const ease = k => 1 - Math.pow(1 - k, 3);

  // A sweep of light over the comb and a wave through the cells.
  function drawWin(now) {
    const k = (now - won) / 1400; if (k > 1.6) return;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      const [a, b] = axialOf(c, r), [x, y] = place(a, b, G.ox, G.oy, G.R);
      const d = k * 14 - (c + (H - r)) * .9, glow = Math.max(0, 1 - Math.abs(d) / 2.2);
      if (glow <= 0) continue;
      hexPath(x, y, G.R * .95); ctx.fillStyle = `rgba(255,200,90,${.42 * glow})`; ctx.fill();
    }
    ctx.restore();
  }

  function snapCells() {
    const o = S.orient[drag.id], f = form(drag.id, o.fl, o.r), pts = points(f, G.R);
    const [ra, rb] = fromScreen(drag.x + pts[0][0], drag.y + pts[0][1]);
    const da = ra - f[0][0], db = rb - f[0][1];
    const cells = f.map(c => { const A = c[0] + da, B = c[1] + db; return [colOf(A, B), B, c[2], c[3]]; });
    if (cells.every(([c, r]) => c < -1 || r < -1 || c > W || r > H)) return null;
    return cells;
  }

  let raf = 0;
  function loop() { cancelAnimationFrame(raf); const step = () => { draw(); if (busy()) raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }
  const busy = () => true; // cheap enough: one small canvas, only while the section is on screen
  const seen = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) loop(); else cancelAnimationFrame(raf); }));
  seen.observe(canvas);

  function tween(i, key, from, to, ms, done) {
    const a = anim[i] = anim[i] || {}, start = performance.now();
    if (reduce) { a[key] = to; done && done(); return; }
    const step = now => { const k = Math.min(1, (now - start) / ms); a[key] = from + (to - from) * ease(k); if (k < 1) requestAnimationFrame(step); else done && done(); };
    requestAnimationFrame(step);
  }
  // Turn: the cells travel a smooth 60 degrees, then the form changes with nothing jumping.
  function rotate(i) {
    const a = anim[i] = anim[i] || {}; if (a.busy) return; a.busy = true;
    tween(i, "spin", 0, 60, 240, () => { S.orient[i].r = (S.orient[i].r + 1) % 6; a.spin = 0; a.busy = false; });
  }
  // Flip: a card turn. At edge-on the piece becomes its mirror and its symbol swaps.
  function flip(i) {
    const a = anim[i] = anim[i] || {}; if (a.busy) return; a.busy = true;
    tween(i, "lift", 0, .12, 180);
    tween(i, "flip", 1, 0, 180, () => {
      S.orient[i] = mirrored(i, S.orient[i]);
      tween(i, "lift", .12, 0, 320);
      tween(i, "flip", 0, 1, 320, () => { a.flip = null; a.busy = false; });
    });
  }

  // The other side, turned so that it is exactly the left-right mirror of what is on screen, as the card turn shows.
  function mirrored(i, o) {
    const key = cells => points(cells, 1).map(([x, y], k) => [Math.round(x * 100), Math.round(y * 100), cells[k][2]]).sort((p, q) => p[0] - q[0] || p[1] - q[1]).join(";");
    const want = points(form(i, o.fl, o.r), 1).map(([x, y], k) => [Math.round(-x * 100), Math.round(y * 100), form(i, o.fl, o.r)[k][2]]).sort((p, q) => p[0] - q[0] || p[1] - q[1]).join(";");
    for (let r = 0; r < 6; r++) if (key(form(i, 1 - o.fl, r)) === want) return { fl: 1 - o.fl, r };
    return { fl: 1 - o.fl, r: o.r };
  }

  function at(e) { const q = canvas.getBoundingClientRect(); return [e.clientX - q.left, e.clientY - q.top]; }
  function hit(px, py) {
    const [a, b] = fromScreen(px, py), c = colOf(a, b);
    if (b >= 0 && b < H && c >= 0 && c < W) {
      for (const i in S.placed) if (S.placed[i].some(q => q[0] === c && q[1] === b)) return { id: +i, placed: true };
    }
    let best = null, bd = 1e9;
    for (const i in G.slot) {
      if (S.placed[i]) continue;
      const d = Math.hypot(px - G.slot[i][0], py - G.slot[i][1]);
      if (d < bd && d < G.trayR * 5) { bd = d; best = +i; }
    }
    return best == null ? null : { id: best, placed: false };
  }
  let lastTap = { id: -1, time: 0, timer: 0 };
  canvas.addEventListener("pointerdown", e => {
    if (won) return;
    const [px, py] = at(e), h = hit(px, py); if (!h) return;
    canvas.setPointerCapture(e.pointerId);
    const lift = e.pointerType === "touch" ? G.R * 2.2 : 0;
    drag = { id: h.id, placed: h.placed, sx: px, sy: py, x: px, y: py - lift, lift, moved: false };
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag) return; const [px, py] = at(e);
    if (!drag.moved && Math.hypot(px - drag.sx, py - drag.sy) > 7) {
      drag.moved = true; clearTimeout(lastTap.timer); lastTap.id = -1;
      if (drag.placed) delete S.placed[drag.id];
    }
    if (drag.moved) { drag.x = px; drag.y = py - drag.lift; }
  });
  canvas.addEventListener("pointerup", () => {
    if (!drag) return; const d = drag; drag = null;
    if (!d.moved) {
      if (d.placed) { delete S.placed[d.id]; info(); return; }
      // One tap turns, two quick taps flip.
      const now = performance.now();
      if (lastTap.id === d.id && now - lastTap.time < 300) { clearTimeout(lastTap.timer); lastTap.id = -1; flip(d.id); return; }
      clearTimeout(lastTap.timer);
      lastTap = { id: d.id, time: now, timer: setTimeout(() => { lastTap.id = -1; rotate(d.id); }, 300) };
      return;
    }
    const snap = snapCells.call(null, drag = d); drag = null;
    if (snap) {
      const err = check(snap);
      if (!err) { S.placed[d.id] = snap; tween(d.id, "pop", 0, 1, 260); buzz(12); }
      else { toast(err); buzz([8, 40, 8]); }
    }
    info(); checkWin();
  });
  canvas.addEventListener("pointercancel", () => { drag = null; });
  const buzz = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* optional */ } };

  function checkWin() {
    if (Object.keys(S.orient).some(i => !S.placed[i])) return;
    won = performance.now(); root.classList.add("won");
    const last = level >= D.levels.length - 1;
    root.querySelector("[data-win-title]").textContent = last ? (T.allDone || "You've got the knack.") : (T.win || "Comb filled!");
    root.querySelector("[data-win-text]").textContent = last ? (T.allDoneText || "") : (T.winText || "");
    root.querySelector("[data-next]").hidden = last;
    root.querySelector("[data-store]").hidden = !last;
    root.dispatchEvent(new CustomEvent("flipcomb:win", { bubbles: true, detail: { last } }));
  }
  root.querySelector("[data-restart]").addEventListener("click", () => load(level));
  root.querySelector("[data-next]").addEventListener("click", () => load(Math.min(level + 1, D.levels.length - 1)));
  root.querySelectorAll("[data-step]").forEach((el, k) => el.addEventListener("click", () => load(k)));
  new ResizeObserver(() => { layout(); }).observe(canvas);
  load(Math.min(saved, D.levels.length - 1));
  window.__flipcomb = { get state() { return S; }, get level() { return L; }, get geometry() { return G; }, fieldCenter, form, check, load };
})();
