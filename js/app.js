/* ==========================================================
   Umzug Uster – Frontend-Logik (Demo, v2)
   Vanilla JS, keine Abhängigkeiten.
   ========================================================== */
(function () {
  'use strict';
  const CFG = Object.assign({ demo: false, endpoint: '', web3formsKey: '', gtmId: '', phone: {}, whatsapp: '', email: '', consentVersion: 'v1', confirmedPartnerRegions: [], leadValues: { A: 3, B: 2, C: 1 }, currency: 'CHF' }, window.UU_CONFIG || {});
  const SITE = window.UU_SITE || { pages: {} };
  const DOC = document.documentElement, BASE = DOC.dataset.base || '', SUF = DOC.dataset.suffix || '';
  if (CFG.demo !== false) DOC.classList.add('is-demo');
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, area) { try { return (area || localStorage).getItem(k); } catch (e) { return null; } },
    set(k, v, area) { try { (area || localStorage).setItem(k, v); } catch (e) { /* ignore */ } },
    del(k, area) { try { (area || localStorage).removeItem(k); } catch (e) { /* ignore */ } }
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Tracking / Consent ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied', wait_for_update: 500 });
  let gtmLoaded = false;
  const sentLeads = new Set();
  // Es werden nie personenbezogene Formulardaten in den dataLayer geschrieben.
  function track(event, params) {
    window.dataLayer.push(Object.assign({ event: event }, params || {}));
    if (window.console && console.debug) console.debug('[tracking]', event, params || '');
  }
  function loadGTM() {
    if (gtmLoaded || !CFG.gtmId) return;
    gtmLoaded = true;
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(CFG.gtmId);
    document.head.appendChild(s);
  }
  function applyConsent(mode) {
    if (mode === 'all') {
      gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' });
      loadGTM();
    }
  }
  const bar = $('#consentBar');
  const saved = store.get('uu_consent');
  if (saved) applyConsent(saved); else bar.hidden = false;
  $('#consentAll').addEventListener('click', () => { store.set('uu_consent', 'all'); applyConsent('all'); bar.hidden = true; });
  $('#consentNec').addEventListener('click', () => { store.set('uu_consent', 'nec'); bar.hidden = true; });
  $('#cookieLink').addEventListener('click', (e) => { e.preventDefault(); bar.hidden = false; });

  /* ---------- Kampagnenparameter (First Touch) ---------- */
  const CAMP_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid'];
  const campaign = (function () {
    let c = {};
    try { c = JSON.parse(store.get('uu_campaign', sessionStorage) || '{}'); } catch (e) { c = {}; }
    const q = new URLSearchParams(location.search);
    let changed = false;
    CAMP_KEYS.forEach((k) => { if (q.get(k) && !c[k]) { c[k] = q.get(k).slice(0, 200); changed = true; } });
    if (!c.landing_page) { c.landing_page = (location.pathname + location.search).slice(0, 300); c.referrer = (document.referrer || '').slice(0, 300); changed = true; }
    if (changed) store.set('uu_campaign', JSON.stringify(c), sessionStorage);
    return c;
  })();

  /* ---------- Router ---------- */
  const VIEWS = ['danke'];
  const TITLES = { danke: 'Vielen Dank für Ihre Umzugsanfrage', impressum: 'Impressum', datenschutz: 'Datenschutzerklärung' };
  const HOME_TITLE = document.title;
  const home = $('#home') || $('#main');
  let lastLead = null;
  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (VIEWS.includes(h)) {
      if (h === 'danke' && !lastLead) { history.replaceState(null, '', location.pathname + location.search); return route(); }
      home.hidden = true;
      VIEWS.forEach((v) => { const e = $('#' + v); if (e) e.hidden = v !== h; });
      document.title = TITLES[h] + ' | Umzug Uster';
      window.scrollTo(0, 0);
      return;
    }
    VIEWS.forEach((v) => { const e = $('#' + v); if (e) e.hidden = true; });
    const wasHidden = home.hidden;
    home.hidden = false;
    document.title = HOME_TITLE;
    const el = h && h !== 'top' ? document.getElementById(h) : null;
    if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    else if (wasHidden || h === 'top') window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ---------- Header ---------- */
  const burger = $('#burger'), mnav = $('#mnav'), header = $('#siteHeader');
  function setMenu(open) { mnav.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? 'Menü schliessen' : 'Menü öffnen'); }
  burger.addEventListener('click', () => setMenu(!mnav.classList.contains('open')));
  mnav.addEventListener('click', (e) => { if (e.target.closest('a,button')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  if ('IntersectionObserver' in window) {
    const ids = ['leistungen', 'familien', 'firmen', 'region', 'ablauf', 'kontakt'];
    const links = $$('.nav-links a');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id)); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ---------- Animation: wenige, ruhige Effekte ---------- */
  const FADE = '.trust__grid,.intro>div:last-child,.sit__head,.sit__item,.prob__left,.prob__list,.prob__statement,.svc__note,.flow__foot,.reg>div:first-child,.map,.fam__txt,.biz__grid>div:first-child,.cb,.channels,.faq__left,#faqList,.final .wrap';
  const WIPE = '.photo,.ph';
  const flow = $('#flow');
  const targets = [];
  $$(FADE).forEach((el) => { el.setAttribute('data-r', ''); targets.push(el); });
  $$(WIPE).forEach((el) => { el.setAttribute('data-r', 'wipe'); targets.push(el); });
  if (flow) targets.push(flow);
  if ('IntersectionObserver' in window && !reduceMotion) {
    const rio = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); } });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    targets.forEach((el) => rio.observe(el));
  } else targets.forEach((el) => el.classList.add('in'));

  /* Leistungsbereich: Titel Wort für Wort, Zeilen nacheinander */
  (function () {
    const head = $('.svc__head'), list = $('.svc__list');
    if (!head || !list) return;
    const h2 = $('h2', head);
    if (h2 && !reduceMotion) {
      const txt = h2.textContent.trim(); h2.setAttribute('aria-label', txt);
      h2.innerHTML = txt.split(' ').map((w, i) => '<span class="wd" aria-hidden="true"><span style="--i:' + i + '">' + esc(w) + '</span></span>').join(' ');
    }
    $$('.svc', list).forEach((li, i) => li.style.setProperty('--i', i));
    head.classList.add('svc-anim'); list.classList.add('svc-anim');
    if (reduceMotion || !('IntersectionObserver' in window)) { head.classList.add('in'); list.classList.add('in'); return; }
    const o = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); o.unobserve(e.target); } }), { rootMargin: '0px 0px -15% 0px' });
    o.observe(head); o.observe(list);
  })();

  const hero = $('#hero');
  function startHero() {
    if (!hero) return;
    $$('[data-h]', hero).forEach((el, i) => { if (reduceMotion) el.classList.add('in'); else setTimeout(() => el.classList.add('in'), 120 + i * 90); });
    hero.classList.add('go');
  }

  /* ---------- Intro: Logo und Slogan beim ersten Laden ---------- */
  const splash = $('#splash'), root = document.documentElement;
  if (splash && root.classList.contains('splashing')) {
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      try { sessionStorage.setItem('uu_splash', '1'); } catch (e) {}
      splash.classList.add('out');
      root.classList.remove('splashing');
      setTimeout(startHero, 250);
      setTimeout(() => splash.remove(), 1000);
    };
    setTimeout(close, 2300);
    splash.addEventListener('click', close);
    window.addEventListener('keydown', close, { once: true });
  } else {
    if (splash) splash.remove();
    startHero();
  }

  const layer = $('#heroLayer'), photo = $('.hero__bg');
  let ticking = false;
  function onScroll() {
    ticking = false;
    header.classList.toggle('scrolled', window.scrollY > 40);
    if (layer && !reduceMotion) {
      const r = photo.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) layer.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - window.innerHeight / 2) * -0.05).toFixed(1) + 'px,0)';
    }
  }
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------- FAQ-Akkordeon (Inhalt steht statisch im HTML) ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.acc__q'); if (!b) return;
    b.setAttribute('aria-expanded', String(b.getAttribute('aria-expanded') !== 'true'));
  });

  /* ---------- Kontaktkanäle ---------- */
  (function channels() {
    const box = $('#channels'); if (!box) return;
    const waText = 'Guten Tag, ich plane einen Umzug in Uster beziehungsweise Umgebung und würde gerne mehr über Ihren Umzugsservice erfahren.';
    const items = [
      { ev: 'phone_click', title: 'Telefonischer Kontakt', val: CFG.phone && CFG.phone.display, href: CFG.phone && CFG.phone.tel ? 'tel:' + CFG.phone.tel : '', sub: CFG.phone && CFG.phone.display },
      { ev: 'whatsapp_click', wa: true, title: 'WhatsApp-Anfrage', val: CFG.whatsapp, href: CFG.whatsapp ? 'https://wa.me/' + CFG.whatsapp.replace(/\D/g, '') + '?text=' + encodeURIComponent(waText) : '', sub: 'Nachricht ist bereits vorausgefüllt' },
      { ev: 'email_click', title: 'E-Mail-Kontakt', val: CFG.email, href: CFG.email ? 'mailto:' + CFG.email : '', sub: CFG.email }
    ];
    items.filter((it) => it.val && it.href).forEach((it) => {
      const on = true;
      const el = document.createElement(on ? 'a' : 'div');
      el.className = 'ch' + (on ? '' : ' off');
      if (on) { el.href = it.href; if (it.wa) { el.target = '_blank'; el.rel = 'noopener'; } el.addEventListener('click', () => track(it.ev)); }
      el.innerHTML = '<span><b>' + it.title + (on ? '' : '') + '</b><span>' + (on ? esc(it.sub) : 'Wird erst angezeigt, wenn eingerichtet und freigegeben.') + '</span></span>' + (on ? '<svg class="icon"><use href="#i-arrow"/></svg>' : '');
      box.appendChild(el);
    });
  })();

  /* ---------- Orte, Karte, Regionenprüfung ---------- */
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\bzh\b/g, '').replace(/[^a-z0-9]/g, '');
  // PLZ-Zuordnung: vor Go-live prüfen (siehe docs/README.md)
  const PLACES = [
    { n: 'Uster', plz: ['8610'], id: 198, main: true, grp: 'ort' },
    { n: 'Nänikon', plz: ['8606'], grp: 'ort' },
    { n: 'Wermatswil', plz: ['8615'], grp: 'ort' },
    { n: 'Werrikon', plz: ['8610'], grp: 'ort' },
    { n: 'Riedikon', plz: ['8610'], grp: 'ort' },
    { n: 'Freudwil', plz: ['8610'], grp: 'ort' },
    { n: 'Sulzbach', plz: ['8614'], grp: 'ort' },
    { n: 'Greifensee', plz: ['8606'], id: 194, grp: 'gem' },
    { n: 'Volketswil', plz: ['8604'], id: 199, grp: 'gem' },
    { n: 'Wetzikon', plz: ['8620', '8621', '8622', '8623'], id: 121, grp: 'gem' },
    { n: 'Mönchaltorf', plz: ['8617'], id: 196, grp: 'gem' },
    { n: 'Maur', plz: ['8124'], id: 195, grp: 'gem' },
    { n: 'Egg', plz: ['8132'], id: 192, grp: 'gem' },
    { n: 'Pfäffikon ZH', plz: ['8330'], id: 177, grp: 'gem' },
    { n: 'Dübendorf', plz: ['8600'], id: 191, grp: 'gem' },
    // Weitere Gemeinden des Zürcher Oberlands (nur über die Karte wählbar). PLZ vor Go-live prüfen.
    { n: 'Hinwil', plz: ['8340'], id: 117, grp: 'map' },
    { n: 'Bäretswil', plz: ['8344'], id: 111, grp: 'map' },
    { n: 'Dürnten', plz: ['8635'], id: 113, grp: 'map' },
    { n: 'Bubikon', plz: ['8608'], id: 112, grp: 'map' },
    { n: 'Rüti ZH', plz: ['8630'], id: 118, grp: 'map' },
    { n: 'Wald ZH', plz: ['8636'], id: 120, grp: 'map' },
    { n: 'Gossau ZH', plz: ['8625'], id: 115, grp: 'map' },
    { n: 'Grüningen', plz: ['8627'], id: 116, grp: 'map' },
    { n: 'Seegräben', plz: ['8607'], id: 119, grp: 'map' },
    { n: 'Fehraltorf', plz: ['8320'], id: 172, grp: 'map' },
    { n: 'Hittnau', plz: ['8335'], id: 173, grp: 'map' },
    { n: 'Russikon', plz: ['8332'], id: 178, grp: 'map' },
    { n: 'Lindau', plz: ['8315'], id: 176, grp: 'map' },
    { n: 'Illnau-Effretikon', plz: ['8307', '8308'], id: 296, grp: 'map' },
    { n: 'Weisslingen', plz: ['8484'], id: 180, grp: 'map' },
    { n: 'Wila', plz: ['8492'], id: 181, grp: 'map' },
    { n: 'Wildberg', plz: [], id: 182, grp: 'map' },
    { n: 'Bauma', plz: ['8494'], id: 297, grp: 'map' },
    { n: 'Fischenthal', plz: ['8496', '8497', '8498'], id: 114, grp: 'map' }
  ];
  const USTER = { n: 'Uster', plz: '8610' };
  const byPlz = (z) => PLACES.find((p) => p.plz.includes(z)) || null;
  const byName = (s) => { const k = norm(s || ''); return k ? PLACES.find((p) => norm(p.n) === k) || null : null; };
  const dl = $('#orte'); if (dl) dl.innerHTML = PLACES.map((p) => '<option value="' + esc(p.n) + '"></option>').join('');

  const regIn = $('#regIn'), regOut = $('#regOut');
  const findPlace = (q) => { q = q.trim(); if (!q) return null; return /^\d{4}$/.test(q) ? byPlz(q) : byName(q); };
  const isConfirmed = (p) => { const list = (CFG.confirmedPartnerRegions || []).map((s) => norm(String(s))); return list.includes(norm(p.n)) || p.plz.some((z) => list.includes(z)); };
  function checkRegion(q) {
    q = (q || '').trim();
    regOut.className = 'reg__result show'; regOut.innerHTML = '';
    if (!q) { regOut.classList.add('warn'); regOut.textContent = 'Bitte geben Sie eine Postleitzahl oder einen Wohnort ein.'; return; }
    const isPlz = /^\d{4}$/.test(q);
    if (isPlz && (+q < 1000 || +q > 9658)) { regOut.classList.add('warn'); regOut.textContent = 'Diese Postleitzahl scheint keine gültige Schweizer PLZ zu sein.'; return; }
    const p = findPlace(q);
    let html;
    if (p && isConfirmed(p)) html = '<b>' + esc(p.n) + ':</b> Für diesen Ort sind Umzugspartner hinterlegt. Stellen Sie Ihre Anfrage, wir unterstützen Sie bei den nächsten Schritten.';
    else if (p) html = '<b>' + esc(p.n) + '</b> gehört zu unserem regionalen Einzugsgebiet. Ob wir Ihren Umzug in diesem Ort selbst durchführen oder ein Partnerunternehmen beiziehen, klären wir individuell, sobald Ihre Anfrage vorliegt.';
    else { regOut.classList.add('warn'); html = '<b>«' + esc(q) + '»</b> liegt nicht in unserem Kerngebiet Uster und Zürcher Oberland. Sie können trotzdem anfragen. Wir prüfen individuell, was möglich ist.'; }
    const pre = p ? { ort: p.n, plz: isPlz ? q : (p.plz[0] || '') } : (isPlz ? { ort: '', plz: q } : { ort: q, plz: '' });
    const pg = p && SITE.pages && SITE.pages[p.n];
    regOut.innerHTML = html + '<br><button class="btn btn-primary btn-sm" type="button" id="regGo">Anfrage mit diesem Ort starten</button>' + (pg ? ' <a class="link-arrow" href="' + (/^https?:/.test(pg) ? pg : BASE + pg + '/' + SUF) + '"' + (/^https?:/.test(pg) ? ' target="_blank" rel="noopener"' : '') + '>Mehr zu Umzug in ' + esc(p.n) + '</a>' : '');
    $('#regGo').addEventListener('click', () => openWizard({ region: pre }));
  }
  const regFormEl = $('#regForm'); if (regFormEl) regFormEl.addEventListener('submit', (e) => { e.preventDefault(); checkRegion(regIn.value); });
  function fillTags(id, grp) {
    const ul = $(id); if (!ul) return;
    PLACES.filter((p) => p.grp === grp).forEach((p) => {
      const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.textContent = p.n;
      b.addEventListener('click', () => { regIn.value = p.n; checkRegion(p.n); }); li.appendChild(b); ul.appendChild(li);
    });
  }
  fillTags('#tagsOrt', 'ort'); fillTags('#tagsGem', 'gem');
  (function drawMap() {
    const M = window.UU_MAP, svg = $('#realMap');
    if (!M || !svg) return;
    const NS = 'http://www.w3.org/2000/svg';
    const el = (n, at, par) => { const e = document.createElementNS(NS, n); Object.keys(at || {}).forEach((k) => e.setAttribute(k, at[k])); if (par) par.appendChild(e); return e; };
    const byId = {}; PLACES.forEach((p) => { if (p.id) byId[p.id] = p; });
    const gMun = el('g', { class: 'm-mun' }, svg), gLake = el('g', { class: 'm-lake' }, svg), gLbl = el('g', { class: 'm-lbl' }, svg);
    const paths = {};
    const pick = (p, node) => { regIn.value = p.n; checkRegion(p.n); Object.keys(paths).forEach((k) => paths[k].classList.remove('sel')); node.classList.add('sel'); node.parentNode.appendChild(node); };
    M.gem.forEach((g) => {
      const p = byId[g.id];
      const path = el('path', { d: g.d, class: 'mun t-' + g.t + (p ? ' act' : '') }, gMun);
      if (!p) return;
      paths[g.id] = path;
      path.setAttribute('tabindex', '0'); path.setAttribute('role', 'button'); path.setAttribute('aria-label', p.n + ' in die Regionenprüfung übernehmen');
      const tt = el('title', {}, path); tt.textContent = p.n;
      path.addEventListener('click', () => pick(p, path));
      path.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(p, path); } });
    });
    M.lakes.forEach((l) => { el('path', { d: l.d, class: 'lake' }, gLake); });
    const OFF = { 'Greifensee': [-12, -4, 'end'], 'Seegräben': [0, 12] }, HIDE = { 'Schwerzenbach': 1, 'Wallisellen': 1, 'Zürich': 1 };
    M.gem.filter((g) => g.n && !HIDE[g.n] && g.cx > 4 && g.cx < M.w - 4 && g.cy > 4 && g.cy < M.h - 4).forEach((g) => {
      const o = OFF[g.n] || [0, 0, 'middle'];
      const t = el('text', { x: g.cx + o[0], y: g.cy + o[1] + 4, class: 'lb lb-' + g.t, 'text-anchor': o[2] || 'middle' }, gLbl);
      t.textContent = g.n;
    });
    M.lakes.forEach((l) => {
      if (l.n === 'Greifensee') { const t = el('text', { x: l.cx + 2, y: l.cy + 4, class: 'lb-lake', transform: 'rotate(58 ' + l.cx + ' ' + l.cy + ')', 'text-anchor': 'middle' }, gLbl); t.textContent = 'GREIFENSEE'; }
      else { const t = el('text', { x: 150, y: 520, class: 'lb-lake', 'text-anchor': 'middle', transform: 'rotate(38 150 520)' }, gLbl); t.textContent = 'ZÜRICHSEE'; }
    });
    const km = 5 / 111.32 * M.k, sx = 20, sy = M.h - 22;
    const sc = el('g', { class: 'm-scale' }, svg);
    el('path', { d: 'M' + sx + ' ' + (sy - 5) + 'V' + sy + 'H' + (sx + km) + 'V' + (sy - 5) }, sc);
    const st = el('text', { x: sx + km / 2, y: sy - 8, 'text-anchor': 'middle' }, sc); st.textContent = '5 km';
    const na = el('g', { class: 'm-scale', transform: 'translate(' + (M.w - 28) + ' 30)' }, svg);
    el('path', { d: 'M0 -14 L6 6 L0 2 L-6 6 Z', class: 'na' }, na);
    const nt = el('text', { x: 0, y: 20, 'text-anchor': 'middle' }, na); nt.textContent = 'N';
    const u = paths[198]; if (u) u.classList.add('is-home');
  })();

  /* ==========================================================
     Anfrage-Wizard
     ========================================================== */
  const SIT = { nach: 'Umzug nach Uster', region: 'Umzug innerhalb der Region', weg: 'Umzug von Uster weg', firma: 'Firmenumzug', einzel: 'Einzeltransport', sonst: 'Sonstige Anfrage' };
  const STEPS = [{ k: 'was_planen_sie', l: 'Art' }, { k: 'umzugsstrecke', l: 'Strecke' }, { k: 'haushalt', l: 'Haushalt' }, { k: 'zusatzleistungen', l: 'Leistungen' }, { k: 'persoenliche_angaben', l: 'Kontakt' }];
  const dlg = $('#wizard'), form = $('#leadForm');
  const wizNext = $('#wizNext'), wizBack = $('#wizBack'), wizSubmit = $('#wizSubmit'), wizErr = $('#wizErr'), wizNote = $('#wizNote'), wizNav = $('#wizNav');
  let step = 1, maxStep = 1, formStarted = false, submitting = false, kind = '', selectedService = '', step5At = 0, completed = false, idemKey = '', pendingRegion = null, draftChecked = false;
  const auto = { from: false, to: false };

  const val = (n) => ((form.elements[n] && form.elements[n].value) || '').trim();
  const radio = (n) => { const r = form.querySelector('input[name="' + n + '"]:checked'); return r ? r.value : ''; };
  const setRadio = (n, v) => { $$('input[name="' + n + '"]', form).forEach((r) => { r.checked = r.value === v; }); };
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const uid = (p) => { const d = new Date(); const yy = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const buf = new Uint8Array(5); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(buf); else for (let i = 0; i < 5; i++) buf[i] = Math.random() * 255; let r = ''; buf.forEach((b) => { r += a[b % a.length]; }); return p + '-' + yy + '-' + r; };
  const fmtDate = (d) => { if (!d) return ''; const p = d.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; };

  function normPhone(s) {
    let t = String(s || '').replace(/[\s().\-\/]/g, '');
    if (t.startsWith('+41')) t = t.slice(3); else if (t.startsWith('0041')) t = t.slice(4); else if (t.startsWith('0')) t = t.slice(1); else return null;
    return /^[1-9]\d{8}$/.test(t) ? '+41' + t : null;
  }
  const okPlz = (s) => /^\d{4}$/.test(s) && +s >= 1000 && +s <= 9658;
  const okMail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  const itemsFlow = () => ['einzel', 'sonst'].includes(radio('situation'));
  const needsB2B = () => radio('situation') === 'firma' || (!itemsFlow() && radio('household') === 'Unternehmen');

  /* --- Regeln pro Feld (eine Stelle für alle Validierungen) --- */
  const RULES = {
    situation: () => (radio('situation') ? '' : 'Bitte wählen Sie eine Option.'),
    fromOrt: () => (val('fromOrt').length < 2 ? 'Bitte geben Sie Ihren aktuellen Wohnort an.' : ''),
    fromPlz: () => (okPlz(val('fromPlz')) ? '' : 'Bitte 4-stellige PLZ.'),
    toOrt: () => (val('toOrt').length < 2 ? 'Bitte geben Sie Ihren neuen Wohnort an.' : ''),
    toPlz: () => (okPlz(val('toPlz')) ? '' : 'Bitte 4-stellige PLZ.'),
    date: () => { const d = val('date'); if (!d) return radio('flex') === 'Ja' ? '' : 'Bitte Datum wählen oder Termin als flexibel markieren.'; return d < todayStr() ? 'Das Datum liegt in der Vergangenheit.' : ''; },
    household: () => (itemsFlow() || radio('household') ? '' : 'Bitte wählen Sie eine Option.'),
    items: () => (!itemsFlow() || val('items').length >= 5 ? '' : 'Bitte kurz beschreiben, was transportiert werden soll.'),
    company: () => (needsB2B() && val('company').length < 2 ? 'Bitte Firmenname angeben.' : ''),
    workstations: () => { const w = val('workstations'); return w && (!(+w >= 1) || +w > 5000) ? 'Bitte eine gültige Zahl angeben.' : ''; },
    firstName: () => (val('firstName').length < 2 ? 'Bitte Vornamen angeben.' : ''),
    lastName: () => (val('lastName').length < 2 ? 'Bitte Nachnamen angeben.' : ''),
    phone: () => (normPhone(val('phone')) ? '' : 'Bitte eine Schweizer Nummer angeben, z. B. 079 123 45 67.'),
    email: () => (okMail(val('email')) ? '' : 'Bitte eine gültige E-Mail-Adresse angeben.'),
    consent: () => (form.elements.consent.checked ? '' : 'Bitte bestätigen Sie die Datenschutzhinweise.')
  };
  const FIELDS = { 1: ['situation'], 2: ['fromOrt', 'fromPlz', 'toOrt', 'toPlz', 'date'], 3: ['household', 'items', 'company', 'workstations'], 4: [], 5: ['firstName', 'lastName', 'phone', 'email', 'consent'] };

  function showErr(name, msg, scope) {
    const root = scope || form;
    const el = root.querySelector('[data-err="' + name + '"]'); if (el) el.textContent = msg || '';
    const inp = root.querySelector('[name="' + name + '"]');
    if (inp && inp.type !== 'radio' && inp.type !== 'checkbox') { if (msg) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid'); }
  }
  function clearErrs(scope) { $$('[data-err]', scope || form).forEach((e) => { e.textContent = ''; }); $$('[aria-invalid]', scope || form).forEach((e) => e.removeAttribute('aria-invalid')); wizErr.textContent = ''; }
  function validate(n, silent) {
    const errs = {};
    FIELDS[n].forEach((f) => { const m = RULES[f](); if (m) errs[f] = m; });
    if (!silent) {
      const section = form.querySelector('[data-step="' + n + '"]');
      clearErrs(section);
      FIELDS[n].forEach((f) => showErr(f, errs[f] || '', section));
      const first = Object.keys(errs)[0];
      if (first) { const f = section.querySelector('[name="' + first + '"]'); if (f) f.focus(); }
    }
    return Object.keys(errs).length === 0;
  }
  // Live-Validierung: beim Verlassen eines Feldes, danach bei jeder Eingabe
  form.addEventListener('focusout', (e) => { const n = e.target.name; if (RULES[n] && e.target.type !== 'radio' && e.target.type !== 'checkbox' && (e.target.value || e.target.dataset.touched)) { e.target.dataset.touched = '1'; showErr(n, RULES[n]()); } });
  form.addEventListener('input', (e) => { const n = e.target.name; if (RULES[n] && e.target.dataset.touched) showErr(n, RULES[n]()); });
  form.addEventListener('change', (e) => { const n = e.target.name; if (n === 'flex' && form.querySelector('[data-err="date"]').textContent) showErr('date', RULES.date()); if (e.target.type === 'radio' || e.target.type === 'checkbox') showErr(n, RULES[n] ? RULES[n]() : ''); });

  /* --- Wizard-Navigation (Fortschritt, klickbar für bereits besuchte Schritte) --- */
  function renderNav() {
    wizNav.innerHTML = STEPS.map((s, i) => { const n = i + 1; const cls = n === step ? 'cur' : (n <= maxStep ? 'done' : ''); return '<li><button type="button" class="' + cls + '" data-to="' + n + '" aria-label="Schritt ' + n + ': ' + s.l + '"' + (n === step ? ' aria-current="step"' : '') + (n > maxStep ? ' tabindex="-1" disabled' : '') + '></button></li>'; }).join('');
  }
  wizNav.addEventListener('click', (e) => { const b = e.target.closest('button[data-to]'); if (!b || b.disabled) return; jump(+b.dataset.to); });
  function jump(n) {
    if (n < step) return goTo(n);
    for (let i = step; i < n; i++) { if (!validate(i, true)) { goTo(i); validate(i); return; } }
    goTo(n);
  }

  function applySmartPrefill() {
    const s = radio('situation'); const want = { from: null, to: null };
    if (s === 'nach') want.to = USTER; else if (s === 'weg' || s === 'region') want.from = USTER;
    ['from', 'to'].forEach((k) => {
      const o = form.elements[k + 'Ort'], p = form.elements[k + 'Plz'];
      if (want[k]) { if ((!o.value && !p.value) || auto[k]) { o.value = want[k].n; p.value = want[k].plz; auto[k] = true; } }
      else if (auto[k]) { o.value = ''; p.value = ''; auto[k] = false; }
    });
    if (pendingRegion) {
      const k = s === 'nach' ? 'to' : 'from';
      const o = form.elements[k + 'Ort'], p = form.elements[k + 'Plz'];
      if ((!o.value && !p.value) || auto[k]) { o.value = pendingRegion.ort || ''; p.value = pendingRegion.plz || ''; auto[k] = false; }
      pendingRegion = null;
    }
  }
  // PLZ <-> Ort ergänzen sich gegenseitig
  form.addEventListener('input', (e) => {
    const n = e.target.name; if (!n) return;
    if (n === 'fromPlz' || n === 'toPlz') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    const m = /^(from|to)(Ort|Plz)$/.exec(n);
    if (m) {
      auto[m[1]] = false;
      if (m[2] === 'Plz' && e.target.value.length === 4 && !val(m[1] + 'Ort')) { const p = byPlz(e.target.value); if (p) form.elements[m[1] + 'Ort'].value = p.n; }
    }
  });
  form.addEventListener('change', (e) => {
    const m = /^(from|to)Ort$/.exec(e.target.name);
    if (m && !val(m[1] + 'Plz')) { const p = byName(e.target.value); if (p) { form.elements[m[1] + 'Plz'].value = p.plz[0]; } }
  });

  function updateStep3() {
    const items = itemsFlow();
    $('#hhBox').hidden = items; $('#itemsBox').hidden = !items; $('#b2b').hidden = !needsB2B();
    $('#t3').textContent = items ? 'Was soll transportiert werden?' : 'Ihr Haushalt';
    $('#t3lead').textContent = items ? 'Eine kurze Beschreibung genügt.' : 'Damit wir den Umfang einschätzen können.';
  }
  function summaryRows() {
    const rows = [['Art', SIT[radio('situation')] || '', 1], ['Strecke', [val('fromPlz'), val('fromOrt')].join(' ').trim() + '  →  ' + [val('toPlz'), val('toOrt')].join(' ').trim(), 2],
      ['Termin', (val('date') ? fmtDate(val('date')) : '') + (radio('flex') === 'Ja' ? (val('date') ? ' · ' : '') + 'flexibel' : ''), 2]];
    rows.push(itemsFlow() ? ['Beschreibung', val('items'), 3] : ['Haushalt', radio('household') + (needsB2B() && val('company') ? ' · ' + val('company') : ''), 3]);
    const sv = $$('input[name="services"]:checked', form).map((c) => c.value);
    rows.push(['Leistungen', sv.length ? sv.join(', ') : 'Keine Angabe', 4]);
    return rows;
  }
  function renderSummary() {
    $('#wizSummary').innerHTML = '<dl>' + summaryRows().map((r) => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd><button type="button" class="chg" data-goto="' + r[2] + '">Ändern</button>').join('') + '</dl>';
  }
  $('#wizSummary').addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) goTo(+b.dataset.goto); });

  function goTo(n) {
    step = n; maxStep = Math.max(maxStep, n);
    $$('.wiz__step', form).forEach((s) => s.classList.toggle('on', +s.dataset.step === n));
    $('#wizStep').textContent = 'Schritt ' + n + ' von 5 · ' + STEPS[n - 1].l;
    wizBack.style.visibility = n === 1 ? 'hidden' : 'visible';
    wizNext.hidden = n === 5; wizSubmit.hidden = n !== 5;
    if (n === 2) applySmartPrefill();
    if (n === 3) { if (radio('situation') === 'firma' && !radio('household')) setRadio('household', 'Unternehmen'); updateStep3(); }
    if (n === 5) { step5At = Date.now(); $('#wizDemo').hidden = !!(CFG.endpoint || CFG.web3formsKey); renderSummary(); }
    renderNav(); saveDraft();
    const h = form.querySelector('[data-step="' + n + '"] h3'); $('#wizBody').scrollTop = 0; if (h) h.focus({ preventScroll: true });
    wizErr.textContent = '';
  }

  /* --- Entwurf: Eingaben bleiben bei Schliessen/Neuladen (nur Browser-Sitzung) --- */
  function serialize() {
    const o = {};
    $$('input,select,textarea', form).forEach((el) => {
      if (!el.name || ['consent', 'website'].includes(el.name)) return;
      if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else if (el.type === 'checkbox') { if (el.checked) (o[el.name] = o[el.name] || []).push(el.value); }
      else if (el.value) o[el.name] = el.value;
    });
    return o;
  }
  let saveT = 0;
  function saveDraft() { clearTimeout(saveT); saveT = setTimeout(() => { if (completed) return; const v = serialize(); if (Object.keys(v).length) store.set('uu_draft', JSON.stringify({ v: v, step: step, max: maxStep, kind: kind }), sessionStorage); }, 250); }
  form.addEventListener('input', saveDraft); form.addEventListener('change', saveDraft);
  function restoreDraft() {
    let d; try { d = JSON.parse(store.get('uu_draft', sessionStorage) || 'null'); } catch (e) { d = null; }
    if (!d || !d.v) return null;
    Object.keys(d.v).forEach((k) => {
      const v = d.v[k];
      $$('[name="' + k + '"]', form).forEach((el) => {
        if (el.type === 'radio') el.checked = el.value === v;
        else if (el.type === 'checkbox') el.checked = Array.isArray(v) && v.includes(el.value);
        else el.value = v;
      });
    });
    kind = d.kind || kind; maxStep = d.max || 1;
    return d;
  }

  function resetForm() { form.reset(); clearErrs(); $$('[data-touched]', form).forEach((e) => delete e.dataset.touched); completed = false; idemKey = ''; kind = ''; selectedService = ''; maxStep = 1; auto.from = auto.to = false; wizNote.textContent = ''; store.del('uu_draft', sessionStorage); }

  function parseLoc(s) {
    s = (s || '').trim(); if (!s) return { ort: '', plz: '' };
    let m = s.match(/^(\d{4})\s*(.*)$/); if (m) return { plz: m[1], ort: m[2].trim() };
    m = s.match(/^(.*?)[\s,]+(\d{4})$/); if (m) return { ort: m[1].trim(), plz: m[2] };
    return { ort: s, plz: '' };
  }
  function inferSituation(f, t) {
    const pf = findPlace(f.plz || f.ort), pt = findPlace(t.plz || t.ort);
    const hasF = f.ort || f.plz, hasT = t.ort || t.plz;
    if (!hasF || !hasT) return '';
    if (pt && pt.n === 'Uster' && !pf) return 'nach';
    if (pf && pt) return 'region';
    if (pf && !pt) return 'weg';
    return '';
  }

  function openWizard(o) {
    o = o || {};
    if (completed) resetForm();
    let draft = null;
    if (!draftChecked) { draftChecked = true; draft = restoreDraft(); if (draft) wizNote.innerHTML = 'Ihre bisherigen Eingaben wurden wiederhergestellt. <button type="button" class="link-arrow" id="wizReset" style="font-size:.86rem">Neu beginnen</button>'; }
    if (o.situation) setRadio('situation', o.situation);
    if (o.kind) kind = o.kind;
    if (o.quick) {
      const f = parseLoc(o.quick.from), t = parseLoc(o.quick.to);
      if (f.ort) form.elements.fromOrt.value = f.ort; if (f.plz) form.elements.fromPlz.value = f.plz;
      if (t.ort) form.elements.toOrt.value = t.ort; if (t.plz) form.elements.toPlz.value = t.plz;
      if (f.plz && !f.ort && byPlz(f.plz)) form.elements.fromOrt.value = byPlz(f.plz).n;
      if (t.plz && !t.ort && byPlz(t.plz)) form.elements.toOrt.value = byPlz(t.plz).n;
      if (o.quick.date) form.elements.date.value = o.quick.date;
      if (!radio('situation')) { const inf = inferSituation(f, t); if (inf) setRadio('situation', inf); }
    }
    if (o.region) pendingRegion = o.region;
    if (o.service) {
      o.service.split(',').forEach((s) => { const c = form.querySelector('input[name="services"][value="' + s + '"]'); if (c && !c.checked) { c.checked = true; $('#svcNone').checked = false; track('service_selected', { service_name: s, source: 'cta' }); } });
      selectedService = o.service;
    }
    if (!formStarted) { formStarted = true; track('form_start', { situation: o.situation || '', service: o.service || '' }); }
    const forced = o.situation || o.quick || o.region || o.service;
    let start = 1;
    if (draft && !forced) start = Math.min(draft.step || 1, 5);
    else if (radio('situation')) start = validate(2, true) ? (maxStep < 3 ? 3 : maxStep) : 2;
    if (start > 1) maxStep = Math.max(maxStep, start);
    if (!dlg.open) { dlg.showModal(); document.body.style.overflow = 'hidden'; }
    goTo(start);
  }
  wizNote.addEventListener('click', (e) => { if (e.target.id === 'wizReset') { resetForm(); goTo(1); } });
  dlg.addEventListener('close', () => { document.body.style.overflow = ''; });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  $('#wizClose').addEventListener('click', () => dlg.close());

  wizNext.addEventListener('click', () => {
    if (!validate(step)) return;
    track('form_step_completed', { step_number: step, step_name: STEPS[step - 1].k, situation: radio('situation') });
    goTo(step + 1);
  });
  wizBack.addEventListener('click', () => { if (step > 1) goTo(step - 1); });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'household' || e.target.name === 'situation') { updateStep3(); if (e.target.name === 'situation') applySmartPrefill(); }
    if (e.target.name === 'services') {
      const none = $('#svcNone');
      if (e.target === none && none.checked) $$('input[name="services"]', form).forEach((c) => { if (c !== none) c.checked = false; });
      else if (e.target !== none && e.target.checked) none.checked = false;
      if (e.target.checked) track('service_selected', { service_name: e.target.value, source: 'form' });
    }
  });
  form.addEventListener('submit', (e) => { e.preventDefault(); if (step < 5) wizNext.click(); else submitLead(); });

  /* Lead-Score (0 bis 100): hilft bei der Priorisierung und beim Conversion-Wert. Gleiche Formel serverseitig in api/lead.php. */
  function leadScore(p) {
    let s = 0;
    if (p.date) { const d = (new Date(p.date) - Date.now()) / 864e5; s += d < 0 ? 0 : d <= 60 ? 25 : d <= 120 ? 15 : 5; }
    if (p.from.plz && p.to.plz) s += 15;
    if (p.household || p.items) s += 10;
    if (p.floor || p.lift) s += 5;
    if (p.services.length) s += 5;
    if (p.contact.phone) s += 15;
    if (p.contact.email) s += 10;
    if (p.customerType === 'B2B') s += 10;
    if (p.message && p.message.length > 20) s += 5;
    return Math.min(100, s);
  }
  const leadTier = (s) => (s >= 70 ? 'A' : s >= 45 ? 'B' : 'C');
  function buildPayload() {
    const services = $$('input[name="services"]:checked', form).map((c) => c.value);
    const b2b = needsB2B(), items = itemsFlow();
    const payload = {
      type: 'lead', idempotencyKey: idemKey || (idemKey = uid('K')), createdAt: new Date().toISOString(),
      customerType: b2b ? 'B2B' : 'B2C', situationCode: radio('situation'), situation: SIT[radio('situation')], requestKind: kind || null,
      from: { plz: val('fromPlz'), ort: val('fromOrt') }, to: { plz: val('toPlz'), ort: val('toOrt') },
      date: val('date') || null, flexible: radio('flex') || null,
      household: items ? null : radio('household'), items: items ? val('items') : null, floor: val('floor') || null, lift: val('lift') || null, special: val('special') || null,
      company: b2b ? val('company') : null, workstations: b2b && val('workstations') ? +val('workstations') : null, businessRequirements: b2b ? val('bizReq') || null : null,
      services: services, contact: { firstName: val('firstName'), lastName: val('lastName'), phone: normPhone(val('phone')), email: val('email') },
      message: val('message') || null,
      consent: { given: true, version: CFG.consentVersion, timestamp: new Date().toISOString(), text: $('#privNote').textContent.trim() + ' ' + form.querySelector('.consent span').textContent.trim() },
      attribution: Object.assign({}, campaign, { selected_service: selectedService || null }),
      meta: { elapsedMs: step5At ? Date.now() - step5At : 0, website: val('website') }
    };
    return payload;
  }
  async function send(payload) {
    if (CFG.web3formsKey) {
      const c = payload.contact, f = payload.from, t = payload.to;
      const L = [
        'Neue Umzugsanfrage (' + payload.customerType + ', Lead ' + payload.leadTier + ', Score ' + payload.leadScore + ')',
        'Situation: ' + (payload.situation || '-'),
        'Von: ' + f.plz + ' ' + f.ort + '  nach: ' + t.plz + ' ' + t.ort,
        'Wunschtermin: ' + (payload.date || '-') + (payload.flexible ? ' (flexibel: ' + payload.flexible + ')' : ''),
        'Haushalt/Umfang: ' + (payload.household || payload.items || '-'),
        'Etage/Lift: ' + (payload.floor || '-') + ' / ' + (payload.lift || '-'),
        'Besonderes: ' + (payload.special || '-'),
        payload.company ? 'Firma: ' + payload.company + ' (Arbeitsplätze: ' + (payload.workstations || '-') + ')' : '',
        payload.businessRequirements ? 'Anforderungen: ' + payload.businessRequirements : '',
        'Leistungen: ' + ((payload.services || []).join(', ') || '-'),
        'Nachricht: ' + (payload.message || '-'),
        'Telefon: ' + c.phone + '  E-Mail: ' + c.email,
        'Einwilligung: ja (' + payload.consent.version + ', ' + payload.consent.timestamp + ')',
        'Quelle: ' + JSON.stringify(payload.attribution || {})
      ].filter(Boolean).join('\n');
      const ctrl2 = new AbortController(); const to2 = setTimeout(() => ctrl2.abort(), 15000);
      try {
        const r = await fetch('https://api.web3forms.com/submit', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: ctrl2.signal,
          body: JSON.stringify({ access_key: CFG.web3formsKey, subject: 'Umzugsanfrage ' + f.ort + ' → ' + t.ort + ' – ' + c.firstName + ' ' + c.lastName, from_name: 'Umzug Uster', name: c.firstName + ' ' + c.lastName, email: c.email, phone: c.phone, message: L }) });
        let d = null; try { d = await r.json(); } catch (e) { /* ignore */ }
        if (!r.ok || !d || d.success !== true) throw new Error((d && d.message) || 'server');
        return { ok: true, leadId: payload.idempotencyKey };
      } finally { clearTimeout(to2); }
    }
    if (!CFG.endpoint) { await new Promise((r) => setTimeout(r, 700)); return { ok: true, demo: true, leadId: uid('UU') }; }
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(CFG.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal, credentials: 'same-origin' });
      let data = null; try { data = await res.json(); } catch (e) { /* ignore */ }
      if (!res.ok || !data || data.ok !== true || !data.leadId) throw new Error((data && data.message) || 'server');
      return data;
    } finally { clearTimeout(to); }
  }
  async function submitLead() {
    if (submitting) return;
    for (const n of [1, 2, 3, 5]) { if (!validate(n, true)) { goTo(n); validate(n); return; } }
    if (val('website')) { completed = true; dlg.close(); return; }
    submitting = true; wizSubmit.disabled = true; wizSubmit.textContent = 'Wird übermittelt …'; wizErr.textContent = '';
    const payload = buildPayload();
    payload.leadScore = leadScore(payload); payload.leadTier = leadTier(payload.leadScore);
    try {
      const res = await send(payload);
      if (!sentLeads.has(res.leadId)) { sentLeads.add(res.leadId); track('generate_lead', { lead_id: res.leadId, event_id: res.leadId, customer_type: payload.customerType, situation: payload.situationCode, lead_tier: payload.leadTier, lead_score: payload.leadScore, value: (CFG.leadValues || {})[payload.leadTier] || 1, currency: CFG.currency || 'CHF', page_path: location.pathname, demo: !!res.demo }); }
      completed = true; store.del('uu_draft', sessionStorage); lastLead = { id: res.leadId, demo: !!res.demo, payload: payload };
      renderThanks(lastLead); dlg.close(); location.hash = 'danke'; track('virtual_pageview', { page_path: '/danke/', page_title: 'Danke für Ihre Anfrage' });
    } catch (err) {
      wizErr.textContent = err.name === 'AbortError'
        ? 'Die Übermittlung hat zu lange gedauert. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut. Ihre Angaben sind weiterhin erfasst.'
        : 'Ihre Anfrage konnte nicht übermittelt werden. Bitte versuchen Sie es in einem Moment erneut. Ihre Angaben sind weiterhin erfasst.';
    } finally { submitting = false; wizSubmit.disabled = false; wizSubmit.textContent = 'Meine Umzugsanfrage übermitteln'; }
  }
  function renderThanks(l) {
    const p = l.payload; $('#thLead').textContent = l.id; $('#demoNote').hidden = !l.demo;
    const rows = [
      ['Anfrage', p.situation + (p.customerType === 'B2B' ? ' (Unternehmen)' : '')],
      ['Von', [p.from.plz, p.from.ort].filter(Boolean).join(' ')], ['Nach', [p.to.plz, p.to.ort].filter(Boolean).join(' ')],
      ['Wunschtermin', (p.date ? fmtDate(p.date) : '') + (p.flexible === 'Ja' ? (p.date ? ' · ' : '') + 'flexibel' : '')],
      [p.items ? 'Beschreibung' : 'Haushalt', p.items || (p.household + (p.floor ? ' · ' + p.floor : '') + (p.lift ? ' · Lift: ' + p.lift : ''))]
    ];
    if (p.company) rows.push(['Firma', p.company + (p.workstations ? ' · ' + p.workstations + ' Arbeitsplätze' : '')]);
    rows.push(['Zusätzliche Leistungen', p.services.length ? p.services.join(', ') : 'Keine Angabe']);
    rows.push(['Kontakt', p.contact.firstName + ' ' + p.contact.lastName + ' · ' + p.contact.phone + ' · ' + p.contact.email]);
    $('#thSum').innerHTML = rows.filter((r) => r[1]).map((r) => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('');
  }

  /* ---------- CTAs ---------- */
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]'); if (!b) return;
    e.preventDefault(); setMenu(false);
    openWizard({ situation: b.dataset.situation || '', service: b.dataset.service || '', kind: b.dataset.kind || '', region: b.dataset.ort ? { ort: b.dataset.ort, plz: b.dataset.plz || '' } : null });
  });
  const quickFormEl = $('#quickForm');
  if (quickFormEl) quickFormEl.addEventListener('submit', (e) => {
    e.preventDefault(); const f = e.target;
    const sit = (f.querySelector('input[name="q_sit"]:checked') || {}).value || '';
    openWizard({ situation: sit, quick: { from: f.q_from.value, to: f.q_to.value, date: f.q_date.value } });
  });
  const qd = $('#q_date'); if (qd) qd.min = todayStr();
  const fd = $('#f_date'); if (fd) fd.min = todayStr();

  /* ---------- Rückruf ---------- */
  $$('form.cbform').forEach((cb) => {
  const CB_RULES = {
    name: () => ((cb.elements.name.value || '').trim().length < 2 ? 'Bitte geben Sie Ihren Namen an.' : ''),
    tel: () => (normPhone(cb.elements.tel.value) ? '' : 'Bitte eine Schweizer Nummer angeben.'),
    consent: () => (cb.elements.consent.checked ? '' : 'Bitte stimmen Sie der Bearbeitung zu.')
  };
  cb.addEventListener('focusout', (e) => { const n = e.target.name; if (CB_RULES[n] && e.target.type !== 'checkbox' && e.target.value) showErr(n, CB_RULES[n](), cb); });
  cb.addEventListener('submit', async (e) => {
    e.preventDefault();
    let ok = true; clearErrs(cb);
    Object.keys(CB_RULES).forEach((k) => { const m = CB_RULES[k](); if (m) { showErr(k, m, cb); ok = false; } });
    if (!ok) return;
    if ((cb.elements.website.value || '').trim()) return;
    const g = (n) => (cb.elements[n].value || '').trim();
    const btn = $('.cb-btn', cb); btn.disabled = true; const orig = btn.innerHTML; btn.textContent = 'Wird übermittelt …';
    const payload = { type: 'callback', idempotencyKey: uid('K'), createdAt: new Date().toISOString(), contact: { name: g('name'), phone: normPhone(g('tel')) }, preferredTime: (cb.elements.time ? g('time') : ''), consent: { given: true, version: CFG.consentVersion, timestamp: new Date().toISOString() }, attribution: campaign, meta: { website: '' }, source: { path: location.pathname, form: cb.dataset.src || 'kontakt' } };
    try {
      const res = await send(payload);
      track('callback_request', { lead_id: res.leadId, demo: !!res.demo });
      const okEl = $('.cb-ok', cb); okEl.hidden = false; okEl.className = 'cb-ok reg__result show';
      okEl.innerHTML = '<b>Vielen Dank.</b> Wir haben Ihre Rückrufanfrage erhalten (Nr. ' + esc(res.leadId) + ').' + (res.demo ? '<br><b>Vorschau:</b> Es wurden keine Daten gespeichert.' : '');
      cb.reset(); $('.cb-err', cb).textContent = '';
    } catch (err) { $('.cb-err', cb).textContent = 'Ihre Rückrufanfrage konnte nicht übermittelt werden. Bitte versuchen Sie es erneut.'; }
    finally { btn.disabled = false; btn.innerHTML = orig; }
  });

  });

  /* ---------- Schnellkontakt: Telefon und E-Mail, nur wenn konfiguriert ---------- */
  (function quick() {
    const sec = $('#mbar .sec');
    if (sec && CFG.phone && CFG.phone.tel) { sec.href = 'tel:' + CFG.phone.tel; sec.textContent = 'Anrufen'; sec.addEventListener('click', () => track('phone_click', { source: 'mbar' })); }
    $$('[data-mail]').forEach((el) => { if (CFG.email) { el.href = 'mailto:' + CFG.email; el.textContent = CFG.email; el.hidden = false; el.addEventListener('click', () => track('email_click', { source: 'page' })); } });
    $$('[data-tel]').forEach((el) => { if (CFG.phone && CFG.phone.tel) { el.href = 'tel:' + CFG.phone.tel; el.textContent = CFG.phone.display || CFG.phone.tel; el.hidden = false; el.addEventListener('click', () => track('phone_click', { source: 'page' })); } });
  })();

  route();
})();
