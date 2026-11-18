// Page effects: the bar, reveals, the flying jelly, the comb wall, the counter, the bee on the river, languages.
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // Languages: the English page sends a visitor to their own language once; a choice in the menu is kept.
  const root = document.documentElement, langs = JSON.parse(root.dataset.langs || "[]");
  const base = root.dataset.base || "./";
  const pick = $("select.lang");
  if (pick) pick.addEventListener("change", () => {
    try { localStorage.setItem("flipcomb.lang", pick.value); } catch (e) { /* optional */ }
    location.href = base + (pick.value === "en" ? "" : pick.value + "/") + (root.dataset.page || "");
  });
  if (root.lang === "en" && root.dataset.auto === "1") {
    let want = new URLSearchParams(location.search).get("lang");
    try { want = want || localStorage.getItem("flipcomb.lang"); } catch (e) { /* optional */ }
    if (!want) {
      for (const l of navigator.languages || [navigator.language]) {
        const low = (l || "").toLowerCase();
        const hit = langs.find(x => x.toLowerCase() === low) || (low.startsWith("zh") ? (/(tw|hk|mo|hant)/.test(low) ? "zh-Hant" : "zh-Hans") : null)
          || (low.startsWith("pt") ? "pt-BR" : null) || langs.find(x => x.split("-")[0] === low.split("-")[0]);
        if (hit) { want = hit; break; }
      }
    }
    if (want && want !== "en" && langs.includes(want)) location.replace(base + want + "/" + (root.dataset.page || ""));
  }

  const top = $(".top");
  const onScroll = () => { if (top) top.classList.toggle("solid", scrollY > 40); };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .15 });
  $$(".reveal").forEach(el => io.observe(el));

  // Jelly cells fly at different depths and lean away from the pointer.
  const flyers = $$(".flyer");
  if (!reduce && flyers.length) {
    let mx = 0, my = 0, tx = 0, ty = 0;
    addEventListener("pointermove", e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
    const step = () => {
      tx += (mx - tx) * .06; ty += (my - ty) * .06;
      const sy = scrollY;
      flyers.forEach(f => { const d = +f.dataset.depth; f.style.setProperty("--px", (-tx * 90 * d) + "px"); f.style.setProperty("--py", (-ty * 70 * d - sy * .35 * d) + "px"); });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // The wall of comb behind "500": cells light up in slow waves.
  const wall = $(".combwall");
  if (wall) {
    const c = wall.getContext("2d"); let w, h, cells = [], on = false;
    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2); w = wall.clientWidth; h = wall.clientHeight;
      wall.width = w * dpr; wall.height = h * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const R = Math.max(26, w / 34); cells = [];
      for (let y = 0, row = 0; y < h + R * 2; y += R * 1.5, row++) for (let x = (row % 2) * R * .866; x < w + R * 2; x += R * 1.732) cells.push([x, y, Math.random()]);
      wall.R = R;
    };
    const hex = (x, y, R) => { c.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k + Math.PI / 6; c.lineTo(x + R * Math.cos(a), y + R * Math.sin(a)); } c.closePath(); };
    const draw = t => {
      c.clearRect(0, 0, w, h); const R = wall.R;
      for (const [x, y, s] of cells) {
        const wave = reduce ? .3 : Math.max(0, Math.sin(t / 900 - (x + y) / 260 + s * 1.2));
        hex(x, y, R * .92);
        c.fillStyle = `rgba(${200 + wave * 55},${110 + wave * 80},${10 + wave * 20},${.08 + wave * .32})`; c.fill();
        c.strokeStyle = "rgba(255,190,80,.25)"; c.lineWidth = 1.2; c.stroke();
      }
      if (on && !reduce) requestAnimationFrame(draw);
    };
    new IntersectionObserver(es => { on = es[0].isIntersecting; if (on) requestAnimationFrame(draw); }).observe(wall);
    addEventListener("resize", size); size(); draw(0);
  }

  // Count up to 500 when it comes into view.
  $$("[data-count]").forEach(el => {
    const end = +el.dataset.count;
    new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting) return; o.disconnect();
      if (reduce) { el.textContent = end; return; }
      const t0 = performance.now(), run = t => { const k = Math.min(1, (t - t0) / 1600); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 4))); if (k < 1) requestAnimationFrame(run); };
      requestAnimationFrame(run);
    }, { threshold: .4 }).observe(el);
  });

  // The bee rows along the river as the band scrolls through the screen.
  const band = $(".riverband"), bee = $(".bee");
  if (band && bee) {
    const tall = matchMedia("(max-width: 700px)");
    const move = () => {
      const path = JSON.parse((tall.matches ? band.dataset.tall : band.dataset.wide) || "[]");
      const r = band.getBoundingClientRect(), k = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
      const i = Math.min(path.length - 2, Math.floor(k * (path.length - 1))), f = k * (path.length - 1) - i;
      const [x0, y0] = path[i], [x1, y1] = path[i + 1];
      bee.style.setProperty("--bx", (x0 + (x1 - x0) * f) + "%"); bee.style.setProperty("--by", (y0 + (y1 - y0) * f) + "%");
      bee.style.scale = x1 < x0 - .2 ? "-1 1" : "1 1";
    };
    addEventListener("scroll", move, { passive: true }); move();
  }

  // The hero video plays only when motion is welcome.
  const v = $(".hero video");
  if (v && reduce) { v.pause(); v.removeAttribute("autoplay"); }
})();
