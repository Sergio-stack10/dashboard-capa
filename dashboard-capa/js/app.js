'use strict';
/* =====================================================================
   Dashboard capacitaire – Roadmap Auchan
   Données : localStorage « capaData » sinon data/data.json (+ data/roadmap.json + data/prevision.json + data/planning.json)
   Onglets : p1 Roadmap (besoin & capacité — modèle RM S46+) · p4 Prévision (Webhelp — jour & 30 min) ·
             p2 Capacitaire (actes & heures, répartition journalière pondérée par la prévision) ·
             p3 Capa prévu vs Capa réel (planning) · p5 Productivité (sections Phone/Mail/Chat) ·
             p8 Planification (feuille Planning — personnes par jour & créneaux 30 min)
   Filtres globaux (tous les onglets) : Granularité · Flux (FO/BO/Autres, multi) ·
   Channel (PHONE/MAIL/CHAT, multi) · Activités (multi) · Période · Intervalle de période.
   Structure : Front office = PHONE (Hyper, C2E, AFR, Drive, SAV, Direct) · Back office = MAIL (Hyper, AFR, Drive) · Autres = CHAT.
   ===================================================================== */

/* ---------- constantes ---------- */
const LS = 'capaData';
const RFLOW = ['HYPER', 'C2E', 'AFR', 'DRIVE', 'SAV'];                       // flux du réalisé (DRM)
const RCOL  = { HYPER:'#3b5bdb', C2E:'#0ca678', AFR:'#f59f00', DRIVE:'#7048e8', SAV:'#e8590c' };
const PAL   = ['#3b5bdb','#0ca678','#f59f00','#7048e8','#e8590c','#1098ad','#d6336c','#74b816'];
const FLOWS8 = ['Voix Hyper','Voix C2E','Voix AFR','Voix Drive','Voix SAV','Mail Hyper','Mail AFR','Mail Drive'];
const MOIS  = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const JJ    = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

/* ---------- filtres globaux (communs à tous les onglets) ----------
   Flux : FO / BO / AU — Channel : PHONE / MAIL / CHAT — Activités : base (Hyper, AFR, …)
   Cascade : Flux -> Channels possibles -> Activités possibles ; sélection multi par chips. */
const FLUX_CH  = { FO: ['PHONE'], BO: ['MAIL'], AU: ['CHAT'] };
const FLUX_LBL = { FO: 'Front office', BO: 'Back office', AU: 'Autres' };
const CH_ACTS  = { PHONE: ['Hyper', 'C2E', 'AFR', 'Drive', 'SAV', 'Direct'],
                   MAIL: ['Hyper', 'AFR', 'Drive'], CHAT: ['Chat', 'Borne/LSA'] };
const ACT_CAP  = { hyper: 'Hyper', c2e: 'C2E', afr: 'AFR', drive: 'Drive', sav: 'SAV', direct: 'Direct' };
const GF_LS = 'capaGF';
let GF = { g: 'jour', flux: [], chan: [], acts: [], per: 'all', a: '', b: '' };
function gfLoad() { try { const s = JSON.parse(localStorage.getItem(GF_LS)); if (s && typeof s === 'object') GF = Object.assign(GF, s); } catch (e) {} }
function gfSave() { try { localStorage.setItem(GF_LS, JSON.stringify(GF)); } catch (e) {} }
function effFluxSet() { return new Set(GF.flux.length ? GF.flux : Object.keys(FLUX_CH)); }
function effChanSet() {
  const allow = new Set();
  effFluxSet().forEach(f => (FLUX_CH[f] || []).forEach(c => allow.add(c)));
  return new Set(GF.chan.length ? GF.chan.filter(c => allow.has(c)) : [...allow]);
}
function chanOfAct(a) { const s = norm(a);
  if (s.includes('mail')) return 'MAIL';
  if (s.includes('chat')) return 'CHAT';
  if (s.includes('borne') || s.includes('lsa')) return 'CHAT';
  return 'PHONE'; }
function actKeyOf(a) { const s = norm(a);
  if (s.includes('borne') || s.includes('lsa')) return 'Borne/LSA';
  if (s.includes('chat')) return 'Chat';
  for (const x in ACT_CAP) if (s.includes(x)) return ACT_CAP[x];
  return String(a).trim(); }
function gfPass(a, chanHint) {                       // une activité passe-t-elle les filtres globaux ?
  if (!a) return true;
  const ch = chanHint || chanOfAct(a);
  if (!effChanSet().has(ch)) return false;
  if (GF.acts.length) return GF.acts.includes(actKeyOf(a));
  return true;
}
function gfLbl() {                                   // libellé du périmètre choisi
  const bits = [];
  GF.flux.forEach(f => bits.push(FLUX_LBL[f]));
  if (GF.chan.length && !GF.flux.length) GF.chan.forEach(c => bits.push(c));
  if (GF.acts.length) bits.push(GF.acts.join(' + '));
  return bits.length ? bits.join(' · ') : 'Total';
}
function gfCascade() {
  const chanAllow = new Set(); effFluxSet().forEach(f => (FLUX_CH[f] || []).forEach(c => chanAllow.add(c)));
  GF.chan = GF.chan.filter(c => chanAllow.has(c));
  const actAllow = new Set(); effChanSet().forEach(c => (CH_ACTS[c] || []).forEach(a => actAllow.add(a)));
  GF.acts = GF.acts.filter(a => actAllow.has(a));
}
function gfRender() {
  const fx = $('gfFlux'), cx = $('gfChan'), ax = $('gfActs');
  fx.innerHTML = Object.keys(FLUX_CH).map(f =>
    `<button type="button" class="chipbtn${GF.flux.includes(f) ? ' on' : ''}" data-f="${f}">${FLUX_LBL[f]}</button>`).join('');
  const chanAllow = new Set(); effFluxSet().forEach(f => (FLUX_CH[f] || []).forEach(c => chanAllow.add(c)));
  cx.innerHTML = ['PHONE', 'MAIL', 'CHAT'].filter(c => chanAllow.has(c)).map(c =>
    `<button type="button" class="chipbtn${GF.chan.includes(c) ? ' on' : ''}" data-c="${c}">${c}</button>`).join('');
  const actAllow = new Set(); effChanSet().forEach(c => (CH_ACTS[c] || []).forEach(a => actAllow.add(a)));
  ax.innerHTML = [...actAllow].map(a =>
    `<button type="button" class="chipbtn${GF.acts.includes(a) ? ' on' : ''}" data-a="${a}">${a}</button>`).join('');
  fx.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.f;
    GF.flux = GF.flux.includes(f) ? GF.flux.filter(x => x !== f) : GF.flux.concat(f);
    gfCascade(); gfSave(); gfRender(); if (RENDERS[PAGE]) RENDERS[PAGE](); }));
  cx.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.c;
    GF.chan = GF.chan.includes(c) ? GF.chan.filter(x => x !== c) : GF.chan.concat(c);
    gfCascade(); gfSave(); gfRender(); if (RENDERS[PAGE]) RENDERS[PAGE](); }));
  ax.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.a;
    GF.acts = GF.acts.includes(a) ? GF.acts.filter(x => x !== a) : GF.acts.concat(a);
    gfSave(); gfRender(); if (RENDERS[PAGE]) RENDERS[PAGE](); }));
}
function gfDisables() {                              // filtres sans objet sur certains onglets
  const off = { p1: ['gfGW'], p4: ['gfGW', 'gfPW', 'gfIW'], p8: ['gfFW', 'gfCW', 'gfAW'] }[PAGE] || [];
  ['gfGW', 'gfFW', 'gfCW', 'gfAW', 'gfPW', 'gfIW'].forEach(id => $(id).classList.toggle('dis', off.includes(id)));
}
function syncGInputs() { $('gDa').value = GF.a || ''; $('gDb').value = GF.b || ''; }
function gfApplyPreset() {                           // Période (préréglages) -> Intervalle du/au
  if (GF.per === 'all') { GF.a = ''; GF.b = ''; syncGInputs(); return; }
  if (GF.per === 'custom') return;
  const bd = perBounds(PAGE), mx = bd[1] || new Date().toISOString().slice(0, 10);
  let a = '', b = '';
  if (GF.per === 'last') { a = mx.slice(0, 7) + '-01'; b = mx; }
  else if (GF.per === 'prev') {
    const pm = new Date(mx.slice(0, 7) + '-01T00:00:00'); pm.setMonth(pm.getMonth() - 1);
    const nx = new Date(pm); nx.setMonth(nx.getMonth() + 1); nx.setDate(0);
    a = pm.toISOString().slice(0, 10); b = nx.toISOString().slice(0, 10);
  }
  else if (GF.per === 'd7')  { a = addDays(mx, -6);  b = mx; }
  else if (GF.per === 'd30') { a = addDays(mx, -29); b = mx; }
  GF.a = a; GF.b = b; syncGInputs();
}
function bindGBar() {
  gfLoad(); syncGInputs();
  $('gG').value = GF.g || 'jour'; $('gP').value = GF.per || 'all';
  $('gG').addEventListener('change', () => { GF.g = $('gG').value; gfSave(); if (RENDERS[PAGE]) RENDERS[PAGE](); });
  $('gP').addEventListener('change', () => { GF.per = $('gP').value; gfApplyPreset(); gfSave(); if (RENDERS[PAGE]) RENDERS[PAGE](); });
  $('gDa').addEventListener('change', () => { GF.a = $('gDa').value || ''; GF.per = 'custom'; $('gP').value = 'custom'; gfSave(); if (RENDERS[PAGE]) RENDERS[PAGE](); });
  $('gDb').addEventListener('change', () => { GF.b = $('gDb').value || ''; GF.per = 'custom'; $('gP').value = 'custom'; gfSave(); if (RENDERS[PAGE]) RENDERS[PAGE](); });
  gfRender();
}

/* ---------- helpers ---------- */
const $  = id => document.getElementById(id);
const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const n2   = v => { v = parseFloat(String(v ?? '').replace(',','.')); return isFinite(v) ? v : 0; };
const fmt  = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n || 0);
const fmt1 = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n || 0);
const pctS = (a, b) => b ? Math.round(a / b * 100) + ' %' : '—';
const mKey = d => String(d || '').slice(0, 7);                                // '2026-10'
const mLab = k => k ? MOIS[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4) : '—';
const dLab = d => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return d || '—';
  const dt = new Date(d + 'T00:00:00'); return dt.getDate() + ' ' + MOIS[dt.getMonth()] + ' ' + dt.getFullYear(); };
const jJours = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? JJ[new Date(d + 'T00:00:00').getDay()] : '';

function isoD(v) {                                   // -> 'YYYY-MM-DD'
  if (v == null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + String(v.getMonth()+1).padStart(2,'0') + '-' + String(v.getDate()).padStart(2,'0');
  if (typeof v === 'number' && isFinite(v)) {        // n° de série Excel
    const d = new Date(Math.round((v - 25569) * 86400000));
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);   // 2026/10/1 · 2026-10-1 (export Vonage)
  if (m) return m[1] + '-' + String(+m[2]).padStart(2,'0') + '-' + String(+m[3]).padStart(2,'0');
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000;
    return y + '-' + String(+m[2]).padStart(2,'0') + '-' + String(+m[1]).padStart(2,'0'); }
  return '';
}
function hhmm(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && isFinite(v)) {        // fraction de journée
    let t = Math.round((v % 1) * 1440); const h = Math.floor(t / 60); t %= 60;
    return String(h).padStart(2,'0') + ':' + String(t).padStart(2,'0');
  }
  const m = String(v).trim().match(/^(\d{1,2})[:hH]?(\d{2})?/);
  if (!m) return String(v).slice(0, 5);
  return String(+m[1]).padStart(2,'0') + ':' + (m[2] || '00');
}
function isoWeek(d) {                                // n° semaine ISO
  const dt = new Date(d + 'T00:00:00');
  const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const dn = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dn + 3);
  const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - f) / 86400000 - 3 + ((f.getUTCDay() + 6) % 7)) / 7);
}
const wLab = d => 'S' + isoWeek(d);
const cum = a => { let s = 0; return a.map(v => (s += v)); };
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
const mondayOfW = w => addDays('2025-12-29', (w - 1) * 7);          // semaine 1 de 2026 : lun. 29 déc. 2025
const sec = s => Math.round(s || 0);               // DMT affichée en secondes (nombre) : 300 = 5 min
const dShort = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? (+d.slice(8, 10)) + ' ' + MOIS[+d.slice(5, 7) - 1] : (d || '—');
const rangeLbl = (a, b) => !a && !b ? 'période complète'
  : a && b ? dShort(a) + ' → ' + dShort(b) + (a.slice(0, 4) !== b.slice(0, 4) ? ' ' + b.slice(0, 4) : '')
  : a ? 'depuis le ' + dShort(a) : 'jusqu\'au ' + dShort(b);

/* normalisation d'un flux saisi (capa) vers les clés « Voix Hyper » … */
function normFlux(v) {
  const s = norm(v); if (!s) return '';
  const ch = /mail/.test(s) ? 'Mail' : 'Voix';
  for (const a of ['hyper', 'c2e', 'afr', 'drive', 'sav'])
    if (s.includes(a)) return ch + ' ' + a.charAt(0).toUpperCase() + a.slice(1);
  return String(v).trim();
}

/* normalisation d'une activité saisie (planning, ETP) : « Voix Hyper » / « Mail AFR » -> Hyper, AFR */
function normAct(v) {
  const s = norm(v); if (!s) return '';
  if (s.includes('borne') || s.includes('lsa')) return 'Borne/LSA';
  if (s.includes('waaoh')) return 'Waaoh';
  if (s.includes('chat')) return 'Chat';
  if (s.includes('barcelone')) return 'BARCELONE';
  for (const a of ['hyper', 'c2e', 'afr', 'drive', 'sav'])
    if (s.includes(a)) return a.charAt(0).toUpperCase() + a.slice(1);
  return String(v).trim();
}
function prodOf(act) {                        // hypothèse de productivité actes/heure (ou null)
  const v = D.prod ? D.prod.def[norm(act)] : null;
  return v > 0 ? v : null;
}

/* ---------- état ---------- */
let D = null;                                        // données complètes
let PAGE = 'p1';
const CH = {};                                       // instances Chart.js

function emptyData() {
  return { meta: { maj: new Date().toISOString().slice(0, 10) },
           roadmap: [], capa: { dates: [], flux: [] },
           planH: { file: '', maj: '', dates: [], acts: [], f: {} },
           etp: { file: '', maj: '', rows: [] },
           prod: { file: '', def: {} },
           real: { maj: '', file: '', flows: RFLOW.slice(), dates: [], sem: [], jours: [],
                   f: Object.fromEntries(RFLOW.map(f => [f, { t: [], r: [], s: [] }])) },
           dmt: { file: '', maj: '', dates: [], flows: [], f: {} },
           mail: { file: '', maj: '', dates: [], flows: [], f: {} },
           pmail: { file: '', maj: '', rows: [] },
           plan: null,
           prev: null };
}
function ensure() {
  if (!D.meta) D.meta = {};
  if (D.rm2 === undefined) D.rm2 = null;
  if (!D.roadmap) D.roadmap = [];
  D.roadmap.forEach(r => { if (!Array.isArray(r.etp)) r.etp = []; if (!Array.isArray(r.capa)) r.capa = []; });
  if (!D.capa) D.capa = { dates: [], flux: [] };
  D.capa.flux.forEach(f => { if (!Array.isArray(f.hrs)) f.hrs = [];
    if (!Array.isArray(f.hrsPrev)) f.hrsPrev = []; if (!Array.isArray(f.hrsContr)) f.hrsContr = []; });
  if (!D.planH) D.planH = { file: '', maj: '', dates: [], acts: [], f: {} };
  if (!D.etp) D.etp = { file: '', maj: '', rows: [] };
  if (!D.prod) D.prod = { file: '', def: {} };
  if (!D.real) D.real = emptyData().real;
  D.real.flows = RFLOW.slice();
  RFLOW.forEach(f => { if (!D.real.f[f]) D.real.f[f] = { t: [], r: [], s: [] }; });
  if (!D.dmt) D.dmt = { file: '', maj: '', dates: [], flows: [], f: {} };
  if (!D.mail) D.mail = { file: '', maj: '', dates: [], flows: [], f: {} };
  if (!D.pmail) D.pmail = { file: '', maj: '', rows: [] };
  if (D.plan === undefined) D.plan = null;
  if (D.prev === undefined) D.prev = null;
}
function save() { try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) { console.warn('localStorage', e); } }
function sortReal() {
  const R = D.real, o = R.dates.map((d, i) => [d, i]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  R.dates = o.map(x => x[0]);
  R.sem   = o.map(x => R.sem[x[1]] ?? 0);
  R.jours = o.map(x => R.jours[x[1]] ?? '');
  RFLOW.forEach(f => ['t','r','s'].forEach(k => R.f[f][k] = o.map(x => R.f[f][k][x[1]] ?? 0)));
}
function sortDmt() {
  const M = D.dmt, o = M.dates.map((d, i) => [d, i]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  M.dates = o.map(x => x[0]);
  M.flows.forEach(f => { const F = M.f[f]; if (!F) return;
    ['n','com','acw','lost'].forEach(k => { const a = F[k] || []; F[k] = o.map(x => a[x[1]] ?? 0); }); });
}
function sortMail() {
  const M = D.mail, o = M.dates.map((d, i) => [d, i]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  M.dates = o.map(x => x[0]);
  M.flows.forEach(f => { const F = M.f[f]; if (!F) return;
    ['rec','tr','t60','del'].forEach(k => F[k] = o.map(x => (F[k] || [])[x[1]] ?? 0)); });
}
function sortPlanH() {
  const P = D.planH, o = P.dates.map((d, i) => [d, i]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  P.dates = o.map(x => x[0]);
  P.acts.forEach(a => { P.f[a] = o.map(x => (P.f[a] || [])[x[1]] ?? 0); });
}

/* ---------- Chart.js : réglages communs ---------- */
Chart.defaults.font.family = '"Segoe UI",system-ui,-apple-system,Arial,sans-serif';
Chart.defaults.font.size = 11.5;
Chart.defaults.color = '#5c6784';
Chart.defaults.animation.duration = 220;
const GRID = { color: '#e8ecf6' };
function mkChart(id, cfg) {
  if (CH[id]) CH[id].destroy();
  const el = $(id); if (!el) return;
  CH[id] = new Chart(el, cfg);
}
function axisY(label) {
  return { beginAtZero: true, grid: GRID, ticks: { callback: v => fmt(v) },
           title: { display: !!label, text: label || '', font: { size: 10.5 } } };
}
function axisP() {
  return { beginAtZero: true, grid: { display: false }, position: 'right', max: 100,
           ticks: { callback: v => v + ' %' } };
}
const tipV = ctx => ' ' + fmt(ctx.parsed.y ?? ctx.parsed);

/* ---------- onglets ---------- */
const RENDERS = {};
function go(p) {
  PAGE = p;
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  document.querySelectorAll('section.page').forEach(s => s.classList.toggle('on', s.id === p));
  gfDisables();
  if (GF.per && GF.per !== 'all' && GF.per !== 'custom') gfApplyPreset();
  if (RENDERS[p]) RENDERS[p]();
}

/* ---------- entête / statut sources ---------- */
function renderHead() {
  const m = D.meta || {};
  const bits = [];
  if (D.rm2 && D.rm2.weeks && D.rm2.weeks.length)
    bits.push('Modèle RM : ' + (m.rm2 || (D.rm2.meta && D.rm2.meta.file) || 'RM') + ' (' + D.rm2.weeks.length + ' sem.)');
  else if (m.roadmap) bits.push('Roadmap : ' + m.roadmap);
  if (m.capa) bits.push('Capacité : ' + m.capa);
  if (D.planH && D.planH.dates && D.planH.dates.length)
    bits.push('Planning (h) : ' + (m.plan || D.planH.file || 'importé') + ' (' + D.planH.dates.length + ' j)');
  if (D.plan && D.plan.dates && D.plan.dates.length)
    bits.push('Planification : ' + ((D.plan.meta && D.plan.meta.file) || 'importée') + ' (' + D.plan.dates.length + ' j)');
  if (D.etp && D.etp.file) bits.push('ETP : ' + D.etp.file);
  if (D.real && D.real.dates && D.real.dates.length)
    bits.push('Réalisé : ' + (m.real || D.real.file || 'DRM') + ' (' + D.real.dates.length + ' j)');
  if (D.dmt && D.dmt.dates && D.dmt.dates.length)
    bits.push('DMT : ' + (m.dmt || D.dmt.file || 'Vonage') + ' (' + D.dmt.dates.length + ' j)');
  if (D.mail && D.mail.dates && D.mail.dates.length)
    bits.push('Mail : ' + (m.mail || D.mail.file || 'Export Mail') + ' (' + D.mail.dates.length + ' j)');
  if (D.prev && D.prev.mois && Object.keys(D.prev.mois).length)
    bits.push('Prévision Webhelp : ' + (m.prev || D.prev.meta && D.prev.meta.file || 'Webhelp') +
      (D.prev.meta && D.prev.meta.snapshot ? ' (au ' + dShort(D.prev.meta.snapshot) + ')' : ''));
  $('srcLine').textContent = bits.length ? bits.join('  ·  ') + '  ·  maj ' + (m.maj || '—')
                                         : 'Aucune donnée — cliquez sur « Importer » ou « Démo »';
}

/* =====================================================================
   IMPORTS
   ===================================================================== */
function readFile(input, cb) {
  const f = input.files && input.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => cb(f, new Uint8Array(r.result));
  r.readAsArrayBuffer(f);
}
function setStatus(id, msg, ok) { const el = $(id); el.textContent = msg; el.className = 'st ' + (ok ? 'ok' : 'err'); }

/* ---- Roadmap v2 : modèle RM (onglet AUCHAN — sections hebdo — + feuille Congés) ----
   Sections extraites : sla/qe, prévisions, cible, qp, prévisions finales,
   besoin h log / h prod / ETP, capa h prod / h log / actes, deltas, DMT, productivité,
   occupation, congés, absentéisme, effectif, effectif productif (+ congés ETP feuille dédiée).
   Les lignes « --- » valorisées sont C2E / Direct (LAD) / Mail Direct (LAD). */
const RM_TITLES = [['sla', 'sla / qe'], ['prev', 'previsions'], ['cible', 'cible'], ['qp', 'qp / backlog'],
  ['pfin', 'previsions finales'], ['bes_hlog', 'besoin en heures de log'], ['bes_hprod', 'besoin en heures de prod'],
  ['bes_etp', 'besoin en etp'], ['capa_hprod', 'capa en heures de prod'], ['capa_hlog', 'capa en heures de log'],
  ['capa_a', 'capa en actes'], ['delta_h', 'delta en heures'], ['delta_etp', 'delta en etp'], ['dmt', 'dmt'],
  ['prod_h', 'productivite'], ['occ', 'occupation'], ['conges', 'conges'], ['abs', 'absenteisme'],
  ['eff', 'effectif'], ['eff_prod', 'effectif productif']];
const RM_BOUND = new Set(['base de planification', 'effectif (saisie manuelle)', 'cc hors prod',
  'to', 'config', 'retraits', 'hypothese', 'hypotheses']);
const RM_FAM = { 'front office': 'FO', 'back office': 'BO', 'autres': 'AU' };
const RM_ACTS = [['hyper', 'FO', 'Hyper'], ['afr', 'FO', 'AFR'], ['drive', 'FO', 'Drive'], ['sav', 'FO', 'SAV'],
  ['chat', 'AU', 'Chat'], ['borne', 'AU', 'Borne/LSA']];
const RM_MAIL = [['afr', 'Mail AFR'], ['drive', 'Mail Drive'], ['hyper', 'Mail Hyper']];
const RM_IMPLICIT = { 'FO|Hyper': 'C2E', 'FO|AFR': 'Direct (LAD)', 'BO|Mail AFR': 'Mail Direct (LAD)' };
const RM_ALL = ['Hyper', 'C2E', 'AFR', 'Direct (LAD)', 'Drive', 'SAV', 'Mail Hyper', 'Mail AFR',
  'Mail Direct (LAD)', 'Mail Drive', 'Chat', 'Borne/LSA'];
const RM_FAM_OF = { Hyper: 'FO', 'C2E': 'FO', AFR: 'FO', 'Direct (LAD)': 'FO', Drive: 'FO', SAV: 'FO',
  'Mail Hyper': 'BO', 'Mail AFR': 'BO', 'Mail Direct (LAD)': 'BO', 'Mail Drive': 'BO', Chat: 'AU', 'Borne/LSA': 'AU' };
const RM_NO_TOT = new Set(['sla', 'cible', 'qp', 'occ', 'dmt', 'prod_h']);
const RM_RATE = new Set(['sla', 'cible', 'qp', 'occ', 'abs', 'conges', 'dmt', 'prod_h']);
const RM_WBY = { abs: 'eff', conges: 'eff' };                     // pondération des taux (sinon pfin)
const RM_FAMLBL = { FO: 'Front Office', BO: 'Back Office', AU: 'Autres' };

function rmWeekRow(a, min) {                                      // ligne des étiquettes S<n>__<année>
  const m = min || 30;
  for (let r = 0; r < Math.min(a.length, 25); r++) {
    let n = 0;
    (a[r] || []).forEach(v => { if (v != null && /^S\d{1,2}__\d{4}$/i.test(String(v).trim())) n++; });
    if (n >= m) return r;
  }
  return -1;
}
function rmComplete(key, sec) {                                   // totaux / familles manquants
  const acts = RM_ALL.filter(k => sec.a[k]);
  const rate = RM_RATE.has(key);
  const wOf = (k, i) => {
    const ws = D2sec(RM_WBY[key] || 'pfin');
    return ws && ws.a[k] ? (ws.a[k][i] || 0) : 0;
  };
  function D2sec(k) { return window.__rmTmp && window.__rmTmp.s ? window.__rmTmp.s[k] : null; }
  if (!RM_NO_TOT.has(key) && !sec.t.some(v => v != null) && acts.length)
    sec.t = sec.a[acts[0]].map((_, i) => Math.round(acts.reduce((s, k) => s + (sec.a[k][i] || 0), 0) * 100) / 100);
  ['FO', 'BO', 'AU'].forEach(fam => {
    const fa = acts.filter(k => RM_FAM_OF[k] === fam);
    if (!fa.length || sec.fam[fam].some(v => v != null)) return;
    sec.fam[fam] = sec.a[fa[0]].map((_, i) => {
      if (rate) { let sv = 0, sw = 0;
        fa.forEach(k => { const x = sec.a[k][i], wt = wOf(k, i);
          if (x != null && wt > 0) { sv += x * wt; sw += wt; } });
        return sw > 0 ? Math.round(sv / sw * 10000) / 10000 : null; }
      return Math.round(fa.reduce((s, k) => s + (sec.a[k][i] || 0), 0) * 100) / 100;
    });
  });
}
function rmParseAuchan(aoa, weeks) {                              // extraction des sections
  const NW = weeks.length;
  const secOf = {};
  RM_TITLES.forEach(([k, t]) => secOf[t] = k);
  const found = [];
  for (let r = 0; r < aoa.length; r++) {
    const lab = norm((aoa[r] || [])[4]);
    const k = secOf[lab];
    if (k && !found.some(f => f.k === k)) found.push({ k, r });
  }
  found.sort((a, b) => a.r - b.r);
  if (!found.length) throw new Error('Sections RM introuvables (colonne E de l\'onglet AUCHAN)');
  const S = {};
  found.forEach((f, fi) => {
    const endR = fi + 1 < found.length ? found[fi + 1].r : aoa.length;
    const sec = { row: f.r + 1, t: Array(NW).fill(null),
      fam: { FO: Array(NW).fill(null), BO: Array(NW).fill(null), AU: Array(NW).fill(null) }, a: {} };
    let curFam = null, prevAct = null;
    for (let r = f.r; r < endR; r++) {
      const row = aoa[r] || [];
      const lab = norm(row[4]);
      if (r !== f.r && RM_BOUND.has(lab)) break;
      const vals = weeks.map(w => { const v = row[w.col];
        return v == null || v === '' ? null : Math.round(n2(v) * 10000) / 10000; });
      if (r === f.r) { sec.t = vals; continue; }
      if (!lab || lab === '---' || lab === '-') {
        if (curFam && prevAct && vals.some(v => v != null && v !== 0)) {
          const imp = RM_IMPLICIT[curFam + '|' + prevAct];
          if (imp && !sec.a[imp]) { sec.a[imp] = vals; prevAct = imp; }
        }
        continue;
      }
      if (RM_FAM[lab]) { curFam = RM_FAM[lab]; prevAct = null;
        if (vals.some(v => v != null)) sec.fam[curFam] = vals;
        continue; }
      let act = null;
      if (lab.includes('mail')) { for (const [frag, key] of RM_MAIL) if (lab.includes(frag)) { act = key; curFam = 'BO'; break; } }
      else if (lab.includes('direct') && lab.includes('lad')) act = curFam === 'BO' ? 'Mail Direct (LAD)' : 'Direct (LAD)';
      else for (const [frag, fam, key] of RM_ACTS) if (lab.includes(frag)) { act = key; curFam = fam; break; }
      if (act) { sec.a[act] = vals; prevAct = act; }
    }
    S[f.k] = sec;
  });
  return { S, found };
}
function impRoadmap(name, buf) {
  const wb = XLSX.read(buf, { type: 'array' });
  let aoa = null;
  for (const sn of wb.SheetNames) {
    const a = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null });
    if (rmWeekRow(a) >= 0) { aoa = a; break; }
  }
  if (!aoa) throw new Error('Onglet avec en-têtes de semaines (S1__2025…) introuvable');
  const hi = rmWeekRow(aoa);
  const weeks = [];
  for (let c = 0; c < (aoa[hi] || []).length; c++) {
    const m = String(aoa[hi][c] ?? '').trim().match(/^S(\d{1,2})__(\d{4})$/i);
    if (!m) continue;
    weeks.push({ k: 'S' + (+m[1]) + '__' + m[2], n: +m[1], y: +m[2], col: c,
      start: isoD(aoa[hi + 1] ? aoa[hi + 1][c] : '') || '',
      end: isoD(aoa[hi + 2] ? aoa[hi + 2][c] : '') || '',
      days: (aoa[hi + 3] ? Math.round(n2(aoa[hi + 3][c])) || null : null) });
  }
  if (weeks.length < 10) throw new Error('Colonnes de semaines insuffisantes');
  const { S, found } = rmParseAuchan(aoa, weeks);
  window.__rmTmp = { s: S };                                      // pour la pondération de rmComplete
  Object.keys(S).forEach(k => rmComplete(k, S[k]));
  if (S.conges) S.conges.t = S.conges.t.map(() => null);          // total fichier en ETP ≠ taux des activités
  /* feuille Congés (ETP par semaine) alignée par libellé de semaine */
  const cn = wb.SheetNames.find(n => norm(n) === 'conges');
  if (cn) {
    const a = XLSX.utils.sheet_to_json(wb.Sheets[cn], { header: 1, raw: true, defval: null });
    const hiC = rmWeekRow(a, 10);
    if (hiC >= 0) {
      const colmap = {};
      (a[hiC] || []).forEach((v, c) => { const m = String(v ?? '').trim().match(/^S(\d{1,2})__(\d{4})$/i);
        if (m) colmap['S' + (+m[1]) + '__' + m[2]] = c; });
      const NW = weeks.length;
      const sec = { row: hiC + 1, t: Array(NW).fill(null),
        fam: { FO: Array(NW).fill(null), BO: Array(NW).fill(null), AU: Array(NW).fill(null) }, a: {} };
      let curFam = null, prevAct = null;
      for (let r = hiC + 1; r < a.length; r++) {
        const row = a[r] || []; const lab = norm(row[1]);
        if (!lab) continue;
        const val = w => colmap[w.k] == null ? null : (row[colmap[w.k]] == null || row[colmap[w.k]] === ''
          ? null : Math.round(n2(row[colmap[w.k]]) * 10000) / 10000);
        if (RM_FAM[lab]) { curFam = RM_FAM[lab]; prevAct = null; continue; }
        if (lab === '---' || lab === '-') {
          const imp = curFam && prevAct ? RM_IMPLICIT[curFam + '|' + prevAct] : null;
          if (imp && !sec.a[imp]) { sec.a[imp] = weeks.map(val); prevAct = imp; }
          continue;
        }
        if (lab === 'conges') { sec.t = weeks.map(val); continue; }
        let act = null;
        if (lab.includes('mail')) { for (const [frag, key] of RM_MAIL) if (lab.includes(frag)) { act = key; break; } }
        else for (const [frag, fam, key] of RM_ACTS) if (lab.includes(frag)) { act = key; curFam = fam; break; }
        if (act) { sec.a[act] = weeks.map(val); prevAct = act; }
      }
      S.conges_etp = sec;
    }
  }
  window.__rmTmp = null;
  D.rm2 = { v: 2, meta: { file: name, maj: new Date().toISOString().slice(0, 10) },
    acts: RM_ALL.map(k => ({ k, fam: RM_FAM_OF[k] })),
    weeks: weeks.map(({ col, ...rest }) => rest), s: S };
  D.meta.rm2 = name;
  buildRoadmapCompat();
  return weeks.length + ' semaines · ' + found.length + ' sections · ' + D.rm2.acts.length + ' activités';
}
function buildRoadmapCompat() {                                   // D.roadmap v1 (onglet Productivité)
  const R = D.rm2;
  if (!R || !R.weeks || !R.weeks.length) { D.roadmap = []; return; }
  const ix = R.weeks.map((w, i) => [w, i]).filter(([w]) => w.y === 2026).map(([, i]) => i);
  const grab = (sec, k) => ix.map(i => { const a = R.s[sec] && R.s[sec].a[k]; return (a && a[i] != null) ? a[i] : 0; });
  D.roadmap = ['Hyper', 'C2E', 'AFR', 'Drive', 'SAV', 'Mail Hyper', 'Mail AFR', 'Mail Drive', 'Chat', 'Borne/LSA']
    .map(k => ({ a: k.startsWith('Mail ') ? k.slice(5) : k,
                 c: k.startsWith('Mail ') ? 'Mail' : (k === 'Chat' || k === 'Borne/LSA') ? 'Autres' : 'Voix',
                 prev: grab('pfin', k), etp: grab('bes_etp', k), capa: grab('capa_a', k) }));
}

/* ---- Capacité : onglet DAILY VISION, dates ligne 15 (col 5), « Capacitaire en actes » ---- */
function impCapa(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames.find(n => norm(n).includes('daily')) || 0];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const HR = 14;                                                   // ligne 15 (0-based)
  const dates = [];
  for (let c = 4; c < (aoa[HR] || []).length; c++) {
    const d = isoD(aoa[HR][c]); if (d) dates.push(d); else dates.push('');
  }
  const n = dates.filter(Boolean).length;
  if (!n) throw new Error('Dates introuvables ligne 15 (onglet DAILY VISION)');
  /* blocs de flux : repérer les lignes « Capacitaire en actes » / « en heures », flux = en-tête de bloc au-dessus */
  let cur = '';
  const flux = [];
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    for (let c = 0; c < 4; c++) {
      const v = row[c]; if (v != null && String(v).trim() !== '') cur = normFlux(v) || cur;
    }
    const lab = norm(row[3]);
    const isActes = lab.includes('capacitaire en actes');
    const isHeures = !isActes && lab.includes('capacitaire en heures');
    if (isActes || isHeures) {
      const key = FLOWS8.find(k => norm(k) === norm(cur)) || cur;
      let fe = flux.find(f => f.k === key);
      if (!fe) { fe = { k: key, c: key.startsWith('Mail') ? 'Mail' : 'Voix', a: key.split(' ')[1] || key }; flux.push(fe); }
      const tgt = isActes ? ['prev', 'contr', 'capa'] : ['hrsPrev', 'hrsContr', 'hrs'];
      fe[tgt[0]] = []; fe[tgt[1]] = []; fe[tgt[2]] = [];
      for (let c = 4; c < dates.length + 4; c++) {                 // offsets -2/-1/0
        fe[tgt[0]].push(n2(row[c - 2])); fe[tgt[1]].push(n2(row[c - 1])); fe[tgt[2]].push(n2(row[c]));
      }
    }
  }
  if (!flux.some(f => Array.isArray(f.capa))) throw new Error('Lignes « Capacitaire en actes » introuvables');
  D.capa = { dates: dates.filter(Boolean), flux };
  D.meta.capa = name;
  const hasH = flux.some(f => (f.hrs || []).some(v => v > 0));
  return flux.length + ' activités × ' + n + ' jours' + (hasH ? ' · capacitaire en heures extraite' : '');
}

/* ---- ETP prévus : colonnes semaine (S42 / 42 / date) · activité · etp ---- */
function impEtp(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  let hi = aoa.findIndex(r => r && r.some(v => /etp/.test(norm(v))));
  if (hi < 0) hi = 0;
  const head = (aoa[hi] || []).map(v => norm(v));
  const cA = head.findIndex(h => h === 'activite' || h === 'flux' || h.includes('activit') || h.includes('flux'));
  const cE = head.findIndex(h => h.includes('etp'));
  let cW = head.findIndex(h => h.includes('semaine'));
  if (cW < 0) cW = head.findIndex(h => h.includes('date'));
  if (cW < 0) cW = head.findIndex(h => h === 's');
  if (cA < 0 || cE < 0 || cW < 0) throw new Error('Colonnes semaine (ou date) / activité / etp introuvables');
  const rows = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const a = String(r[cA] ?? '').trim(); const e = n2(r[cE]);
    if (!a || e <= 0) continue;
    let w = 0;
    const raw = r[cW];
    if (typeof raw === 'number' && raw >= 1 && raw <= 53) w = Math.round(raw);
    else if (typeof raw === 'number') { const d = isoD(raw); w = d ? isoWeek(d) : 0; }
    else {
      const s = String(raw ?? '').trim();
      const m = s.match(/^S?\s*(\d{1,2})$/i);
      if (m && +m[1] >= 1 && +m[1] <= 53) w = +m[1];
      else { const d = isoD(s); if (d) w = isoWeek(d); }
    }
    if (!w) continue;
    rows.push([w, a, e]);
  }
  if (!rows.length) throw new Error('Aucun ETP lu (vérifiez semaine/date, activité, etp)');
  D.etp = { file: name, maj: new Date().toISOString().slice(0, 10), rows };
  D.meta.etp = name;
  return rows.length + ' lignes ETP · ' + new Set(rows.map(r => norm(r[1]))).size + ' activités';
}

/* ---- Planning : synthèse quotidienne date · activité · heures ----
   Heures planifiées par jour × activité → capa réelle en heures,
   puis capa réelle en actes = heures × hypothèse de productivité. */
function impPlanH(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  let hi = aoa.findIndex(r => r && r.some(v => norm(v) === 'date'));
  if (hi < 0) hi = 0;
  const head = (aoa[hi] || []).map(v => norm(v));
  const cD = head.indexOf('date') >= 0 ? head.indexOf('date') : head.findIndex(h => h.includes('date'));
  const cF = head.findIndex(h => h === 'activite' || h === 'flux' || h.includes('activit') || h.includes('flux'));
  const cH = head.findIndex(h => h === 'heures' || h === 'heure' || h.includes('heure') || h.includes('planifie') || h === 'h');
  if (cD < 0 || cF < 0 || cH < 0) throw new Error('Colonnes date / activité / heures introuvables');
  const acc = new Map();                                           // 'date|ACT' -> heures
  let n = 0;
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i] || []; const d = isoD(r[cD]);
    const a = normAct(cF >= 0 ? r[cF] : ''); const h = n2(cH >= 0 ? r[cH] : 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !a || h <= 0) continue;
    const k = d + '|' + a;
    acc.set(k, (acc.get(k) || 0) + h);
    n++;
  }
  if (!acc.size) throw new Error('Aucune ligne exploitable (date · activité · heures)');
  const P = D.planH;
  [...new Set([...acc.keys()].map(k => k.split('|')[1]))].forEach(a => {
    if (!P.acts.includes(a)) { P.acts.push(a); P.f[a] = []; }
  });
  const ds = [...new Set([...acc.keys()].map(k => k.split('|')[0]))];
  ds.forEach(d => { if (P.dates.indexOf(d) < 0) P.dates.push(d); });
  sortPlanH();
  acc.forEach((h, k) => { const [d, a] = k.split('|'); P.f[a][P.dates.indexOf(d)] = h; });   // même jour/activité = remplacé
  P.file = name; P.maj = new Date().toISOString().slice(0, 10);
  D.meta.plan = name;
  return fmt(n) + ' lignes · ' + P.dates.length + ' jours · ' + P.acts.length + ' activités';
}

/* ---- Réalisé (DRM) : table journalière Traités / Reçus / Traités 60s × flux ---- */
function impReal(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  let aoa = null;
  for (const sn of wb.SheetNames) {
    const a = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null });
    const h1 = (a[0] || []).map(v => norm(v));
    if (h1.includes('traites') && h1.includes('recus')) { aoa = a; break; }
  }
  if (!aoa) throw new Error('En-têtes « Traités / Reçus » introuvables (DRM attendu)');
  const h1 = (aoa[0] || []).map(v => norm(v));
  const h2 = ((aoa[1] || []).map(v => String(v ?? '').trim().toUpperCase()));
  /* colonne DATE (ligne 2) + groupes : bornes = débuts consécutifs des libellés ligne 1 */
  const dc = h2.findIndex(v => norm(v) === 'date');
  if (dc < 0) throw new Error('Colonne DATE introuvable (ligne 2)');
  const groups = [['traites', 't'], ['recus', 'r'], ['traites 60s', 's']];
  const starts = [];
  groups.forEach(([lab, k]) => { const i = h1.indexOf(lab); if (i >= 0) starts.push([i, k]); });
  starts.sort((a, b) => a[0] - b[0]);
  const colmap = {};                                               // flux -> {t:c,r:c,s:c}
  starts.forEach(([st, k], gi) => {
    const en = gi < starts.length - 1 ? starts[gi + 1][0] - 1 : h2.length - 1;
    let got = false;                                               // plage STRICTEMENT contiguë
    for (let c = st; c <= en; c++) {
      const fl = h2[c];
      if (RFLOW.includes(fl)) { colmap[fl] = colmap[fl] || {}; colmap[fl][k] = c; got = true; }
      else if (got) break;                                         // 1er non-flux = fin du groupe
    }
  });
  if (!Object.keys(colmap).length) throw new Error('Aucun flux reconnu sous les groupes (HYPER, C2E, AFR, DRIVE, SAV)');
  const R = D.real;
  let n = 0;
  for (let i = 3; i < aoa.length; i++) {                           // données dès la ligne 4
    const row = aoa[i] || [];
    const raw = row[dc];
    if (typeof raw === 'string' && raw.trim().toUpperCase() === 'DATE') break;   // 2e table (QS/QP)
    if (typeof row[0] === 'string' && /mtd/i.test(row[0])) continue;             // lignes de totaux
    const d = isoD(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    let ix = R.dates.indexOf(d);
    if (ix < 0) {                                                  // nouveau jour
      ix = R.dates.length; R.dates.push(d); R.sem.push(0); R.jours.push('');
      RFLOW.forEach(f => ['t','r','s'].forEach(k => R.f[f][k].push(0)));
    }
    R.sem[ix]   = Number(row[0]) || R.sem[ix] || 0;
    R.jours[ix] = String(row[1] ?? '').trim() || R.jours[ix] || '';
    for (const fl of RFLOW) {
      const cm = colmap[fl] || {};
      ['t','r','s'].forEach(k => {
        const c = cm[k]; if (c == null) return;
        const v = row[c];
        R.f[fl][k][ix] = (v == null || v === '' || v === '*') ? 0 : (Number(v) || 0);
      });
    }
    n++;
  }
  if (!n) throw new Error('Aucune ligne de données lue');
  sortReal();
  R.file = name; R.maj = new Date().toISOString().slice(0, 10);
  D.meta.real = name;
  return n + ' jours (' + R.dates[0] + ' → ' + R.dates[R.dates.length - 1] + ')';
}

/* ---- DMT : Export Vonage Call (1 ligne = 1 appel) ----
   DMT = (durée de communication + after-call work) / appels répondus, par jour × compétence */
function impDmt(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  let hi = aoa.findIndex(r => r && r.some(v => norm(v).includes('competence')) && r.some(v => norm(v).includes('date')));
  if (hi < 0) hi = 0;
  const head = (aoa[hi] || []).map(v => norm(v));
  const col = subs => head.findIndex(h => h.includes(subs));
  const cC = col('competence');
  const cR = head.indexOf('repondu') >= 0 ? head.indexOf('repondu') : col('repondu');
  const cD = col('date de creation') >= 0 ? col('date de creation') : col('date');
  const cM = col('duree de communication'), cA = col('after call work');
  const cL50 = head.findIndex(h => /sla\s*-?\s*50/.test(h));        // colonne SLA-50 optionnelle (perdus file)
  if (cC < 0 || cD < 0) throw new Error('Colonnes « Compétence » / « Date de création » introuvables');
  const agg = new Map();                                            // 'date|FLUX' -> [n répondus, sum com, sum acw, perdus -50s]
  let nrep = 0;
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const d = isoD(r[cD]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const fl = String(r[cC] ?? '').trim().toUpperCase();
    if (!fl) continue;
    const rep = cR >= 0 ? n2(r[cR]) : 1;                            // sans colonne Répondu : tout compte
    const com = n2(cM >= 0 ? r[cM] : 0), acw = n2(cA >= 0 ? r[cA] : 0);
    const k = d + '|' + fl;
    const a = agg.get(k) || [0, 0, 0, 0];
    if (rep > 0) { a[0]++; nrep++; a[1] += com; a[2] += acw; }      // seuls les appels répondus entrent dans la DMT
    if (cL50 >= 0) {                                                // perdus file -50s : toutes lignes (répondues ou non)
      const v = r[cL50], nv = n2(v);
      if (nv > 0) a[3] += nv;
      else if (typeof v === 'string' && v.trim() !== '' && !/^(0|0,0|non|no|false|faux|n|-)$/.test(v.trim())) a[3]++;
    }
    agg.set(k, a);
  }
  if (!agg.size) throw new Error('Aucune ligne exploitable (vérifiez Compétence / Date de création)');
  const M = D.dmt;
  [...new Set([...agg.keys()].map(k => k.split('|')[1]))].forEach(f => {
    if (!M.flows.includes(f)) { M.flows.push(f); M.f[f] = { n: [], com: [], acw: [], lost: [] }; }
  });
  const ds = [...new Set([...agg.keys()].map(k => k.split('|')[0]))];
  ds.forEach(d => {
    if (M.dates.indexOf(d) < 0) {
      M.dates.push(d);
      M.flows.forEach(f => { const F = M.f[f]; F.n.push(0); F.com.push(0); F.acw.push(0);
        if (!F.lost) F.lost = []; F.lost.push(0); });
    }
  });
  sortDmt();
  let lostTot = 0;
  agg.forEach(([n, com, acw, lost], k) => {
    const [d, f] = k.split('|'), di = M.dates.indexOf(d);
    M.f[f].n[di] = n; M.f[f].com[di] = com; M.f[f].acw[di] = acw;   // même jour/flux = remplacé (imports fusionnables)
    if (!M.f[f].lost) M.f[f].lost = []; M.f[f].lost[di] = lost; lostTot += lost;
  });
  const rank = f => (RFLOW.indexOf(f) < 0 ? 9 : RFLOW.indexOf(f));
  M.flows.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
  M.file = name; M.maj = new Date().toISOString().slice(0, 10);
  D.meta.dmt = name;
  return fmt(nrep) + ' appels répondus · ' + ds.length + ' jours · ' + M.flows.length + ' activités' +
         (cL50 >= 0 ? ' · ' + fmt(lostTot) + ' perdus file -50s (SLA-50)' : '');
}

/* ---- Mail : Export Mail (1 ligne = 1 courriel) ----
   Reçus = toutes les lignes · Traités = Statut 1 · QS<60s = traités avec délai < 60 s
   DMT = Σ délais / traités (s) · Heures de traitement = Σ délais — par jour × activité */
function impMail(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  let hi = aoa.findIndex(r => r && r.some(v => norm(v).startsWith('personnalis')));
  if (hi < 0) hi = 0;
  const head = (aoa[hi] || []).map(v => norm(v));
  const cF = head.findIndex(h => h.startsWith('personnalis'));
  const cS = head.indexOf('statut');
  const cDel = head.findIndex(h => h.includes('delai de traitement'));
  const cD = head.findIndex(h => h.includes('acceptation'));       // « Date d'acceptation » (ou sa copie)
  if (cF < 0 || cD < 0) throw new Error("Colonnes « Personnalisé » / « Date d'acceptation » introuvables");
  const agg = new Map();                                           // 'date|flux' -> [reçus, traités, <60s, Σ délais]
  let tot = 0, skip = 0;
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    if (!r || !r.some(v => v != null)) continue;
    const d = isoD(r[cD]);
    const fl = String(r[cF] ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !fl) { skip++; continue; }
    const a = agg.get(d + '|' + fl) || [0, 0, 0, 0];
    a[0]++;                                                        // reçu
    const st = n2(cS >= 0 ? r[cS] : 1);
    const delai = n2(cDel >= 0 ? r[cDel] : 0);
    if (Math.round(st) === 1) { a[1]++; a[3] += delai; if (delai > 0 && delai < 60) a[2]++; }
    agg.set(d + '|' + fl, a);
    tot++;
  }
  if (!agg.size) throw new Error("Aucune ligne exploitable (vérifiez Personnalisé / Date d'acceptation)");
  const M = D.mail;
  [...new Set([...agg.keys()].map(k => k.split('|')[1]))].forEach(f => {
    if (!M.flows.includes(f)) { M.flows.push(f); M.f[f] = { rec: [], tr: [], t60: [], del: [] }; }
  });
  const ds = [...new Set([...agg.keys()].map(k => k.split('|')[0]))];
  ds.forEach(d => {
    if (M.dates.indexOf(d) < 0) {
      M.dates.push(d);
      M.flows.forEach(f => { const F = M.f[f]; F.rec.push(0); F.tr.push(0); F.t60.push(0); F.del.push(0); });
    }
  });
  sortMail();
  agg.forEach(([rec, tr, t60, del], k) => {
    const [d, f] = k.split('|'), di = M.dates.indexOf(d);
    M.f[f].rec[di] = rec; M.f[f].tr[di] = tr; M.f[f].t60[di] = t60; M.f[f].del[di] = del;   // même jour/flux = remplacé
  });
  const rank = f => { const i = RFLOW.indexOf(f.toUpperCase()); return i < 0 ? 9 : i; };
  M.flows.sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
  M.file = name; M.maj = new Date().toISOString().slice(0, 10);
  D.meta.mail = name;
  return fmt(tot) + ' courriels · ' + ds.length + ' jours · ' + M.flows.length + ' activités' +
         (skip ? ' · ' + skip + ' ligne(s) ignorée(s) (activité/date vide)' : '');
}

/* ---- Prévision Mail : colonnes date · flux · prevu (ou prévision) ---- */
function impPmail(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  let hi = aoa.findIndex(r => r && r.some(v => norm(v) === 'date'));
  if (hi < 0) hi = 0;
  const head = (aoa[hi] || []).map(v => norm(v));
  const cD = head.indexOf('date') >= 0 ? head.indexOf('date') : head.findIndex(h => h.includes('date'));
  const cF = head.findIndex(h => h === 'flux' || h === 'activite' || h.includes('flux') || h.includes('activit'));
  const cP = head.findIndex(h => h === 'prevu' || h === 'prev' || h.includes('prevu') || h.includes('prevision'));
  if (cD < 0 || cF < 0 || cP < 0) throw new Error('Colonnes date / flux / prevu introuvables');
  const rows = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i] || []; const d = isoD(r[cD]); const f = String(r[cF] ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !f) continue;
    const v = n2(r[cP]); if (!v) continue;
    rows.push([d, f, v]);
  }
  if (!rows.length) throw new Error('Aucune prévision lue');
  D.pmail = { file: name, maj: new Date().toISOString().slice(0, 10), rows };   // remplace la prévision
  D.meta.pmail = name;
  return rows.length + ' lignes de prévision · ' + new Set(rows.map(r => r[0])).size + ' jours';
}

/* ---- Planification : feuille « Planning » (une ligne = agent × jour) ----
   Lignes Statut = « Planifié » uniquement. Présence par créneau 30 min =
   recouvrement [Shift In, Shift Out) − recouvrement [Pause repas).
   FIM (Compétences = FIM ou Total FIM ≥ HP) = personnes hors prod : comptées à part, 0 en prod.
   Allaitement déduit au prorata du shift : facteur (HP − allaitement) / HP.
   HP du fichier = shift − pause repas ; heures en prod = HP − Total FIM − Allaitement. */
function tMin(v) {                                   // valeur temps -> minutes (float) ou null
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) return v.getHours() * 60 + v.getMinutes() + v.getSeconds() / 60;
  if (typeof v === 'number' && isFinite(v)) return v >= 0 && v < 1 ? Math.round((v % 1) * 1440) : null;
  const m = String(v).trim().match(/^(\d{1,2})[:hH](\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return +m[1] * 60 + +m[2] + (m[3] ? +m[3] / 60 : 0);
}
function tHrs(v) {                                   // durée -> heures (0 si vide)
  if (v == null || v === '') return 0;
  if (v instanceof Date && !isNaN(v)) return v.getHours() + v.getMinutes() / 60 + v.getSeconds() / 3600;
  if (typeof v === 'number' && isFinite(v)) return v <= 1.5 ? v * 24 : v;
  const m = String(v).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return 0;
  return +m[1] + +m[2] / 60 + (m[3] ? +m[3] / 3600 : 0);
}
const ovMin = (s1, e1, s2, e2) => Math.max(0, Math.min(e1, e2) - Math.max(s1, s2));
const r2d = v => Math.round(v * 100) / 100;
function planAgg(rows) {                             // agrégation -> matrice dates × créneaux
  const pr = rows.filter(r => r.ok);
  if (!pr.length) throw new Error('Aucune ligne planifiée exploitable (Statut = Planifié avec Shift In/Out)');
  const dates = [...new Set(pr.map(r => r.d))].sort();
  const g0 = Math.floor(Math.min(...pr.map(r => r.sin)) / 30) * 30;
  const g1 = Math.ceil(Math.max(...pr.map(r => r.sout)) / 30) * 30;
  const slots = []; for (let t = g0; t < g1; t += 30) slots.push(t);
  const by = {}; pr.forEach(r => (by[r.d] = by[r.d] || []).push(r));
  const m = { prod: {}, fim: {}, pres: {} }, day = {};
  dates.forEach(d => {
    const prod = slots.map(() => 0), fim = slots.map(() => 0), pres = slots.map(() => 0);
    let hp = 0, alla = 0, fimh = 0, rep = 0, n = 0, nF = 0; const ags = [];
    by[d].forEach(r => {
      const hasRep = r.r1 != null && r.r2 != null && r.r2 > r.r1;
      const repM = hasRep ? ovMin(r.r1, r.r2, 0, 1440) : 0;
      rep += repM / 60; hp += r.hp; alla += r.alla; fimh += r.fim; n++; ags.push(r.ag);
      if (r.fimrow) nF++;
      const f = r.hp > 0 ? Math.max(0, (r.hp - r.alla) / r.hp) : 1;
      slots.forEach((s, i) => {
        const x = ovMin(s, s + 30, r.sin, r.sout) - (hasRep ? ovMin(s, s + 30, r.r1, r.r2) : 0);
        if (x <= 0) return;
        const w = x / 30;
        pres[i] += w;
        if (r.fimrow) fim[i] += w; else prod[i] += w * f;
      });
    });
    m.prod[d] = prod.map(v => Math.round(v * 1000) / 1000);
    m.fim[d]  = fim.map(v => Math.round(v * 1000) / 1000);
    m.pres[d] = pres.map(v => Math.round(v * 1000) / 1000);
    day[d] = { plan: n, fim: nF, hp: r2d(hp), hprod: r2d(Math.max(0, hp - fimh - alla)),
               alla: r2d(alla), fimh: r2d(fimh), repas: r2d(rep), ag: ags };
  });
  return { meta: { agents: new Set(pr.map(r => r.ag)).size }, dates,
           slots: slots.map(t => slotLab(Math.floor(t / 60) * 100 + t % 60)), m, day };
}
function impPlanning(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const trySheet = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
  let aoa = null;
  const sn = wb.SheetNames.find(n => norm(n) === 'planning') || wb.SheetNames.find(n => norm(n).includes('planning'));
  if (sn) aoa = trySheet(sn);
  else for (const n of wb.SheetNames) {
    const a = trySheet(n); const h = (a[0] || []).map(v => norm(v));
    if (h.includes('statut') && h.some(x => x.includes('shift'))) { aoa = a; break; }
  }
  if (!aoa) throw new Error('Feuille « Planning » introuvable (Statut + Shift In/Out attendus)');
  let hi = aoa.findIndex(r => r && r.some(v => norm(v) === 'statut') && r.some(v => norm(v).includes('shift')));
  if (hi < 0) hi = 0;
  const head = (aoa[hi] || []).map(v => norm(v));
  const col = (nm, alts) => { let i = head.indexOf(nm);
    if (i >= 0) return i;
    if (alts) for (const a of alts) { i = head.findIndex(h => h.includes(a)); if (i >= 0) return i; }
    return -1; };
  const cD = col('date'), cSt = col('statut'), cAg = col('log vonage', ['agent', 'noms']),
    cCp = col('competences'), cSI = col('shift in', ['debut de shift']), cSO = col('shift out', ['fin de shift']),
    cR1 = col('debut pause repas'), cR2 = col('fin pause repas'), cHP = col('hp'),
    cAl = col('allaitement'), cFm = col('total fim');
  if (cD < 0 || cSt < 0 || cSI < 0 || cSO < 0) throw new Error('Colonnes Statut / date / Shift In / Shift Out introuvables');
  const rows = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i] || [];
    const d = isoD(r[cD]);
    const sin = tMin(cSI >= 0 ? r[cSI] : null), sout = tMin(cSO >= 0 ? r[cSO] : null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || sin == null || sout == null || norm(r[cSt]) !== 'planifie') continue;
    if (sout <= sin) sout += 1440;                                // shift à cheval sur minuit
    const hp = tHrs(cHP >= 0 ? r[cHP] : 0), alla = tHrs(cAl >= 0 ? r[cAl] : 0), fim = tHrs(cFm >= 0 ? r[cFm] : 0);
    const comp = norm(cCp >= 0 ? r[cCp] : '');
    rows.push({ ok: true, d, ag: String(cAg >= 0 ? (r[cAg] ?? '') : ''),
      fimrow: comp === 'fim' || (fim > 0 && hp > 0 && fim >= hp - 0.01),
      sin, sout, r1: tMin(cR1 >= 0 ? r[cR1] : null), r2: tMin(cR2 >= 0 ? r[cR2] : null), hp, alla, fim });
  }
  const plan = planAgg(rows);
  plan.meta = Object.assign(plan.meta || {}, { file: name, maj: new Date().toISOString().slice(0, 10) });
  D.plan = plan;
  D.meta.planA = name;
  return plan.dates.length + ' jours · ' + plan.slots.length + ' créneaux 30 min · ' + plan.meta.agents + ' agents planifiés';
}

/* ---- Prévision Webhelp : onglet « 2026 » (prévus mensuels par flux) + onglet « Poids » ----
   Poids journaliers (Appel B-F, Mail J-L) -> vue par jour ; créneaux 30 min (col. R :
   730 = 07:30, profils « Lundi au samedi » / « Dimanche » S..AA) -> vue par créneau.
   Les poids sont normalisés (Σ = 1 par mois × canal × flux et par mois × flux × profil). */
const PACTS = ['hyper', 'c2e', 'afr', 'drive', 'sav', 'direct'];
const PCOL  = { hyper: '#3b5bdb', c2e: '#0ca678', afr: '#f59f00', drive: '#7048e8', sav: '#e8590c', direct: '#868e96' };
const PLBL  = { hyper: 'Hyper', c2e: 'C2E', afr: 'AFR', drive: 'Drive', sav: 'SAV', direct: 'Direct' };
const slotLab = n => String(Math.floor(n / 100)).padStart(2, '0') + ':' + String(n % 100).padStart(2, '0');
function prevHas() { return !!(D.prev && D.prev.mois && Object.keys(D.prev.mois).length); }
function prevMonths() { return Object.keys(D.prev.mois).sort(); }
function prevDayKeys(m) { return Object.keys(D.prev.poidsJour || {}).filter(d => d.startsWith(m)).sort(); }
function prevDayVol(m, d) {                                          // volumes du jour d (a/m × flux)
  const P = D.prev, w = (P.poidsJour || {})[d] || { a: {}, m: {} };
  const mo = (P.mois || {})[m] || { appels: {}, mails: {} };
  const o = { a: {}, m: {} };
  PACTS.forEach(f => { o.a[f] = (mo.appels[f] || 0) * (w.a[f] || 0); o.m[f] = (mo.mails[f] || 0) * (w.m[f] || 0); });
  return o;
}
function whPrevDay(k, c, d) {          // prévision du jour = prévu du mois × poids journalier
  const P = D.prev; if (!P || !P.mois) return null;   // k : 'hyper'… · c : 'a' (appels) | 'm' (mails) -> volume ou null
  const mk = mKey(d), mo = P.mois[mk]; if (!mo) return null;
  const src = c === 'a' ? mo.appels : mo.mails;
  const mv = src[k]; if (mv == null) return null;
  if (mv <= 0) return 0;
  const w = ((P.poidsJour || {})[d] || {})[c] || {};
  const wv = w[k];
  if (wv != null && wv > 0) return mv * wv;
  const ds = Object.keys(P.poidsJour || {}).filter(x => x.startsWith(mk));
  const nd = ds.length || new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate();
  return mv / nd;                                     // poids absent : répartition uniforme
}

function impPrev(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const find = test => wb.SheetNames.find(n => test(norm(n)));
  const s26 = wb.Sheets[find(n => n === '2026') || find(n => n.includes('2026'))];
  if (!s26) throw new Error('Onglet « 2026 » introuvable');
  const aoa = XLSX.utils.sheet_to_json(s26, { header: 1, raw: true, defval: null });
  const hI = aoa.findIndex(r => norm(r && r[0]).includes('volume contacts retours'));
  if (hI < 0) throw new Error('Ligne d\'en-têtes « Volume contacts Retours » introuvable (onglet 2026)');
  const months = [];
  for (let c = 2; c < (aoa[hI] || []).length; c++) { const d = isoD(aoa[hI][c]); if (d) months.push({ c, k: d.slice(0, 7) }); }
  if (months.length < 12) throw new Error('Mois introuvables dans la ligne d\'en-têtes (12 attendus)');
  const mois = {};
  const setV = (mk, k, f, v) => { const o = mois[mk] = mois[mk] || { appels: {}, mails: {} }; o[k][f] = Math.round(v * 100) / 100; };
  const DIR = { 'appels prevus afr': ['afr', 'appels'], 'mails prevus afr': ['afr', 'mails'],
    'appels prevus drive': ['drive', 'appels'], 'mails prevus drive': ['drive', 'mails'],
    'appels prevus sav': ['sav', 'appels'], 'mails prevus sav': ['sav', 'mails'],
    'appels prevus direct': ['direct', 'appels'], 'mails prevus direct': ['direct', 'mails'] };
  let cur = '';
  for (let r = hI + 1; r < aoa.length; r++) {
    const row = aoa[r] || []; const lab = norm(row[0]); if (!lab) continue;
    if (lab.includes('volume contacts hyper')) { cur = 'hyper'; continue; }
    if (lab.includes('volume contacts c2e')) { cur = 'c2e'; continue; }
    if (lab.includes('volume contacts')) { cur = ''; continue; }
    if (cur && (lab === 'voix' || lab === 'mails')) {
      const k = lab === 'voix' ? 'appels' : 'mails';
      months.forEach(mc => setV(mc.k, k, cur, n2(row[mc.c])));
      continue;
    }
    const hit = DIR[lab];
    if (hit) months.forEach(mc => setV(mc.k, hit[1], hit[0], n2(row[mc.c])));
  }
  if (!Object.keys(mois).length) throw new Error('Aucun prévu mensuel lu (onglet 2026)');

  const wP = wb.Sheets[find(n => n === 'poids') || find(n => n.includes('poids'))];
  if (!wP) throw new Error('Onglet « Poids » introuvable');
  const pa = XLSX.utils.sheet_to_json(wP, { header: 1, raw: true, defval: null });
  const WDS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const SLOTS = [['hyper', 'ls', 18], ['hyper', 'dim', 19], ['c2e', 'ls', 20], ['afr', 'ls', 21], ['afr', 'dim', 22],
    ['drive', 'ls', 23], ['drive', 'dim', 24], ['direct', 'ls', 25], ['sav', 'ls', 26]];
  const jours = {}, chat = {}, cre = {};
  for (let r = 0; r < pa.length; r++) {
    const row = pa[r] || []; const d = isoD(row[0]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || row[1] == null || row.length < 12) continue;
    jours[d] = { a: { hyper: n2(row[1]), c2e: n2(row[2]), afr: n2(row[3]), drive: n2(row[4]), sav: n2(row[5]), direct: 0 },
                 m: { hyper: n2(row[9]), c2e: 0, afr: n2(row[10]), drive: n2(row[11]), sav: 0, direct: 0 } };
    const mk = d.slice(0, 7);
    if (WDS.includes(norm(row[14])) && row[15] != null) (chat[mk] = chat[mk] || {})[norm(row[14])] = n2(row[15]);
    const sv = row[17];
    if (sv != null && Number.isFinite(+sv) && +sv >= 100 && +sv <= 2359 && Math.round(+sv) === +sv) {
      const fs = cre[mk] = cre[mk] || {};
      SLOTS.forEach(([f, p, c]) => {
        const pp = fs[f] = fs[f] || {};
        (pp[p] = pp[p] || {})[String(Math.round(+sv))] = n2(row[c]);
      });
    }
  }
  if (!Object.keys(jours).length) throw new Error('Aucun poids journalier lu (onglet Poids)');
  /* normalisation Σ = 1 (réconciliation jour→mois et créneau→jour) + repli profil « hyper » */
  const wsum = {};
  Object.entries(jours).forEach(([d, w]) => { const mk = d.slice(0, 7);
    ['a', 'm'].forEach(c => PACTS.forEach(f => wsum[mk + '|' + c + f] = (wsum[mk + '|' + c + f] || 0) + w[c][f])); });
  Object.entries(jours).forEach(([d, w]) => { const mk = d.slice(0, 7);
    ['a', 'm'].forEach(c => PACTS.forEach(f => { const s = wsum[mk + '|' + c + f];
      if (s > 0) w[c][f] = Math.round(w[c][f] / s * 1e6) / 1e6; })); });
  const mks = [...new Set(Object.keys(jours).map(d => d.slice(0, 7)))].sort();
  mks.forEach(mk => ['a', 'm'].forEach(c => PACTS.forEach(f => {
    if (wsum[mk + '|' + c + f] > 0) return;
    const k = c === 'a' ? 'appels' : 'mails';
    if (((mois[mk] || {})[k] || {})[f] > 0 && wsum[mk + '|' + c + 'hyper'] > 0)
      Object.keys(jours).forEach(d => { if (d.startsWith(mk)) jours[d][c][f] = jours[d][c].hyper; });
  })));
  Object.values(cre).forEach(fs => Object.values(fs).forEach(ps => Object.values(ps).forEach(sl => {
    const s = Object.values(sl).reduce((x, y) => x + y, 0);
    if (s > 0) Object.keys(sl).forEach(t => sl[t] = Math.round(sl[t] / s * 1e6) / 1e6);
  })));
  /* date du dernier snapshot (onglet Prévision, col. A) */
  let snap = '';
  const wPr = wb.Sheets[find(n => n.includes('prevision'))];
  if (wPr) XLSX.utils.sheet_to_json(wPr, { header: 1, raw: true, defval: null })
    .forEach(row => { const d = isoD(row && row[0]); if (d > snap) snap = d; });

  D.prev = { meta: { file: name, maj: new Date().toISOString().slice(0, 10), snapshot: snap },
             mois, poidsJour: jours, poidsChat: chat, creneaux: cre };
  D.meta.prev = name;
  return Object.keys(mois).length + ' mois de prévus · ' + Object.keys(jours).length + ' jours pondérés · créneaux 30 min' +
    (snap ? ' · prévision au ' + dShort(snap) : '');
}

/* ---- modèle planning (.xlsx) ---- */
function dlModele() {
  const aoa = [['date','activite','heures'],
               [isoD(new Date()), 'Hyper', 42],
               [isoD(new Date()), 'AFR', 18],
               [isoD(new Date()), 'Drive', 16]];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'PLANNING');
  XLSX.writeFile(wb, 'modele-planning.xlsx');
}

/* ---- gestion des fichiers ---- */
function bindImports() {
  $('fRoad').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stRoad', impRoadmap(f.name, b), true); afterImport('p1'); }
    catch (err) { setStatus('stRoad', 'Erreur : ' + err.message, false); }
  }));
  $('fCapa').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stCapa', impCapa(f.name, b), true); afterImport('p2'); }
    catch (err) { setStatus('stCapa', 'Erreur : ' + err.message, false); }
  }));
  $('fEtp').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stEtp', impEtp(f.name, b), true); afterImport('p1'); }
    catch (err) { setStatus('stEtp', 'Erreur : ' + err.message, false); }
  }));
  $('fPlan').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stPlan', impPlanH(f.name, b), true); afterImport('p3'); }
    catch (err) { setStatus('stPlan', 'Erreur : ' + err.message, false); }
  }));
  $('fReal').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stReal', impReal(f.name, b), true); afterImport('p5'); }
    catch (err) { setStatus('stReal', 'Erreur : ' + err.message, false); }
  }));
  $('fDmt').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stDmt', impDmt(f.name, b), true); afterImport('p6'); }
    catch (err) { setStatus('stDmt', 'Erreur : ' + err.message, false); }
  }));
  $('fMail').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stMail', impMail(f.name, b), true); afterImport('p7'); }
    catch (err) { setStatus('stMail', 'Erreur : ' + err.message, false); }
  }));
  $('fPmail').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stPmail', impPmail(f.name, b), true); afterImport('p5'); }
    catch (err) { setStatus('stPmail', 'Erreur : ' + err.message, false); }
  }));
  $('fPlanA').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stPlanA', impPlanning(f.name, b), true); afterImport('p8'); }
    catch (err) { setStatus('stPlanA', 'Erreur : ' + err.message, false); }
  }));
  $('fPrev').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stPrev', impPrev(f.name, b), true); afterImport('p4'); }
    catch (err) { setStatus('stPrev', 'Erreur : ' + err.message, false); }
  }));
}
function afterImport(page) {
  D.meta.maj = new Date().toISOString().slice(0, 10);
  save(); renderHead(); fillSelects();
  go(page);
}

/* ---------- export / démo / reset ---------- */
function dlJSON() {
  const blob = new Blob([JSON.stringify(D)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function demo() {
  const base = emptyData();
  const today = new Date().toISOString().slice(0, 10);
  base.meta = { rm2: 'Démo RM', capa: 'Démo CAPA', plan: 'Démo Planning', prod: 'Démo', maj: today };
  /* roadmap v2 démo : 18 semaines (S40__2026 → S5__2027), 12 activités, les 9 blocs */
  const nW = 18, w0 = 40, A2 = RM_ALL, F2 = RM_FAM_OF;
  const monday26 = w => addDays('2025-12-29', (w - 1) * 7);
  const weeks2 = Array.from({ length: nW }, (_, i) => {
    let n = w0 + i, y = 2026;
    if (n > 52) { n -= 52; y = 2027; }
    const st = y === 2026 ? monday26(n) : addDays(monday26(52), n * 7);
    return { k: 'S' + n + '__' + y, n, y, start: st, end: addDays(st, 6), days: 7 };
  });
  const pfinA = A2.map((a, ai) => Array.from({ length: nW }, (_, i) =>
    Math.max(40, Math.round(3000 * (1 + .45 * Math.sin(i / 3 + ai / 1.7)) + (ai % 3) * 120))));
  const capaA = A2.map((a, ai) => pfinA[ai].map(v => Math.round(v * (0.9 + 0.16 * Math.sin(ai + 1)))));
  const colSum = arr => Array.from({ length: nW }, (_, i) => arr.reduce((s, a) => s + (a[i] || 0), 0));
  const famSum = (arr, f) => Array.from({ length: nW }, (_, i) =>
    A2.reduce((s, k, ai) => s + (F2[k] === f ? (arr[ai][i] || 0) : 0), 0));
  const obj = arr => Object.fromEntries(A2.map((k, ai) => [k, arr[ai]]));
  const pack = arr => ({ row: 0, t: colSum(arr),
    fam: { FO: famSum(arr, 'FO'), BO: famSum(arr, 'BO'), AU: famSum(arr, 'AU') }, a: obj(arr) });
  const packR = arr => ({ row: 0, t: Array(nW).fill(null),
    fam: { FO: Array(nW).fill(null), BO: Array(nW).fill(null), AU: Array(nW).fill(null) }, a: obj(arr) });
  const mulA = (arr, f) => arr.map((row, ai) => row.map(v => Math.round(v * f(ai) * 100) / 100));
  const etpA = mulA(pfinA, () => 1 / 480);
  const effA = mulA(etpA, ai => 1.04 + 0.06 * Math.sin(ai));
  const S2 = {};
  S2.pfin = pack(pfinA);
  S2.prev = pack(pfinA.map(r => r.map(v => Math.round(v * 1.05))));
  S2.capa_a = pack(capaA);
  S2.bes_hlog = pack(mulA(pfinA, () => 0.14));
  S2.capa_hlog = pack(mulA(capaA, () => 0.15));
  S2.bes_hprod = pack(mulA(pfinA, () => 0.115));
  S2.capa_hprod = pack(mulA(capaA, () => 0.12));
  S2.bes_etp = pack(etpA);
  S2.eff = pack(effA);
  S2.eff_prod = pack(mulA(effA, () => 0.85));
  S2.delta_etp = pack(A2.map((k, ai) => S2.eff_prod.a[k].map((v, i) => Math.round((v - S2.bes_etp.a[k][i]) * 10) / 10)));
  S2.delta_h = pack(A2.map((k, ai) => S2.capa_hlog.a[k].map((v, i) => Math.round((v - S2.bes_hlog.a[k][i]) * 10) / 10)));
  S2.sla = packR(A2.map((k, ai) => capaA[ai].map((v, i) => Math.round(v / Math.max(1, pfinA[ai][i]) * 10000) / 10000)));
  S2.cible = packR(A2.map(k => Array(nW).fill(F2[k] === 'FO' ? 1.15 : 1)));
  S2.qp = packR(A2.map(() => Array(nW).fill(1)));
  S2.dmt = packR(A2.map((k, ai) => Array.from({ length: nW }, (_, i) =>
    Math.round(280 + 90 * Math.abs(Math.sin(ai + i / 3)) + 60 * (ai % 4)))));
  S2.prod_h = packR(A2.map((k, ai) => S2.dmt.a[k].map(d => Math.round(3600 / Math.max(60, d) * 10) / 10)));
  S2.occ = packR(A2.map((k, ai) => Array.from({ length: nW }, (_, i) =>
    Math.round((0.62 + 0.14 * Math.abs(Math.sin(i / 2.6 + ai / 2))) * 10000) / 10000)));
  S2.abs = packR(A2.map((k, ai) => Array.from({ length: nW }, (_, i) =>
    Math.round((0.08 + 0.05 * Math.abs(Math.sin(i / 4 + ai / 3))) * 10000) / 10000)));
  S2.conges = packR(A2.map((k, ai) => Array.from({ length: nW }, (_, i) =>
    Math.round((0.03 + 0.03 * Math.abs(Math.sin(i / 5 + ai / 4))) * 10000) / 10000)));
  S2.conges_etp = pack(A2.map((k, ai) => S2.eff.a[k].map((v, i) => Math.round(v * S2.conges.a[k][i] * 100) / 100)));
  base.rm2 = { v: 2, meta: { file: 'Démo RM', maj: today }, acts: A2.map(k => ({ k, fam: F2[k] })), weeks: weeks2, s: S2 };
  const dates = [];
  const t0 = new Date(); t0.setDate(t0.getDate() - 45);
  for (let i = 0; i <= 45; i++) { const d = new Date(t0); d.setDate(t0.getDate() + i); dates.push(d.toISOString().slice(0, 10)); }
  base.capa.dates = dates;
  base.capa.flux = FLOWS8.map((k, i) => ({
    k, c: k.startsWith('Mail') ? 'Mail' : 'Voix', a: k.split(' ')[1],
    prev:  dates.map(d => Math.round((k.startsWith('Mail') ? 60 : 420) + 150 * Math.sin(+d.slice(8) / 3 + i))),
    contr: dates.map(d => Math.round((k.startsWith('Mail') ? 55 : 380) + 120 * Math.sin(+d.slice(8) / 3 + i))),
    capa:  dates.map(d => Math.round((k.startsWith('Mail') ? 70 : 460) + 140 * Math.sin(+d.slice(8) / 3 + i + .5)))
  }));
  /* capacitaire en heures démo (actes ÷ 10) */
  base.capa.flux.forEach(f => {
    f.hrs      = f.capa.map(v => Math.round(v / 10 * 10) / 10);
    f.hrsPrev  = f.prev.map(v => Math.round(v / 10 * 10) / 10);
    f.hrsContr = f.contr.map(v => Math.round(v / 10 * 10) / 10);
  });
  /* planning démo : heures planifiées par jour × activité voix */
  const past = dates.filter(d => d <= today);
  const actsV = RFLOW.map(f => f.charAt(0) + f.slice(1).toLowerCase());
  const hrsDef = { HYPER: [42, 8], C2E: [6, 2], AFR: [18, 4], DRIVE: [16, 4], SAV: [24, 6] };
  base.planH = { file: 'Démo Planning', maj: today, dates: past.slice(), acts: actsV, f: {} };
  actsV.forEach(a => {
    const [bh, amp] = hrsDef[a.toUpperCase()] || [20, 5];
    base.planH.f[a] = past.map(d => Math.max(2, Math.round(bh + amp * Math.sin(+d.slice(8) / 3))));
  });
  base.prod = { file: 'Démo', def: { hyper: 10, c2e: 9, afr: 8, drive: 12, sav: 8, 'borne/lsa': 14, chat: 6 } };
  /* DMT démo cohérente : (com + acw) par flux × jour */
  const M = base.dmt; M.file = 'Démo Vonage'; M.maj = today;
  M.dates = past.slice(); M.flows = RFLOW.slice();
  M.flows.forEach((f, fi) => {
    M.f[f] = { n: [], com: [], acw: [] };
    M.dates.forEach(d => {
      const n = 60 + Math.round(120 * Math.abs(Math.sin(+d.slice(8) + fi)));
      const dm = Math.max(70, 160 + 45 * fi + 60 * Math.sin(+d.slice(8) / 4 + fi));
      M.f[f].n.push(n); M.f[f].com.push(n * Math.round(dm - 31)); M.f[f].acw.push(n * 31);
    });
  });
  /* mail démo : Export Mail + prévision mail */
  const ML = base.mail; ML.file = 'Démo Export Mail'; ML.maj = today;
  ML.dates = past.slice(); ML.flows = ['Hyper', 'AFR', 'Drive', 'Waaoh'];
  ML.flows.forEach((f, fi) => {
    ML.f[f] = { rec: [], tr: [], t60: [], del: [] };
    ML.dates.forEach(d => {
      const rec = 25 + Math.round(80 * Math.abs(Math.sin(+d.slice(8) + fi * 1.3)));
      const dm = Math.max(150, 330 + 70 * Math.sin(+d.slice(8) / 4 + fi));
      ML.f[f].rec.push(rec); ML.f[f].tr.push(rec);
      ML.f[f].t60.push(Math.round(rec * (0.03 + 0.05 * Math.abs(Math.sin(fi)))));
      ML.f[f].del.push(rec * Math.round(dm));
    });
  });
  base.pmail = { file: 'Démo Prévision Mail', maj: today, rows: [] };
  past.forEach(d => ML.flows.forEach((f, fi) =>
    base.pmail.rows.push([d, f, Math.round(30 + 22 * Math.sin(+d.slice(8) / 5 + fi))])));
  /* prévision démo : 1 mois (poids journaliers + créneaux 30 min) */
  const dmk = '2027-01', nD = 31;
  const dmo = { appels: { hyper: 15000, c2e: 60, afr: 4200, drive: 13000, sav: 8000, direct: 0 },
                mails: { hyper: 3300, c2e: 0, afr: 2100, drive: 2900, sav: 0, direct: 0 } };
  const dj = {}, slotsD = []; for (let t = 730; t <= 2030; t += 30) slotsD.push(t);
  const bell = t => Math.exp(-Math.pow(t - 1130, 2) / (2 * 180 * 180));
  const dcr = {}; PACTS.forEach(f => { dcr[f] = { ls: {}, dim: {} };
    slotsD.forEach(t => { dcr[f].ls[t] = f === 'direct' ? 0 : bell(t);
      dcr[f].dim[t] = ['hyper', 'afr', 'drive'].includes(f) && t >= 800 && t <= 1230 ? bell(t) * 3.2 : 0; });
    ['ls', 'dim'].forEach(p => { const s = Object.values(dcr[f][p]).reduce((x, y) => x + y, 0);
      if (s > 0) Object.keys(dcr[f][p]).forEach(t => dcr[f][p][t] = Math.round(dcr[f][p][t] / s * 1e6) / 1e6); }); });
  const wsumD = { a: 0, m: 0 };
  for (let d = 1; d <= nD; d++) {
    const dk = dmk + '-' + String(d).padStart(2, '0');
    const wd = new Date(dk + 'T00:00:00').getDay();
    const P = Math.pow(wd === 0 ? 0.25 : wd === 6 ? 0.7 : 1.08, wd === 0 ? 2 : 1);
    dj[dk] = { a: { hyper: P, c2e: P, afr: P, drive: P, sav: P, direct: 0 },
               m: { hyper: P, c2e: 0, afr: P, drive: P, sav: 0, direct: 0 } };
    wsumD.a += P; wsumD.m += P;
  }
  Object.keys(dj).forEach(dk => { ['a', 'm'].forEach(c => Object.keys(dj[dk][c]).forEach(f =>
    dj[dk][c][f] = Math.round(dj[dk][c][f] / wsumD[c] * 1e6) / 1e6)); });
  base.prev = { meta: { file: 'Démo Webhelp', maj: today, snapshot: today }, mois: { [dmk]: dmo },
    poidsJour: dj, poidsChat: {}, creneaux: { [dmk]: dcr } };
  /* planification démo : 12 agents prod + 4 FIM (hors prod) + allaitement pour 1 agent */
  const agentsD = [];
  for (let i = 0; i < 12; i++) agentsD.push({ n: 'Agent LOT ' + (i + 1), fim: false, alla: i === 2 ? 1 : 0 });
  for (let i = 0; i < 4; i++) agentsD.push({ n: 'Agent FIM ' + (i + 1), fim: true, alla: 0 });
  const dr = [];
  past.forEach((d, di) => {
    const wd = new Date(d + 'T00:00:00').getDay();
    agentsD.forEach((a, ai) => {
      if ((di + ai) % 7 === 3) return;                              // day off
      const sin = 10 * 60 + (ai % 3) * 30;
      const sout = sin + (wd === 0 ? 5 : 9) * 60 - (wd === 6 ? 2 * 60 : 0);
      const r1 = sin + 240, r2 = r1 + 60;
      dr.push({ ok: true, d, ag: a.n, fimrow: a.fim, sin, sout, r1, r2,
        hp: (sout - sin - 60) / 60, alla: a.alla, fim: a.fim ? (sout - sin - 60) / 60 : 0 });
    });
  });
  base.plan = planAgg(dr);
  base.plan.meta = Object.assign(base.plan.meta, { file: 'Démo Planning', maj: today });
  /* réalisé démo : DRM voix cohérent avec la capacitaire */
  const R = base.real; R.file = 'Démo DRM'; R.maj = today;
  past.forEach(d => {
    R.dates.push(d); R.sem.push(isoWeek(d)); R.jours.push(jJours(d));
    RFLOW.forEach((fl, fi) => {
      const rec = 80 + Math.round(300 * Math.abs(Math.sin(+d.slice(8) + fi * 1.1)));
      const tr = Math.round(rec * (0.9 + 0.08 * Math.random()));
      R.f[fl].r.push(rec); R.f[fl].t.push(tr); R.f[fl].s.push(Math.round(tr * 0.62));
    });
  });
  D = base; ensure();
  buildRoadmapCompat();
  renderHead(); fillSelects(); go('p1');
}

/* =====================================================================
   SÉLECTEURS COMMUNS
   ===================================================================== */
function fillSelects() {
  /* p1 : semaine analysée (modèle RM v2) — périmètre piloté par les filtres globaux */
  const R = D.rm2;
  const sw = $('w1W');
  if (R && R.weeks && R.weeks.length) {
    const curW = sw.value;
    sw.innerHTML = R.weeks.map((w, i) => `<option value="${i}">${w.k} · du ${w.start ? dShort(w.start) : '?'} </option>`).join('');
    const t = new Date().toISOString().slice(0, 10);
    const defI = Math.max(0, R.weeks.findIndex(w => w.start && w.start >= t) >= 0
      ? R.weeks.findIndex(w => w.start && w.start >= t) : R.weeks.length - 1);
    sw.value = [...sw.options].some(o => o.value === curW) ? curW : String(defI);
  } else { sw.innerHTML = ''; }
  /* sources */
  $('w1Src').textContent = R && R.weeks && R.weeks.length
    ? 'Modèle RM : ' + (D.meta.rm2 || (R.meta && R.meta.file) || 'RM') + ' · ' + R.weeks.length + ' sem.'
    : 'Modèle RM : à importer';
  $('w2Src').textContent = 'Capacitaire : ' + (D.capa.dates.length ? D.meta.capa : '—');
  $('w3Src').textContent = 'Planning (h) : ' + (D.planH.dates.length ? D.planH.file : 'à importer') +
    (D.capa.dates.length ? ' · Capacitaire : ' + (D.meta.capa || 'importée') : '');
  $('w5Src').textContent = 'Phone : DRM + Vonage · Mail : Export Mail · Chat : —';
  fill4();
  $('w4Src').textContent = prevHas()
    ? 'Prévision Webhelp : ' + (D.meta.prev || (D.prev.meta && D.prev.meta.file) || 'Webhelp') +
      (D.prev.meta && D.prev.meta.snapshot ? ' · au ' + dShort(D.prev.meta.snapshot) : '')
    : 'Prévision Webhelp : à importer';
  renderProdEd();
}

/* =====================================================================
   FILTRES DE PÉRIODE GLOBAUX (Période -> Intervalle du/au, cf. barre gBar)
   ===================================================================== */
function perBounds(p) {                                            // bornes de données de l'onglet
  switch (p) {
    case 'p1': { const R2 = D.rm2;
                 if (R2 && R2.weeks && R2.weeks.length) {
                   const s = R2.weeks[0].start, e = R2.weeks[R2.weeks.length - 1].end || R2.weeks[R2.weeks.length - 1].start;
                   return s && e ? [s, e] : []; }
                 return []; }
    case 'p2': { const d = D.capa.dates; return d.length ? [d[0], d[d.length - 1]] : []; }
    case 'p3': { const d = [...D.capa.dates, ...D.planH.dates].filter(Boolean).sort();
                 return d.length ? [d[0], d[d.length - 1]] : []; }
    case 'p5': { const d = [...D.real.dates, ...D.mail.dates].filter(Boolean).sort();
                 return d.length ? [d[0], d[d.length - 1]] : []; }
    case 'p8': { const d = (D.plan && D.plan.dates) || []; return d.length ? [d[0], d[d.length - 1]] : []; }
  }
  return [];
}
function perRange() { return [GF.a || '', GF.b || '']; }
function inPer(p, d) { return (!GF.a || d >= GF.a) && (!GF.b || d <= GF.b); }
function noPer(p, elK, charts, tbl) {                              // affichage « période vide » générique
  $(elK).innerHTML = '<div class="kpi"><div class="lbl">Aucune donnée sur la période</div><div class="sub">\u00c9largissez le filtre de période (barre de filtres).</div></div>';
  (charts || []).forEach(c => mkChart(c, { type: 'bar', data: { labels: [], datasets: [] } }));
  if (tbl) $(tbl).innerHTML = '';
}

/* =====================================================================
   P1 — ROADMAP (besoin & capacité — modèle RM S46+, hebdo)
   9 blocs : heures log/prod · actes · ETP · effectif · SLA/QE · DMT · TO · absentéisme · congés
   ===================================================================== */
function rmActsSel() {                            // activités retenues par les filtres globaux (Flux / Channel / Activités)
  if (!D.rm2) return [];
  return D.rm2.acts.filter(a => gfPass(a.k)).map(a => a.k);
}
function rmAggM(sec, acts) {                      // série hebdo agrégée sur un ensemble d'activités
  const R = D.rm2, S = R.s[sec], W = R.weeks.length;
  if (!S) return null;
  const rate = RM_RATE.has(sec);
  const wsrc = R.s[RM_WBY[sec] || 'pfin'];
  const out = Array(W).fill(null);
  for (let i = 0; i < W; i++) {
    let sa = 0, any = false, sv = 0, sw = 0;
    acts.forEach(k => {
      const x = (S.a[k] || [])[i];
      if (x == null) return;
      if (rate) {
        const wt = ((wsrc && wsrc.a[k]) || [])[i] || 0;
        if (wt > 0) { sv += x * wt; sw += wt; }
      } else { sa += x; any = true; }
    });
    if (rate && sw > 0) out[i] = sv / sw;
    else if (!rate && any) out[i] = sa;
  }
  return out;
}
function rmQEacts(acts, i) {                      // QE = Σ capacité actes / Σ prévision finale
  let c = 0, p = 0;
  acts.forEach(k => {
    const CA = D.rm2.s.capa_a, PF = D.rm2.s.pfin;
    const ca = CA && CA.a[k] ? CA.a[k][i] : null, pf = PF && PF.a[k] ? PF.a[k][i] : null;
    if (ca != null) c += ca;
    if (pf != null) p += pf;
  });
  return p > 0 ? c / p : null;
}
function rmWindow(saI) {
  const W = D.rm2.weeks.length, f = $('w1F').value;
  if (f === 'all') return Array.from({ length: W }, (_, i) => i);
  const n = +f, back = n >= 27 ? 13 : 4, fwd = n >= 27 ? 13 : 8;
  const a = Math.max(0, saI - back), b = Math.min(W - 1, saI + fwd);
  const out = []; for (let i = a; i <= b; i++) out.push(i);
  return out;
}
function r1() {
  const R = D.rm2;
  const C1 = ['c1a', 'c1b', 'c1c', 'c1d', 'c1e', 'c1f', 'c1g', 'c1h', 'c1i'];
  const blank = () => {
    $('k1').innerHTML = '<div class="kpi"><div class="lbl">Aucun modèle RM</div><div class="sub">Importez le modèle RM (.xlsm, onglet AUCHAN) via « Importer » — besoin &amp; capacité, SLA/QE, DMT, occupation, absentéisme, congés.</div></div>';
    C1.forEach(c => mkChart(c, { type: 'bar', data: { labels: [], datasets: [] } }));
    $('t1').innerHTML = ''; $('h1').textContent = ''; $('t1Per').textContent = '—';
    $('w1Src').textContent = 'Modèle RM : à importer';
  };
  if (!R || !R.weeks || !R.weeks.length) { blank(); return; }
  const acts = rmActsSel();
  const perLbl = gfLbl();
  const W = R.weeks.length;
  const saI = Math.min(W - 1, Math.max(0, +($('w1W').value || 0) || 0));
  const win = rmWindow(saI).filter(i => {                        // + filtre de période / intervalle global
    const w = R.weeks[i], e = w.end || w.start;
    return (!GF.a || e >= GF.a) && (!GF.b || w.start <= GF.b); });
  if (!win.length) {
    $('k1').innerHTML = '<div class="kpi"><div class="lbl">Aucune semaine sur la période</div><div class="sub">Élargissez la Période ou l\'Intervalle dans la barre de filtres.</div></div>';
    C1.forEach(c => mkChart(c, { type: 'bar', data: { labels: [], datasets: [] } }));
    $('t1').innerHTML = ''; $('h1').textContent = ''; $('t1Per').textContent = '—';
    return;
  }
  const showY = new Set(win.map(i => R.weeks[i].y)).size > 1;
  const labels = win.map(i => { const w = R.weeks[i]; return 'S' + w.n + (showY ? ' ' + String(w.y).slice(2) : ''); });
  const ttip = win.map(i => { const w = R.weeks[i];
    return w.k + (w.start ? ' · du ' + dShort(w.start) + (w.end ? ' au ' + dShort(w.end) : '') : ''); });
  const secs = ['pfin', 'prev', 'capa_a', 'bes_hlog', 'capa_hlog', 'bes_hprod', 'capa_hprod', 'bes_etp',
    'eff_prod', 'delta_etp', 'dmt', 'occ', 'abs', 'conges', 'conges_etp', 'eff', 'cible'];
  const F = { qe: Array(W).fill(null) };
  secs.forEach(s => { F[s] = rmAggM(s, acts) || Array(W).fill(null); });
  for (let i = 0; i < W; i++) F.qe[i] = rmQEacts(acts, i);
  const pI = saI > 0 ? saI - 1 : null;
  const dPts = (a, b) => a != null && b != null ? ' · Δ ' + (a - b >= 0 ? '+' : '') + (Math.round((a - b) * 1000) / 10) + ' pts' : '';
  const dPct = (a, b) => a != null && b != null && b !== 0 ? ' · Δ ' + (a >= b ? '+' : '') + (Math.round((a / b - 1) * 1000) / 10) + ' %' : '';
  const pc1 = v => v == null ? '—' : (Math.round(v * 1000) / 10) + ' %';
  const wSA = R.weeks[saI];

  /* ---- KPIs de la semaine analysée ---- */
  const qe = F.qe[saI], pf = F.pfin[saI], ca = F.capa_a[saI];
  const dE = F.delta_etp[saI], ep = F.eff_prod[saI], ab = F.abs[saI], oc = F.occ[saI];
  $('k1').innerHTML =
    kpi('SLA / QE — ' + perLbl, pc1(qe), 'capa actes / prévision finale' + dPts(qe, pI != null ? F.qe[pI] : null) +
        ' · cible ' + pc1(F.cible[saI]), qe != null ? Math.min(100, qe * 100) : 0) +
    kpi('Prévision finale', pf == null ? '—' : fmt(Math.round(pf)), 'actes · ' + wSA.k + dPct(pf, pI != null ? F.pfin[pI] : null)) +
    kpi('Capacité actes', ca == null ? '—' : fmt(Math.round(ca)), 'couverture ' + pctS(ca, pf)) +
    kpi('Heures de log', F.capa_hlog[saI] == null ? '—' : fmt(Math.round(F.capa_hlog[saI])) + ' h',
        'besoin ' + (F.bes_hlog[saI] != null ? fmt(Math.round(F.bes_hlog[saI])) + ' h' : '—') +
        ' · capa prod ' + (F.capa_hprod[saI] != null ? fmt(Math.round(F.capa_hprod[saI])) + ' h' : '—')) +
    kpi('Écart ETP', dE == null ? '—' : (dE >= 0 ? '+' : '') + fmt1(dE),
        'capacité − besoin' + (dE == null ? '' : dE >= 0 ? ' · surplus' : ' · tension')) +
    kpi('Effectif productif', ep == null ? '—' : fmt1(ep) + ' ETP',
        'besoin ' + (F.bes_etp[saI] != null ? fmt1(F.bes_etp[saI]) + ' ETP' : '—')) +
    kpi('Absentéisme', pc1(ab), 'hypothèse du modèle RM') +
    kpi("Taux d'occupation", pc1(oc), 'hypothèse pondérée', oc != null ? oc * 100 : 0);

  /* ---- réglages communs des graphiques ---- */
  const u = $('s1U').value;
  const xA = { grid: { display: false }, ticks: { maxTicksLimit: 13 } };
  const yN = lab => ({ beginAtZero: true, grid: GRID, ticks: { callback: v => fmt(v) },
    title: { display: !!lab, text: lab, font: { size: 10.5 } } });
  const opt = (yOpts, tipLbl) => ({ maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' },
      tooltip: { callbacks: { title: c => ttip[c[0].dataIndex],
        label: tipLbl || (c => ' ' + c.dataset.label + ' : ' + fmt(c.parsed.y ?? c.parsed)) } } },
    scales: { x: xA, y: yOpts } });
  const thin = (sec, mul) => R.acts.filter(a => acts.includes(a.k)).map((a, ai) => ({
    label: a.k, data: win.map(i => { const v = (R.s[sec] && R.s[sec].a[a.k] || [])[i];
      return v == null ? null : (mul ? Math.round(v * mul * 10) / 10 : v); }),
    borderColor: PAL[ai % PAL.length], borderWidth: 1, pointRadius: 0, tension: .3, spanGaps: true, hidden: true }));

  /* 1 · heures — capacité vs besoin (log ou prod) */
  const bh = u === 'log' ? F.bes_hlog : F.bes_hprod, chh = u === 'log' ? F.capa_hlog : F.capa_hprod;
  mkChart('c1a', { type: 'bar', data: { labels, datasets: [
      { label: 'Besoin', data: win.map(i => bh[i]), backgroundColor: '#e8590c', borderRadius: 3 },
      { label: 'Capacité', data: win.map(i => chh[i]), backgroundColor: '#3b5bdb', borderRadius: 3 }] },
    options: opt(yN(u === 'log' ? 'heures de log / sem.' : 'heures de prod / sem.'),
      c => ' ' + c.dataset.label + ' : ' + fmt(c.parsed.y ?? 0) + ' h') });

  /* 2 · actes — capacité vs prévision finale */
  mkChart('c1b', { type: 'bar', data: { labels, datasets: [
      { label: 'Capacité (actes)', data: win.map(i => F.capa_a[i]), backgroundColor: '#0ca678', borderRadius: 3 },
      { label: 'Prévision finale', data: win.map(i => F.pfin[i]), type: 'line', borderColor: '#1b2440',
        borderWidth: 2, pointRadius: 0, tension: .3 },
      ...(F.prev.some(v => v != null && v !== 0) ? [{ label: 'Prévision initiale', data: win.map(i => F.prev[i]),
        type: 'line', borderColor: '#f59f00', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, tension: .3 }] : [])] },
    options: opt(yN('actes / sem.')) });

  /* 3 · ETP — besoin vs effectif productif + écart */
  mkChart('c1c', { type: 'bar', data: { labels, datasets: [
      { label: 'Besoin ETP', data: win.map(i => F.bes_etp[i]), backgroundColor: '#e8590c', borderRadius: 3 },
      { label: 'Effectif productif', data: win.map(i => F.eff_prod[i]), backgroundColor: '#7048e8', borderRadius: 3 },
      { label: 'Écart (capa − besoin)', data: win.map(i => F.delta_etp[i]), type: 'line', borderColor: '#1b2440',
        borderWidth: 2, pointRadius: 1.5, tension: .3, spanGaps: true }] },
    options: opt(yN('ETP'), c => ' ' + c.dataset.label + ' : ' + fmt1(c.parsed.y ?? 0)) });

  /* 4 · effectif */
  mkChart('c1d', { type: 'bar', data: { labels, datasets: [
      { label: 'Effectif (ETP activités)', data: win.map(i => F.eff[i]), backgroundColor: '#1098ad', borderRadius: 3 },
      ...(acts.length === R.acts.length ? [{ label: 'Effectif saisi (fichier)', data: win.map(i => R.s.eff ? R.s.eff.t[i] : null),
        type: 'line', borderColor: '#1b2440', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, tension: .3 }] : [])] },
    options: opt(yN('ETP'), c => ' ' + c.dataset.label + ' : ' + fmt1(c.parsed.y ?? 0)) });

  /* 5 · SLA / QE vs cible (+ seuils 95 % / 90 %) */
  mkChart('c1e', { type: 'line', data: { labels, datasets: [
      { label: 'QE', data: win.map(i => F.qe[i] != null ? Math.round(F.qe[i] * 1000) / 10 : null),
        borderColor: '#3b5bdb', borderWidth: 2.5, pointRadius: 2, tension: .3, spanGaps: true },
      { label: 'Cible', data: win.map(i => F.cible[i] != null ? Math.round(F.cible[i] * 1000) / 10 : null),
        borderColor: '#1b2440', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, spanGaps: true },
      { label: 'Seuil 95 %', data: labels.map(() => 95), borderColor: '#2f9e44', borderWidth: 1, borderDash: [3, 5], pointRadius: 0 },
      { label: 'Seuil 90 %', data: labels.map(() => 90), borderColor: '#e03131', borderWidth: 1, borderDash: [3, 5], pointRadius: 0 }] },
    options: opt({ beginAtZero: false, grid: GRID, ticks: { callback: v => v + ' %' } },
      c => ' ' + c.dataset.label + ' : ' + (c.parsed.y == null ? '—' : c.parsed.y + ' %')) });

  /* 6 · DMT (secondes) — agrégé pondéré + activités (masquées) */
  mkChart('c1f', { type: 'line', data: { labels, datasets: [
      { label: 'DMT — ' + perLbl, data: win.map(i => F.dmt[i] != null ? Math.round(F.dmt[i]) : null),
        borderColor: '#1b2440', borderWidth: 2.5, pointRadius: 2, tension: .3, spanGaps: true },
      ...thin('dmt')] },
    options: opt({ beginAtZero: true, grid: GRID, ticks: { precision: 0 }, title: { display: true, text: 'secondes', font: { size: 10.5 } } },
      c => ' ' + c.dataset.label + ' : ' + (c.parsed.y == null ? '—' : Math.round(c.parsed.y) + ' s')) });

  /* 7 · taux d'occupation */
  mkChart('c1g', { type: 'line', data: { labels, datasets: [
      { label: 'TO — ' + perLbl, data: win.map(i => F.occ[i] != null ? Math.round(F.occ[i] * 1000) / 10 : null),
        borderColor: '#7048e8', borderWidth: 2.5, pointRadius: 2, tension: .3, spanGaps: true },
      ...thin('occ', 100)] },
    options: opt({ beginAtZero: true, grid: GRID, ticks: { callback: v => v + ' %' } },
      c => ' ' + c.dataset.label + ' : ' + (c.parsed.y == null ? '—' : c.parsed.y + ' %')) });

  /* 8 · absentéisme */
  mkChart('c1h', { type: 'bar', data: { labels, datasets: [
      { label: 'Absentéisme', data: win.map(i => F.abs[i] != null ? Math.round(F.abs[i] * 1000) / 10 : null),
        backgroundColor: '#e8590c', borderRadius: 3 }] },
    options: opt({ beginAtZero: true, grid: GRID, ticks: { callback: v => v + ' %' } },
      c => ' ' + c.dataset.label + ' : ' + (c.parsed.y == null ? '—' : c.parsed.y + ' %')) });

  /* 9 · congés (ETP, feuille Congés ; sinon taux) */
  const ce = win.map(i => F.conges_etp[i]);
  const ceMode = ce.some(v => v != null && v !== 0) ? 'etp' : 'taux';
  mkChart('c1i', { type: 'bar', data: { labels, datasets: [
      { label: ceMode === 'etp' ? 'Congés (ETP)' : 'Congés (taux)',
        data: ceMode === 'etp' ? ce : win.map(i => F.conges[i] != null ? Math.round(F.conges[i] * 1000) / 10 : null),
        backgroundColor: '#1098ad', borderRadius: 3 }] },
    options: opt(ceMode === 'etp' ? yN('ETP en congés') : { beginAtZero: true, grid: GRID, ticks: { callback: v => v + ' %' } },
      c => ' ' + c.dataset.label + ' : ' + (c.parsed.y == null ? '—' : ceMode === 'etp' ? fmt1(c.parsed.y) : c.parsed.y + ' %')) });

  /* ---- tableau hebdomadaire ---- */
  const fmtC = { vol: v => v == null ? '—' : fmt(Math.round(v)), e: v => v == null ? '—' : fmt1(v),
    pc: v => v == null ? '—' : (Math.round(v * 1000) / 10) + ' %', s: v => v == null ? '—' : Math.round(v) + ' s' };
  const cols = [['Prévu final', 'pfin', fmtC.vol], ['Prévu init.', 'prev', fmtC.vol], ['Capa actes', 'capa_a', fmtC.vol],
    ['Besoin h log', 'bes_hlog', fmtC.vol], ['Capa h log', 'capa_hlog', fmtC.vol],
    ['Besoin h prod', 'bes_hprod', fmtC.vol], ['Capa h prod', 'capa_hprod', fmtC.vol],
    ['Besoin ETP', 'bes_etp', fmtC.e], ['Eff. productif', 'eff_prod', fmtC.e], ['Écart ETP', 'delta_etp', fmtC.e],
    ['QE', 'qe', fmtC.pc], ['Cible', 'cible', fmtC.pc], ['DMT', 'dmt', fmtC.s],
    ['Occup.', 'occ', fmtC.pc], ['Abs.', 'abs', fmtC.pc], ['Congés ETP', 'conges_etp', fmtC.e], ['Effectif', 'eff', fmtC.e]];
  let h = '<thead><tr><th>Semaine</th><th>Début</th><th>J.</th>' + cols.map(c => `<th>${c[0]}</th>`).join('') + '</tr></thead><tbody>';
  win.forEach(i => {
    const w = R.weeks[i];
    h += `<tr><td>${w.k}</td><td>${w.start ? dShort(w.start) : '—'}</td><td>${w.days ?? '—'}</td>` +
      cols.map(([, key, f]) => `<td>${f(F[key] ? F[key][i] : null)}</td>`).join('') + '</tr>';
  });
  h += '</tbody><tfoot><tr><td colspan="3">' + perLbl + ' · ' + labels[0] + ' → ' + labels[labels.length - 1] + '</td>';
  cols.forEach(([, key]) => {
    const vs = win.map(i => F[key] ? F[key][i] : null).filter(v => v != null);
    if (!vs.length) { h += '<td>—</td>'; return; }
    if (['pfin', 'prev', 'capa_a', 'bes_hlog', 'capa_hlog', 'bes_hprod', 'capa_hprod', 'conges_etp'].includes(key))
      h += '<td>' + fmt(Math.round(vs.reduce((a, b) => a + b, 0))) + '</td>';
    else if (key === 'dmt') h += '<td>' + Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) + ' s</td>';
    else if (['bes_etp', 'eff_prod', 'delta_etp', 'eff'].includes(key))
      h += '<td>' + fmt1(vs.reduce((a, b) => a + b, 0)) + '</td>';
    else h += '<td>' + fmtC.pc(vs.reduce((a, b) => a + b, 0) / vs.length) + '</td>';
  });
  h += '</tr></tfoot>';
  $('t1').innerHTML = h;
  $('t1Per').textContent = perLbl;

  const notes = [];
  if (ceMode === 'taux') notes.push('Congés en ETP indisponibles (feuille Congés absente) — courbe affichée en taux (%).');
  if (perLbl === 'Total') notes.push('« Effectif saisi » = ligne Effectif du fichier (têtes) ; les barres = somme des ETP répartis par activité.');
  notes.push('QE = capacité actes ÷ prévision finale · DMT / TO / absentéisme agrégés en pondéré (poids : prévision ou effectif).');
  $('h1').textContent = notes.join(' ');
  $('w1Src').textContent = 'Modèle RM : ' + (D.meta.rm2 || (R.meta && R.meta.file) || 'RM') +
    ' · ' + W + ' sem. (' + R.weeks[0].k + ' → ' + R.weeks[W - 1].k + ') · ' + perLbl;
}
const kpi = (lbl, val, sub, bar) =>
  `<div class="kpi"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub || ''}</div>` +
  (bar != null ? `<div class="bar"><i style="width:${Math.min(100, bar)}%"></i></div>` : '') + '</div>';

/* =====================================================================
   P2 — CAPACITAIRE (actes & heures, jour / semaine / mois)
   ===================================================================== */
function aggBy(dates, g) {                          // -> clés de période + index de regroupement
  const keys = [], idx = [];
  const kOf = d => g === 'jour' ? d : g === 'semaine' ? wLab(d) : mKey(d);
  dates.forEach(d => { const k = kOf(d); const i = keys.indexOf(k); if (i < 0) { keys.push(k); idx.push(keys.length - 1); } else idx.push(i); });
  return { keys, idx };
}
function hrsOf(f, oi) {                             // capacitaire en heures d'un flux : fichier ou conversion
  if (f.hrs && f.hrs.length && f.hrs[oi]) return { v: f.hrs[oi], conv: false };
  const p = prodOf(f.a);
  if (p) return { v: (f.capa[oi] || 0) / p, conv: true };
  return { v: null, conv: false };
}
function renderProdEd() {                           // hypothèses de productivité (actes / heure)
  const el = $('prodEd'); if (!el) return;
  const set = new Map();
  const add = a => { const k = norm(a); if (k && !set.has(k)) set.set(k, a); };
  D.capa.flux.forEach(f => add(f.a));
  D.roadmap.forEach(r => add(r.a));
  RFLOW.forEach(f => add(f.charAt(0) + f.slice(1).toLowerCase()));
  D.planH.acts.forEach(add);
  el.innerHTML = set.size ? [...set.entries()].map(([k, nice]) =>
    `<div class="pitem"><label>${nice}</label><input type="number" min="0" step="0.5" data-k="${k}" value="${D.prod.def[k] ?? ''}" placeholder="actes/h"></div>`).join('')
    : '<span class="hint">Aucune activité connue — importez la Capacitaire ou la Roadmap.</span>';
  el.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
    const v = n2(inp.value);
    if (v > 0) D.prod.def[inp.dataset.k] = v; else delete D.prod.def[inp.dataset.k];
    D.prod.file = 'hypothèses manuelles'; save(); r2(); if (PAGE === 'p3') r3();
  }));
}
function r2() {
  const C = D.capa;
  if (!C.dates.length) { $('k2').innerHTML = '<div class="kpi"><div class="lbl">Aucune capacitaire</div><div class="sub">Importez le fichier Capacitaire (onglet DAILY VISION).</div></div>'; $('t2').innerHTML = ''; mkChart('c2a', { type: 'bar', data: { labels: [], datasets: [] } }); renderProdEd(); return; }
  const g = GF.g, u = $('s2U').value;                                     // u : 'a' = actes, 'h' = heures
  const fluxAll = C.flux.filter(f => gfPass(f.k));
  if (!fluxAll.length) {
    $('k2').innerHTML = '<div class="kpi"><div class="lbl">Aucune activité dans ce périmètre</div><div class="sub">Ajustez les filtres Flux / Channel / Activités.</div></div>';
    $('t2').innerHTML = ''; mkChart('c2a', { type: 'bar', data: { labels: [], datasets: [] } }); return;
  }
  const keep = C.dates.map((d, i) => [d, i]).filter(([d]) => inPer('p2', d)).map(([, i]) => i);
  if (!keep.length) { noPer('p2', 'k2', ['c2a'], 't2'); return; }
  const fD = keep.map(i => C.dates[i]);
  const { keys, idx } = aggBy(fD, g);
  const zero = () => Array(keys.length).fill(0);
  const flux = fluxAll;
  const acc = flux.map(() => zero());
  const tPrev = zero(), tContr = zero();
  let convUsed = false, hMissing = false, whUsed = false;
  flux.forEach((f, fi) => {
    const pk = actKeyOf(f.k).toLowerCase(), pc = f.c === 'Mail' ? 'm' : 'a';
    keep.forEach((oi, k) => {
      const d = C.dates[oi];
      const ca = f.capa[oi] || 0, ct = f.contr[oi] || 0;
      const wh = whPrevDay(pk, pc, d);                    // répartition journalière pondérée par la prévision
      let pv; if (wh != null) { pv = wh; whUsed = true; } else pv = f.prev[oi] || 0;
      if (u === 'a') {
        acc[fi][idx[k]] += ca; tPrev[idx[k]] += pv; tContr[idx[k]] += ct;
      } else {
        const hc = hrsOf(f, oi);
        if (hc.v != null) { acc[fi][idx[k]] += hc.v; if (hc.conv) convUsed = true; }
        else if (ca) hMissing = true;
        const hp = prodOf(f.a);
        if (f.hrsPrev && f.hrsPrev.length && f.hrsPrev[oi]) tPrev[idx[k]] += f.hrsPrev[oi];
        else if (hp) tPrev[idx[k]] += pv / hp;
        if (f.hrsContr && f.hrsContr.length && f.hrsContr[oi]) tContr[idx[k]] += f.hrsContr[oi];
        else if (hp) tContr[idx[k]] += ct / hp;
      }
    });
  });
  const capaTot = acc.reduce((a, s) => s.map((v, i) => v + a[i]), zero());
  const tCapa = capaTot.reduce((a, b) => a + b, 0), P = tPrev.reduce((a, b) => a + b, 0), K = tContr.reduce((a, b) => a + b, 0);
  const labU = u === 'a' ? 'actes' : 'heures', labO = u === 'a' ? 'heures' : 'actes';
  /* total dans l'autre unité (info croisée) */
  let totO = 0, anyO = false, convO = false;
  flux.forEach(f => keep.forEach(oi => {
    if (u === 'a') { const hc = hrsOf(f, oi); if (hc.v != null) { totO += hc.v; anyO = true; if (hc.conv) convO = true; } }
    else { totO += f.capa[oi] || 0; anyO = true; }
  }));
  const srcNote = u === 'h' ? (hMissing ? 'heures manquantes : définissez les hypothèses' : (convUsed ? 'heures = actes ÷ hypothèses' : 'heures issues du fichier CAPA'))
                            : (anyO ? (convO ? 'heures = actes ÷ hypothèses' : 'heures issues du fichier CAPA') : 'hypothèses de productivité à définir');
  $('k2').innerHTML =
    kpi('Capacitaire (' + labU + ')', fmt(tCapa), keys[0] + ' → ' + keys[keys.length - 1]) +
    kpi('Capacitaire (' + labO + ')', anyO && totO ? fmt(Math.round(totO)) : '—', srcNote) +
    kpi('Prévu total', fmt(Math.round(P)), 'couverture ' + pctS(tCapa, P) +
        (whUsed ? ' · répartition journalière pondérée par la prévision (poids du mois)' : ' · prévu du fichier capacitaire')) +
    kpi('Contractuel total', fmt(Math.round(K)), pctS(K, tCapa) + ' de la capacité');
  mkChart('c2a', { type: 'bar', data: { labels: keys, datasets: [
      ...acc.map((s, i) => ({ label: flux[i].k, data: s.map(v => Math.round(v * 10) / 10), backgroundColor: PAL[i % PAL.length], stack: 'c', borderRadius: 2 })),
      { label: 'Prévu', data: tPrev.map(v => Math.round(v * 10) / 10), type: 'line', borderColor: '#1b2440', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, tension: .3 },
      { label: 'Contractuel', data: tContr.map(v => Math.round(v * 10) / 10), type: 'line', borderColor: '#e8590c', borderWidth: 2, pointRadius: 0, tension: .3 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axisY(labU) } } });
  /* tableau */
  let h = '<thead><tr><th>Période</th><th>Capacitaire (' + labU + ')</th><th>Prévu</th><th>Contractuel</th><th>Capa − Prévu</th><th>Couverture</th></tr></thead><tbody>';
  keys.forEach((k, i) => {
    const e = capaTot[i] - tPrev[i];
    h += `<tr><td>${k}</td><td>${fmt(capaTot[i])}</td><td>${fmt(tPrev[i])}</td><td>${fmt(tContr[i])}</td>` +
         `<td class="${e < 0 ? 'neg' : 'pos'}">${fmt(e)}</td><td>${pctS(capaTot[i], tPrev[i])}</td></tr>`;
  });
  $('t2').innerHTML = h + '</tbody>';
}

/* =====================================================================
   P3 — CAPA PRÉVU VS CAPA RÉEL
   Capa prévue : fichier Capacitaire (actes, heures si présentes)
   Capa réelle : Planning (heures planifiées) → actes via hypothèses de productivité
   Réalisé     : traités DRM (voix), fusion de l'ancien onglet « Planifié vs réalisé »
   ===================================================================== */
function r3() {
  const C = D.capa, P = D.planH, R = D.real;
  if (!C.dates.length && !P.dates.length) {
    $('k3').innerHTML = '<div class="kpi"><div class="lbl">Aucune capacitaire ni planning</div><div class="sub">Importez le fichier Capacitaire (DAILY VISION) et le Planning (date · activité · heures).</div></div>';
    $('t3').innerHTML = ''; $('p3Hint').textContent = '';
    mkChart('c3a', { type: 'bar', data: { labels: [], datasets: [] } });
    mkChart('c3b', { type: 'bar', data: { labels: [], datasets: [] } }); return;
  }
  const g = GF.g;
  const days = [...new Set([...C.dates, ...P.dates])].filter(d => inPer('p3', d)).sort();
  if (!days.length) { noPer('p3', 'k3', ['c3a', 'c3b'], 't3'); $('p3Hint').textContent = ''; return; }
  const kOf = d => g === 'mois' ? mKey(d) : g === 'semaine' ? wLab(d) : d;
  const keys = [], idxOf = {};
  days.forEach(d => { const k = kOf(d); if (!(k in idxOf)) { idxOf[k] = keys.length; keys.push(k); } });
  const z = () => Array(keys.length).fill(0);
  const pvA = z(), rlA = z(), pvH = z(), plH = z(), reD = z();
  const missProd = new Set(), noHrs = new Set();
  /* capa prévue (actes + heures) — périmètre des filtres globaux */
  C.flux.forEach(f => {
    if (!gfPass(f.k)) return;
    const hp = prodOf(f.a);
    C.dates.forEach((d, di) => {
      const k = idxOf[kOf(d)]; if (k == null) return;
      const ca = f.capa[di] || 0;
      pvA[k] += ca;
      const hc = hrsOf(f, di);
      if (hc.v != null) { pvH[k] += hc.v; if (hc.conv) noHrs.add(f.a); }
      else if (ca) noHrs.add(f.a);
    });
  });
  /* capa réelle (planning) : heures planifiées → actes via hypothèses */
  const hasPlan = P.dates.length > 0;
  P.acts.forEach(a => {
    if (!gfPass(a)) return;
    const hp = prodOf(a);
    if (!hp) missProd.add(a);
    P.dates.forEach((d, di) => {
      const h = (P.f[a] || [])[di] || 0; if (!h) return;
      const k = idxOf[kOf(d)]; if (k == null) return;
      plH[k] += h;
      if (hp) rlA[k] += h * hp;
    });
  });
  /* réalisé (DRM voix) */
  R.dates.forEach((d, di) => {
    const k = idxOf[kOf(d)]; if (k == null) return;
    RFLOW.forEach(f => {
      if (!gfPass(f, 'PHONE')) return;
      reD[k] += R.f[f].t[di] || 0;
    });
  });
  const rd = a => a.map(v => Math.round(v));
  const TP = pvA.reduce((a, b) => a + b, 0), TRl = rlA.reduce((a, b) => a + b, 0);
  const TH = pvH.reduce((a, b) => a + b, 0), LH = plH.reduce((a, b) => a + b, 0), RD = reD.reduce((a, b) => a + b, 0);
  $('k3').innerHTML =
    kpi('Capa prévue (actes)', fmt(TP), g + ' · ' + gfLbl()) +
    (hasPlan ? kpi('Capa réelle — planning (actes)', fmt(TRl), pctS(TRl, TP) + ' de la capa prévue' + (missProd.size ? ' · prod. manquante : ' + [...missProd].join(', ') : ''), TP ? Math.min(100, Math.abs(TRl - TP) / TP * 100) : 0)
             : kpi('Planning non importé', '—', 'importez date · activité · heures')) +
    kpi('Écart capa (réel − prévu)', hasPlan ? fmt(TRl - TP) : '—', hasPlan ? (TRl - TP >= 0 ? 'sur-capacité' : 'sous-capacité') : 'nécessite le planning', TP && hasPlan ? Math.min(100, Math.abs(TRl - TP) / TP * 100) : 0) +
    kpi('Heures prévues / planifiées', fmt(TH) + ' / ' + (hasPlan ? fmt(LH) : '—'), hasPlan ? pctS(LH, TH) + ' des heures prévues' : 'heures prévues via hypothèses si besoin') +
    kpi('Réalisé (DRM)', fmt(RD), hasPlan && TRl ? pctS(RD, TRl) + ' de la capa réelle' : 'traités de la période');
  mkChart('c3a', { type: 'bar', data: { labels: keys, datasets: [
      { label: 'Capa prévue', data: rd(pvA), backgroundColor: '#3b5bdb', borderRadius: 3 },
      ...(hasPlan ? [{ label: 'Capa réelle (planning)', data: rd(rlA), backgroundColor: '#f59f00', borderRadius: 3 }] : []),
      { label: 'Réalisé (DRM)', data: rd(reD), type: 'line', borderColor: '#0ca678', borderWidth: 2, pointRadius: 1.5, tension: .3 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axisY('actes') } } });
  mkChart('c3b', { type: 'bar', data: { labels: keys, datasets: [
      { label: 'Heures prévues', data: pvH.map(v => Math.round(v * 10) / 10), backgroundColor: '#7048e8', borderRadius: 3 },
      ...(hasPlan ? [{ label: 'Heures planifiées', data: plH.map(v => Math.round(v * 10) / 10), backgroundColor: '#1098ad', borderRadius: 3 }] : [])] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axisY('heures') } } });
  let h = '<thead><tr><th>Période</th><th>Prévu (actes)</th><th>Réel planning (actes)</th><th>Écart actes</th><th>Prévu (h)</th><th>Planifié (h)</th><th>Écart h</th><th>Réalisé (DRM)</th><th>Réalisé / capa réelle</th></tr></thead><tbody>';
  keys.forEach((k, i) => {
    const eA = rlA[i] - pvA[i], eH = plH[i] - pvH[i];
    h += `<tr><td>${k}</td><td>${fmt(pvA[i])}</td><td>${fmt(rlA[i])}</td>` +
         `<td class="${eA < 0 ? 'neg' : 'pos'}">${fmt(eA)}</td>` +
         `<td>${fmt(pvH[i])}</td><td>${fmt(plH[i])}</td>` +
         `<td class="${eH < 0 ? 'neg' : 'pos'}">${fmt(eH)}</td>` +
         `<td>${fmt(reD[i])}</td><td>${pctS(reD[i], rlA[i])}</td></tr>`;
  });
  h += `</tbody><tfoot><tr><td>Total période</td><td>${fmt(TP)}</td><td>${fmt(TRl)}</td>` +
       `<td class="${TRl - TP < 0 ? 'neg' : 'pos'}">${fmt(TRl - TP)}</td>` +
       `<td>${fmt(TH)}</td><td>${fmt(LH)}</td>` +
       `<td class="${LH - TH < 0 ? 'neg' : 'pos'}">${fmt(LH - TH)}</td>` +
       `<td>${fmt(RD)}</td><td>${pctS(RD, TRl)}</td></tr></tfoot>`;
  $('t3').innerHTML = h;
  const notes = [];
  if (!hasPlan) notes.push('Importez le Planning (date · activité · heures) pour afficher la capa réelle et les heures planifiées.');
  if (missProd.size) notes.push('Hypothèses de productivité manquantes pour : ' + [...missProd].join(', ') + ' — définissez-les dans l\'onglet Capacitaire (actes réels non calculés pour ces activités).');
  if (noHrs.size) notes.push('Heures prévues converties via les hypothèses de productivité (aucune ligne « Capacitaire en heures » dans le fichier CAPA).');
  $('p3Hint').textContent = notes.join(' ');
}

/* =====================================================================
   P8 — PLANIFICATION (feuille Planning : personnes par jour & créneaux 30 min)
   Personnes planifiées en prod = présence [Shift In, Shift Out) − pause repas,
   hors FIM (hors prod), allaitement déduit au prorata — cf. impPlanning / planAgg.
   ===================================================================== */
function planEmpty() { return !D.plan || !D.plan.dates || !D.plan.dates.length; }
function defSlotDay8() {                            // jour par défaut : le plus chargé
  const P = D.plan; if (!P || !P.dates || !P.dates.length) return;
  const cur = $('w8D').value;
  if (cur && P.dates.includes(cur)) { $('w8D').min = P.dates[0]; $('w8D').max = P.dates[P.dates.length - 1]; return; }
  let best = P.dates[0] || '', bv = -1;
  P.dates.forEach(d => { const t = (P.m.prod[d] || []).reduce((a, b) => a + b, 0); if (t > bv) { bv = t; best = d; } });
  $('w8D').value = best;
  $('w8D').min = P.dates[0]; $('w8D').max = P.dates[P.dates.length - 1];
}
function r8() {
  const has = !planEmpty();
  $('p8body').style.display = has ? '' : 'none';
  $('p8empty').style.display = has ? 'none' : '';
  if (!has) { $('w8Src').textContent = 'Feuille Planning : à importer'; return; }
  const P = D.plan;
  const days = P.dates.filter(d => inPer('p8', d));
  defSlotDay8();
  if (!days.length) { noPer('p8', 'k8', ['c8a', 'c8b', 'c8c'], 't8'); $('t8m').innerHTML = ''; $('h8').textContent = '';
    $('w8Src').textContent = 'Planification : aucun jour sur ' + rangeLbl(...perRange()); return; }
  const slots = P.slots;
  const g = GF.g;
  /* KPIs de la période */
  const ags = new Set();
  days.forEach(d => (P.day[d].ag || []).forEach(a => ags.add(a)));
  const totPlan = days.reduce((s, d) => s + P.day[d].plan, 0);
  const totFimN = days.reduce((s, d) => s + P.day[d].fim, 0);
  const HP = days.reduce((s, d) => s + P.day[d].hp, 0);
  const HPD = days.reduce((s, d) => s + P.day[d].hprod, 0);
  const AL = days.reduce((s, d) => s + P.day[d].alla, 0);
  const FM = days.reduce((s, d) => s + P.day[d].fimh, 0);
  const RP = days.reduce((s, d) => s + P.day[d].repas, 0);
  /* vue par créneau : moyenne période ou jour précis */
  const v8 = $('w8V').value, d8 = $('w8D').value, jourPrecis = v8 === 'jour' && P.m.prod[d8];
  const vec = jourPrecis ? P.m.prod[d8].slice() : slots.map((_, i) => days.reduce((s, d) => s + (P.m.prod[d][i] || 0), 0) / days.length);
  const fimV = jourPrecis ? (P.m.fim[d8] || []).slice() : slots.map((_, i) => days.reduce((s, d) => s + (P.m.fim[d][i] || 0), 0) / days.length);
  const iP = vec.indexOf(Math.max(...vec));
  $('k8').innerHTML =
    kpi('Agents planifiés', fmt(ags.size), days.length + ' jour(s) sur la période') +
    kpi('Personnes planifiées / jour', fmt1(totPlan / days.length), 'dont FIM hors prod ' + fmt1(totFimN / days.length) + ' / j') +
    kpi('Heures planifiées (HP)', fmt(Math.round(HP)) + ' h', 'hors pause repas ' + fmt(Math.round(RP)) + ' h') +
    kpi('Heures en prod', fmt(Math.round(HPD)) + ' h', 'hors FIM ' + fmt(Math.round(FM)) + ' h et allaitement ' + fmt1(AL) + ' h') +
    kpi('Pointe ' + (jourPrecis ? dShort(d8) : 'moyenne période'), fmt1(vec[iP]), slots[iP] + ' · personnes en prod');
  /* graphique 1 : personnes par jour (granularité globale) */
  const { keys, idx } = aggBy(days, g);
  const cnt = Array(keys.length).fill(0);
  const prodB = keys.map(() => 0), fimB = keys.map(() => 0), hpdB = keys.map(() => 0);
  days.forEach((d, j) => { const k = idx[j]; cnt[k]++;
    prodB[k] += P.day[d].plan - P.day[d].fim; fimB[k] += P.day[d].fim; hpdB[k] += P.day[d].hprod; });
  const avgArr = a => a.map((v, i) => cnt[i] ? v / cnt[i] : 0);
  const isAvg = g !== 'jour';
  mkChart('c8a', { type: 'bar', data: { labels: keys, datasets: [
      { label: isAvg ? 'Planifiés prod (moy. / jour)' : 'Planifiés prod', data: avgArr(prodB).map(v => Math.round(v * 10) / 10), backgroundColor: '#3b5bdb', stack: 's', borderRadius: 2 },
      { label: isAvg ? 'FIM hors prod (moy. / jour)' : 'FIM hors prod', data: avgArr(fimB).map(v => Math.round(v * 10) / 10), backgroundColor: '#adb5bd', stack: 's', borderRadius: 2 },
      { label: 'Heures en prod', data: hpdB.map(v => Math.round(v)), type: 'line', borderColor: '#f59f00', borderWidth: 2, pointRadius: 2, tension: .3, yAxisID: 'y2' }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 16 } },
        y: { stacked: true, beginAtZero: true, grid: GRID, title: { display: true, text: 'personnes', font: { size: 10.5 } } },
        y2: { beginAtZero: true, position: 'right', grid: { display: false }, title: { display: true, text: 'heures', font: { size: 10.5 } } } } } });
  /* graphique 2 : personnes par créneau 30 min */
  mkChart('c8b', { type: 'bar', data: { labels: slots, datasets: [
      { label: 'Planifiés prod', data: vec.map(v => Math.round(v * 10) / 10), backgroundColor: '#3b5bdb', borderRadius: 2 },
      { label: 'FIM hors prod', data: fimV.map(v => Math.round(v * 10) / 10), backgroundColor: '#adb5bd', borderRadius: 2 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt1(c.parsed.y) } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
                y: { stacked: true, beginAtZero: true, ...axisY('personnes / créneau') } } } });
  /* graphique 3 : heures par jour — prod / FIM / allaitement + HP */
  mkChart('c8c', { type: 'bar', data: { labels: days.map(dShort), datasets: [
      { label: 'Heures en prod', data: days.map(d => P.day[d].hprod), backgroundColor: '#0ca678', stack: 's', borderRadius: 2 },
      { label: 'FIM (hors prod)', data: days.map(d => P.day[d].fimh), backgroundColor: '#f59f00', stack: 's', borderRadius: 2 },
      { label: 'Allaitement', data: days.map(d => P.day[d].alla), backgroundColor: '#d6336c', stack: 's', borderRadius: 2 },
      { label: 'HP (planifiées)', data: days.map(d => P.day[d].hp), type: 'line', borderColor: '#1b2440', borderWidth: 2, pointRadius: 1.5, tension: .3 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 16 } },
                y: { stacked: true, beginAtZero: true, ...axisY('heures') } } } });
  /* tableau détail par jour */
  let h = '<thead><tr><th>Date</th><th>Jour</th><th>Planifiés</th><th>dont FIM</th><th>HP (h)</th><th>Pause repas (h)</th><th>Prod (h)</th><th>FIM (h)</th><th>Allaitement (h)</th></tr></thead><tbody>';
  days.forEach(d => { const D8 = P.day[d];
    h += `<tr><td>${dLab(d)}</td><td>${jJours(d)}</td><td>${D8.plan}</td><td>${D8.fim}</td>` +
         `<td>${fmt1(D8.hp)}</td><td>${fmt1(D8.repas)}</td><td>${fmt1(D8.hprod)}</td>` +
         `<td>${fmt1(D8.fimh)}</td><td>${fmt1(D8.alla)}</td></tr>`;
  });
  h += `</tbody><tfoot><tr><td colspan="2">Total période · moy. / jour</td><td>${fmt1(totPlan / days.length)} / j</td>` +
       `<td>${fmt1(totFimN / days.length)} / j</td><td>${fmt(Math.round(HP))}</td><td>${fmt(Math.round(RP))}</td>` +
       `<td>${fmt(Math.round(HPD))}</td><td>${fmt(Math.round(FM))}</td><td>${fmt1(AL)}</td></tr></tfoot>`;
  $('t8').innerHTML = h;
  /* matrice créneau × jour (personnes planifiées en prod) */
  let hm = '<thead><tr><th>Créneau</th>' + days.map(d => `<th>${dShort(d)}</th>`).join('') + '<th>Moy. / jour</th></tr></thead><tbody>';
  slots.forEach((s, i) => {
    const vals = days.map(d => (P.m.prod[d] || [])[i] || 0);
    hm += `<tr><td>${s}</td>` + vals.map(v => `<td>${v ? fmt1(v) : '·'}</td>`).join('') +
      `<td><b>${fmt1(vals.reduce((a, b) => a + b, 0) / days.length)}</b></td></tr>`;
  });
  hm += '</tbody>';
  $('t8m').innerHTML = hm;
  $('h8').textContent = 'Personnes planifiées en prod = présence [Shift In, Shift Out) − pause repas · FIM (Compétences = FIM ou Total FIM = HP) compté hors prod · ' +
    'allaitement déduit au prorata du shift · HP du fichier = shift − pause repas · heures en prod = HP − Total FIM − Allaitement.';
  $('w8Src').textContent = 'Planification : ' + ((P.meta && P.meta.file) || 'importée') + ' · ' + days.length + ' j · ' +
    slots[0] + ' → ' + slots[slots.length - 1] + ' · ' + (jourPrecis ? 'jour ' + dShort(d8) : 'moyenne période');
}
function bind8() {
  $('w8V').addEventListener('change', r8);
  $('w8D').addEventListener('change', r8);
  RENDERS.p8 = r8;
}

/* =====================================================================
   AMORÇAGE
   ===================================================================== */
async function boot() {
  try { const ls = localStorage.getItem(LS); if (ls) D = JSON.parse(ls); } catch (e) { /* ignoré */ }
  if (!D) {
    try { D = await (await fetch('data/data.json', { cache: 'no-store' })).json(); }
    catch (e) { D = emptyData(); }
  }
  ensure();
  if (!D.rm2) {                                                     // modèle RM : 1 fichier par onglet
    try {
      D.rm2 = await (await fetch('data/roadmap.json', { cache: 'no-store' })).json();
      if (D.rm2 && D.rm2.meta && D.rm2.meta.file) D.meta.rm2 = D.rm2.meta.file;
    } catch (e) { D.rm2 = null; }
  }
  if (!D.prev) {                                                    // prévision Webhelp : 1 fichier par onglet
    try {
      D.prev = await (await fetch('data/prevision.json', { cache: 'no-store' })).json();
      if (D.prev && D.prev.meta && D.prev.meta.file) D.meta.prev = D.prev.meta.file;
    } catch (e) { D.prev = null; }
  }
  if (!D.plan) {                                                    // planification (feuille Planning) : 1 fichier par onglet
    try {
      D.plan = await (await fetch('data/planning.json', { cache: 'no-store' })).json();
      if (D.plan && D.plan.meta && D.plan.meta.file) D.meta.planA = D.plan.meta.file;
    } catch (e) { D.plan = null; }
  }
  buildRoadmapCompat();
  bindUI();
  renderHead();
  fillSelects();
  go('p1');
}
function bindUI() {
  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.p)));
  $('bImp').onclick = $('bImp').onclick || null;      // (ré)assignations idempotentes
  $('bImp').addEventListener('click', () => $('imp').showModal());
  $('bImpClose').addEventListener('click', () => $('imp').close());
  $('bExp').addEventListener('click', dlJSON);
  $('bExp2').addEventListener('click', dlJSON);
  $('bDemo').addEventListener('click', demo);
  $('bDemo2').addEventListener('click', demo);
  $('bModele').addEventListener('click', dlModele);
  $('bReset').addEventListener('click', () => {
    if (!confirm('Effacer les données locales et recharger data/data.json ?')) return;
    localStorage.removeItem(LS); location.reload();
  });
  bindImports();
  bindGBar();
  ['w1W', 'w1F', 's1U'].forEach(id => $(id).addEventListener('change', r1));
  $('s2U').addEventListener('change', r2);
  RENDERS.p1 = r1; RENDERS.p2 = r2; RENDERS.p3 = r3;
  bind4();
  bind5();
  bind8();
  boot2();
}
function boot2() { /* complété en partie 3 (page 5) */ }

/* =====================================================================
   P4 — PRÉVISION (Webhelp : vue par jour & par créneau 30 min)
   Volume jour = prévu du mois × poids journalier (onglet « Poids ») ;
   volume créneau = volume du jour × poids du créneau (col. R, 730 = 07:30,
   profil « Lundi au samedi » ou « Dimanche » selon le jour choisi).
   ===================================================================== */
function prevSeriesGF() {                            // séries selon les filtres globaux (canal × activité)
  const out = [];
  [['a', 'PHONE', 'appels'], ['m', 'MAIL', 'mails']].forEach(([ck, ch, mk]) => {
    if (!effChanSet().has(ch)) return;
    PACTS.forEach(f => {
      if (GF.acts.length && !GF.acts.includes(PLBL[f])) return;
      const tot = Object.keys(D.prev.mois || {}).reduce((s, mo) =>
        s + (((D.prev.mois[mo] || { appels: {}, mails: {} })[mk] || {})[f] || 0), 0);
      if (!tot) return;                              // pas de prévu pour ce couple canal × activité
      out.push({ k: ck + ':' + f, lbl: (ck === 'm' ? 'Mail ' : '') + PLBL[f], col: PCOL[f],
        mail: ck === 'm', cpl: [[ck, f]], g: v => v[ck][f] });
    });
  });
  return out;
}
function fill4() {
  const sM = $('w4M');
  if (!prevHas()) { sM.innerHTML = '<option value="">—</option>'; return; }
  const curM = sM.value;
  sM.innerHTML = prevMonths().map(k => `<option value="${k}">${mLab(k)}</option>`).join('');
  const today = new Date().toISOString().slice(0, 10);
  const withP = prevMonths().filter(m => prevDayKeys(m).length);
  const defM = withP.includes(today.slice(0, 7)) ? today.slice(0, 7) : (withP[withP.length - 1] || prevMonths()[0]);
  sM.value = [...sM.options].some(o => o.value === curM) ? curM : defM;
}
function defSlotDay() {                                 // jour du détail créneau : le plus chargé du mois
  const m = $('w4M').value, days = prevDayKeys(m), cur = $('w4D').value;
  if (cur && days.includes(cur)) { $('w4D').min = m + '-01'; $('w4D').max = days[days.length - 1]; return; }
  let best = days[0] || '', bv = -1;
  days.forEach(d => { const v = prevDayVol(m, d);
    const t = PACTS.reduce((s, f) => s + v.a[f] + v.m[f], 0);
    if (t > bv) { bv = t; best = d; } });
  $('w4D').value = best;
  $('w4D').min = m + '-01'; $('w4D').max = days[days.length - 1] || m + '-31';
}
function r4() {
  const has = prevHas();
  $('p4body').style.display = has ? '' : 'none';
  $('p4empty').style.display = has ? 'none' : '';
  if (!has) { $('w4Src').textContent = 'Prévision Webhelp : à importer'; return; }
  const m = $('w4M').value || prevMonths()[0];
  const series = prevSeriesGF();
  const scopeLbl = gfLbl();
  if (!series.length) {
    ['c4a', 'c4b'].forEach(c => mkChart(c, { type: 'bar', data: { labels: [], datasets: [] }, options: { maintainAspectRatio: false } }));
    $('k4').innerHTML = kpi('Prévision', '—', 'aucune série pour ' + gfLbl() + ' — canal non couvert par la prévision Webhelp');
    ['t4a', 't4b', 't4c', 't4d'].forEach(id => $(id).textContent = '—');
    $('h4a').textContent = 'Ajustez les filtres Flux / Channel / Activités (canal Chat non couvert par la prévision Webhelp).';
    $('h4b').textContent = ''; $('h4m').textContent = '';
    $('ta4').innerHTML = '<tbody><tr><td>—</td></tr></tbody>'; $('tb4').innerHTML = '<tbody><tr><td>—</td></tr></tbody>';
    $('tm4').innerHTML = '';
    $('w4Src').textContent = 'Prévision Webhelp : aucune série pour ce périmètre';
    return;
  }
  const days = prevDayKeys(m);
  const vols = days.map(d => prevDayVol(m, d));
  const sData = series.map(s => vols.map(v => s.g(v)));
  const tot = days.map((_, i) => sData.reduce((s, a) => s + (a[i] || 0), 0));
  const sumAll = tot.reduce((s, v) => s + v, 0);
  const iMax = tot.indexOf(Math.max(...tot));

  /* ---- vue par jour ---- */
  $('t4a').textContent = mLab(m) + ' · ' + scopeLbl;
  $('t4c').textContent = mLab(m) + ' · ' + scopeLbl;
  $('h4a').textContent = days.length
    ? 'Volume = prévu du mois × poids journalier (onglet « Poids » du classeur Webhelp) · ' + days.length + ' jours pondérés · Σ = ' + fmt(sumAll)
    : 'Poids journaliers absents pour ' + mLab(m) + ' — le classeur importé ne couvre pas ce mois.';
  if (days.length) {
    mkChart('c4a', { type: 'bar', data: { labels: days.map(dShort), datasets: series.map((s, si) => ({
        label: s.lbl, data: sData[si], backgroundColor: s.mail ? s.col + '55' : s.col, borderColor: s.mail ? s.col : 'transparent',
        borderWidth: s.mail ? 1 : 0, borderRadius: 3, stack: 's' })) },
      options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt(c.parsed.y) } } },
        scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 16 } },
                  y: { stacked: true, ...axisY('volume') } } } });
  } else mkChart('c4a', { type: 'bar', data: { labels: [], datasets: [] }, options: { maintainAspectRatio: false } });

  let h = '<thead><tr><th>Date</th><th>Jour</th>' + series.map(s => `<th>${s.lbl}</th>`).join('') + '<th>Total</th></tr></thead><tbody>';
  days.forEach((d, i) => {
    h += `<tr><td>${dLab(d)}</td><td>${jJours(d)}</td>` +
      series.map((s, si) => `<td>${sData[si][i] ? fmt(sData[si][i]) : '—'}</td>`).join('') +
      `<td><b>${tot[i] ? fmt(tot[i]) : '—'}</b></td></tr>`;
  });
  h += '</tbody>';
  if (days.length) h += `<tfoot><tr><td colspan="2">Total ${mLab(m)}</td>` +
    series.map((s, si) => `<td>${fmt(sData[si].reduce((x, y) => x + y, 0))}</td>`).join('') + `<td>${fmt(sumAll)}</td></tr></tfoot>`;
  $('ta4').innerHTML = h || '<tbody><tr><td>—</td></tr></tbody>';

  /* ---- vue par créneau 30 min ---- */
  defSlotDay();
  const daySel = $('w4D').value;
  const profSel = $('w4P').value;
  const prof = profSel === 'auto' ? (jJours(daySel) === 'dimanche' ? 'dim' : 'ls') : profSel;
  const cre = (D.prev.creneaux || {})[m] || {};
  const vDay = prevDayVol(m, daySel);
  const slotAgg = (s, t) => s.cpl.reduce((sum, [c, f]) =>
    sum + (vDay[c][f] || 0) * (((((cre[f] || {})[prof] || {})[t]) || 0)), 0);
  const slots = [...new Set(series.flatMap(s => s.cpl.map(([c, f]) => Object.keys((cre[f] || {})[prof] || {})).flat()))]
    .map(Number).sort((a, b) => a - b);
  const sDataC = series.map(s => slots.map(t => slotAgg(s, t)));
  const totC = slots.map((_, i) => sDataC.reduce((s, a) => s + (a[i] || 0), 0));
  /* créneaux affichés : ceux du profil avec un volume (le dimanche : matin uniquement) */
  const vis = slots.map((t, i) => [t, i]).filter(([, i]) => totC[i] > 0.005);
  const sV = vis.map(([t]) => t);
  const sDataV = sDataC.map(a => vis.map(([, i]) => a[i]));
  const totV = vis.map(([, i]) => totC[i]);
  const sumDay = totC.reduce((s, v) => s + v, 0);
  const iMaxC = totV.indexOf(Math.max(...totV));
  const hasCre = sV.length > 0 && sumDay > 0;

  $('t4b').textContent = (daySel ? dShort(daySel) + ' (' + jJours(daySel) + ')' : '—') + ' · profil ' +
    (prof === 'dim' ? 'Dimanche (matin)' : 'Lundi au samedi');
  $('t4d').textContent = (daySel ? dShort(daySel) + ' (' + jJours(daySel) + ')' : '—') + ' · profil ' +
    (prof === 'dim' ? 'Dimanche (matin)' : 'Lundi au samedi');
  $('h4b').textContent = hasCre
    ? 'Volume créneau = volume du jour × poids du créneau (colonne R du fichier, 730 = 07:30) · pointe ' +
      slotLab(sV[iMaxC]) + ' à ' + fmt(totV[iMaxC]) + ' · Σ = ' + fmt(sumDay)
    : 'Créneaux 30 min non disponibles pour ce jour / ce mois (profil « ' + (prof === 'dim' ? 'Dimanche' : 'Lundi au samedi') + ' »).';
  if (hasCre) {
    mkChart('c4b', { type: 'bar', data: { labels: sV.map(slotLab), datasets: series.map((s, si) => ({
        label: s.lbl, data: sDataV[si], backgroundColor: s.mail ? s.col + '55' : s.col, borderColor: s.mail ? s.col : 'transparent',
        borderWidth: s.mail ? 1 : 0, borderRadius: 3, stack: 's' })) },
      options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt1(c.parsed.y) } } },
        scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
                  y: { stacked: true, ...axisY('volume / 30 min') } } } });
  } else mkChart('c4b', { type: 'bar', data: { labels: [], datasets: [] }, options: { maintainAspectRatio: false } });

  let hc = '<thead><tr><th>Créneau</th>' + series.map(s => `<th>${s.lbl}</th>`).join('') + '<th>Total</th><th>% du jour</th></tr></thead><tbody>';
  sV.forEach((t, i) => {
    hc += `<tr><td>${slotLab(t)}</td>` +
      series.map((s, si) => `<td>${sDataV[si][i] ? fmt1(sDataV[si][i]) : '—'}</td>`).join('') +
      `<td><b>${totV[i] ? fmt(totV[i]) : '—'}</b></td><td>${sumDay ? fmt(Math.round(totV[i] / sumDay * 1000) / 10) + ' %' : '—'}</td></tr>`;
  });
  hc += '</tbody>';
  if (hasCre) hc += `<tfoot><tr><td>Total du jour</td>` +
    series.map((s, si) => `<td>${fmt(sDataV[si].reduce((x, y) => x + y, 0))}</td>`).join('') +
    `<td>${fmt(sumDay)}</td><td>100 %</td></tr></tfoot>`;
  $('tb4').innerHTML = hc || '<tbody><tr><td>—</td></tr></tbody>';

  /* ---- KPIs ---- */
  const moisTot = series.reduce((s, sr) => s + sr.cpl.reduce((x, [c, f]) =>
    x + (((D.prev.mois || {})[m] || { appels: {}, mails: {} })[c === 'a' ? 'appels' : 'mails'][f] || 0), 0), 0);
  const hasBoth = series.some(s => !s.mail) && series.some(s => s.mail);
  $('k4').innerHTML =
    kpi('Prévu ' + mLab(m), fmt(days.length ? sumAll : moisTot),
      scopeLbl + (D.prev.meta && D.prev.meta.snapshot ? ' · prévision au ' + dShort(D.prev.meta.snapshot) : '')) +
    (days.length ? kpi('Moyenne / jour', fmt(sumAll / days.length), days.length + ' jours pondérés') : '') +
    (days.length && tot[iMax] ? kpi('Jour le plus chargé', fmt(tot[iMax]), dShort(days[iMax]) + ' · ' + jJours(days[iMax])) : '') +
    (hasCre ? kpi('Pointe 30 min', fmt(totV[iMaxC]), slotLab(sV[iMaxC]) + ' · ' + dShort(daySel) + ' (' + jJours(daySel) + ')') : '') +
    (hasBoth && days.length ? (() => {
      const a = series.filter(s => !s.mail).reduce((s, sr) => s + vols.reduce((x, v) => x + sr.g(v), 0), 0);
      const mm = series.filter(s => s.mail).reduce((s, sr) => s + vols.reduce((x, v) => x + sr.g(v), 0), 0);
      return kpi('Répartition', pctS(a, a + mm), 'appels ' + fmt(a) + ' · mails ' + fmt(mm)); })() : '');

  /* ---- synthèse mensuelle ---- */
  const allM = prevMonths();
  let hm = '<thead><tr><th>Mois</th><th>Hyper</th><th>C2E</th><th>AFR</th><th>Drive</th><th>SAV</th><th>Direct</th><th>Σ Appels</th>' +
    '<th>Mail Hyper/C2E</th><th>Mail AFR</th><th>Mail Drive</th><th>Σ Mails</th><th>Σ Total</th></tr></thead><tbody>';
  const totM = { a: 0, m: 0 };
  allM.forEach(mk => { const o = (D.prev.mois || {})[mk] || { appels: {}, mails: {} };
    const A = PACTS.reduce((s, f) => s + (o.appels[f] || 0), 0), M = PACTS.reduce((s, f) => s + (o.mails[f] || 0), 0);
    totM.a += A; totM.m += M;
    hm += `<tr${mk === m ? ' class="sel"' : ''}><td>${mLab(mk)}</td>` +
      ['hyper', 'c2e', 'afr', 'drive', 'sav', 'direct'].map(f => `<td>${o.appels[f] ? fmt(o.appels[f]) : '—'}</td>`).join('') +
      `<td><b>${A ? fmt(A) : '—'}</b></td>` +
      ['hyper', 'afr', 'drive'].map(f => `<td>${o.mails[f] ? fmt(o.mails[f]) : '—'}</td>`).join('') +
      `<td><b>${M ? fmt(M) : '—'}</b></td><td><b>${A + M ? fmt(A + M) : '—'}</b></td></tr>`;
  });
  hm += `</tbody><tfoot><tr><td>Total</td><td colspan="6"></td><td>${fmt(totM.a)}</td><td colspan="3"></td>` +
    `<td>${fmt(totM.m)}</td><td>${fmt(totM.a + totM.m)}</td></tr></tfoot>`;
  $('tm4').innerHTML = hm;
  const noW = allM.filter(mk => !prevDayKeys(mk).length);
  $('h4m').textContent = 'Prévus mensuels par flux (onglet « 2026 » du classeur Webhelp)' +
    (noW.length ? ' · poids journaliers absents pour ' + noW.map(mLab).join(', ') + ' : vues par jour / créneau indisponibles.' : '.');

  $('w4Src').textContent = 'Prévision Webhelp : ' + (D.meta.prev || (D.prev.meta && D.prev.meta.file) || 'Webhelp') +
    (D.prev.meta && D.prev.meta.snapshot ? ' · au ' + dShort(D.prev.meta.snapshot) : '') +
    ' · ' + (days.length ? days.length + ' j pondérés ' + mLab(m) : mLab(m) + ' (sans poids)');
}
function bind4() {
  $('w4M').addEventListener('change', () => { defSlotDay(); r4(); });
  $('w4D').addEventListener('change', r4);
  $('w4P').addEventListener('change', r4);
  RENDERS.p4 = r4;
}

/* =====================================================================
   P5 — PRODUCTIVITÉ (sections par canal selon les filtres globaux)
   Phone : DRM + Vonage · Mail : Export Mail · Chat : pas encore raccordé
   QS = traités/reçus · QP = reçus/prévision · QS<60s · QE si QP>115% · T/P
   DMT · Productivité = traités / heure de traitement · TO = traitement / heures planifiées
   ===================================================================== */
const tauxChip = t => t >= 65 ? 'g' : t >= 50 ? 'a' : 'r';   /* taux < 60 s (qualité) */
const tauxReal = t => t >= 95 ? 'g' : t >= 80 ? 'a' : 'r';   /* taux d'occupation / couverture */
function planHoursOf(act, d) {                                      // heures planifiées (match insensible à la casse)
  const P = D.planH, ai = P.dates.indexOf(d);
  if (ai < 0) return 0;
  const k = P.acts.find(x => norm(x) === norm(act));
  return k ? (P.f[k] || [])[ai] || 0 : 0;
}
function ch5(canal) {                                               // adaptateur de données par canal
  if (canal === 'mail') {
    const M = D.mail, PM = prevMailMap();
    const prevOf = (f, d) => { const p = PM[norm(f)]; return p ? (p[d] || 0) : 0; };
    return {
      dates: M.dates, acts: M.flows, has: M.dates.length > 0,
      emptyMsg: ['Aucune donnée Mail.', 'Importez un « Export Mail » (une ligne par courriel) via le bouton Importer ; la prévision via la carte « Prévision Mail ».'],
      get(f, i) { const F = M.f[f]; return { rec: F.rec[i] || 0, tr: F.tr[i] || 0, t60: F.t60[i] || 0, h: (F.del[i] || 0) / 3600, n: 0 }; },
      prev: (f, d) => prevOf(f, d),
      dmt: v => v.tr ? v.h * 3600 / v.tr : null
    };
  }
  if (canal === 'phone') {
    const R = D.real, M = D.dmt;
    const dates = [...new Set([...R.dates, ...M.dates])].sort();
    const acts = [...new Set([...RFLOW, ...(M.flows || [])])];
    return {
      dates, acts, has: dates.length > 0,
      emptyMsg: ['Aucune donnée Phone.', 'Importez le DRM (réalisé) et/ou l\'Export Vonage Call (DMT) via le bouton Importer.'],
      get(f, i) {
        const d = dates[i], ri = R.dates.indexOf(d), mi = M.dates.indexOf(d);
        const RR = R.f[f] || { r: [], t: [], s: [] };
        const MF = M.f[f];
        const rec = ri >= 0 ? (RR.r[ri] || 0) : 0, tr = ri >= 0 ? (RR.t[ri] || 0) : 0, t60 = ri >= 0 ? (RR.s[ri] || 0) : 0;
        const n = mi >= 0 && MF ? (MF.n[mi] || 0) : 0;
        const h = n && MF ? ((MF.com[mi] || 0) + (MF.acw[mi] || 0)) / 3600 : 0;
        return { rec, tr, t60, h, n };
      },
      prev(f, d) {
        const w = whPrevDay(actKeyOf(f).toLowerCase(), 'a', d);      // prévision Webhelp × poids journaliers
        if (w != null) return w;
        const rm = D.roadmap.find(x => norm(x.a) === norm(f) && norm(x.c) === 'voix');
        return rm ? (rm.prev[isoWeek(d) - 1] || 0) / 7 : 0;          // repli : roadmap hebdo ÷ 7
      },
      dmt: v => v.n ? v.h * 3600 / v.n : null
    };
  }
  return null;                                                      // chat : pas encore de source
}
function r5() {                                     // une section par canal retenu par les filtres globaux
  const EC = effChanSet();
  const chans = [];
  if (EC.has('PHONE')) chans.push('phone');
  if (EC.has('MAIL')) chans.push('mail');
  if (EC.has('CHAT')) chans.push('chat');
  const host = $('p5body'); host.innerHTML = '';
  const sums = [];
  chans.forEach(c => { const s = r5Canal(c); if (s) sums.push(s); });
  $('p5empty').style.display = sums.length ? 'none' : '';
  if (!sums.length) {
    $('p5emptyT').textContent = 'Aucune donnée Productivité pour ce périmètre.';
    $('p5emptyS').textContent = 'Ajustez les filtres Flux / Channel / Activités, ou importez les sources (DRM, Export Vonage Call, Export Mail, Prévision Mail).';
  }
  $('w5Src').textContent = sums.length ? sums.join(' · ') : 'Productivité : aucune donnée';
}
function r5Canal(canal) {                           // section d'un canal ; renvoie le résumé ou null
  const C = ch5(canal);
  const lbl = canal === 'phone' ? 'Phone' : canal === 'mail' ? 'Mail' : 'Chat';
  const div = document.createElement('div');
  $('p5body').appendChild(div);
  if (!C || !C.has) {
    const msg = canal === 'phone' ? ['Aucune donnée Phone.', 'Importez le DRM (réalisé) et/ou l\'Export Vonage Call (DMT) via le bouton Importer.']
      : canal === 'mail' ? ['Aucune donnée Mail.', 'Importez un « Export Mail » (une ligne par courriel) et la « Prévision Mail » via le bouton Importer.']
      : ['Canal Chat — pas encore de source raccordée.', 'Les exports nécessaires (plateforme de chat) ne sont pas encore définis. Les indicateurs QS, QP, QE, DMT, productivité et taux d\'occupation s\'afficheront dès le raccordement.'];
    div.innerHTML = `<div class="card" style="padding:20px"><b>${lbl} — ${msg[0]}</b><br><span class="hint">${msg[1]}</span></div>`;
    return null;
  }
  const acts = C.acts.filter(a => gfPass(a, canal === 'mail' ? 'MAIL' : 'PHONE'));
  const idx = C.dates.map((d, i) => [d, i]).filter(([d]) => inPer('p5', d)).map(([, i]) => i);
  const rl = rangeLbl(...perRange());
  if (!acts.length || !idx.length) {
    div.innerHTML = `<div class="card" style="padding:20px"><b>${lbl} — ${!acts.length
      ? 'aucune activité dans ce périmètre (ajustez les filtres Flux / Channel / Activités).'
      : 'aucune donnée sur la période (élargissez la Période ou l\'Intervalle).'}</b></div>`;
    return null;
  }
  const ids = s => s + '_' + canal;
  const canalLbl = lbl;
  const labels = idx.map(i => C.dates[i].slice(8, 10) + '/' + C.dates[i].slice(5, 7));

  /* séries journalières (activités du filtre) */
  const recJ = [], trJ = [], t60J = [], pvJ = [], hJ = [];
  idx.forEach(i => {
    const d = C.dates[i];
    let rec = 0, tr = 0, t60 = 0, pv = 0, h = 0;
    acts.forEach(a => { const v = C.get(a, i); rec += v.rec; tr += v.tr; t60 += v.t60; h += v.h; pv += C.prev(a, d); });
    recJ.push(rec); trJ.push(tr); t60J.push(t60); pvJ.push(pv); hJ.push(h);
  });
  const q = (a, b) => b ? Math.round(a / b * 100) : null;
  const qsJ = trJ.map((v, j) => q(v, recJ[j])), q60J = t60J.map((v, j) => q(v, recJ[j]));
  const qpJ = pvJ.map((v, j) => q(recJ[j], v)), tpJ = pvJ.map((v, j) => q(trJ[j], v));
  const prodJ = hJ.map((h, j) => h ? trJ[j] / h : null);
  const toJ = hJ.map((h, j) => {                                     // TO = traitement / heures planifiées
    const d = C.dates[idx[j]]; let ph = 0;
    acts.forEach(a => { ph += planHoursOf(a, d); });
    return ph ? Math.min(999, Math.round(h / ph * 100)) : null;
  });

  /* agrégats de période */
  let REC = 0, TR = 0, T60 = 0, H = 0, PV = 0, PH = 0;
  recJ.forEach((v, j) => { REC += v; TR += trJ[j]; T60 += t60J[j]; H += hJ[j]; PV += pvJ[j]; });
  idx.forEach(i => { const d = C.dates[i];
    acts.forEach(a => { PH += planHoursOf(a, d); }); });
  const QS = q(TR, REC), QS60 = q(T60, REC), QP = q(REC, PV), TPp = q(TR, PV);
  const QE = (QP != null && QP > 115) ? Math.round(TR / PV * 92) : null;
  const DMTp = TR ? H * 3600 / TR : null;
  const PRODp = H ? TR / H : null;
  const TOp = PH ? Math.min(999, Math.round(H / PH * 100)) : null;

  div.innerHTML = `<h2 style="font-size:15.5px;font-weight:750;color:#2a3555;margin:4px 0 10px">Canal ${canalLbl} · ${rl} · ${gfLbl()}</h2>
    <div class="kpis" id="${ids('k5')}"></div>
    <div class="kpis" id="${ids('k5b')}"></div>
    <div class="grid2">
      <div class="card"><h3>Journalier — reçus / traités / prévision</h3><div class="charthold tall"><canvas id="${ids('c5a')}"></canvas></div></div>
      <div class="card"><h3>Qualité journalière — QS · QS &lt; 60 s · QP · T/P</h3><div class="charthold tall"><canvas id="${ids('c5b')}"></canvas></div></div>
    </div>
    <div class="card"><h3>Répartition par activité — traités de la période</h3><div class="charthold"><canvas id="${ids('c5c')}"></canvas></div></div>
    <div class="card"><h3>Détail jour × activité — tous les indicateurs</h3><div class="tblwrap"><table id="${ids('t5')}"></table></div></div>`;

  /* KPIs — indicateurs */
  $(ids('k5')).innerHTML =
    kpi('QS — qualité de service', QS == null ? '—' : QS + ' %', 'traités / reçus · ' + rl) +
    kpi('QP — qualité de production', QP == null ? '—' : QP + ' %', PV ? 'reçus / prévision' : 'prévision non disponible') +
    kpi('QE — efficacité', QE == null ? '—' : QE + ' %', QP != null && QP > 115 ? 'QP > 115 % : (traités / prévision) × 92 %' : 'applicable si QP > 115 %') +
    kpi('DMT', DMTp == null ? '—' : sec(DMTp) + ' s', canal === 'phone' ? 'communication + after-call / appel' : 'délai moyen par traité') +
    kpi('Productivité', PRODp ? fmt1(PRODp) + ' actes/h' : '—', 'traités / heure de traitement') +
    kpi("Taux d'occupation", TOp == null ? '—' : TOp + ' %', PH ? 'temps de traitement / heures planifiées' : 'heures planifiées non importées', TOp != null ? Math.min(100, TOp) : 0);

  /* KPIs — nombres */
  $(ids('k5b')).innerHTML =
    kpi('Contacts traités', fmt(TR), idx.length + ' jour' + (idx.length > 1 ? 's' : '') + ' · ' + gfLbl()) +
    kpi('Contacts reçus', fmt(REC), canal === 'mail' ? 'courriels acceptés' : 'contacts reçus (DRM)') +
    kpi('Prévision de contacts', PV ? fmt(Math.round(PV)) : '—',
        canal === 'phone' ? (prevHas() ? 'Prévision Webhelp × poids journaliers' : 'Roadmap (prévision hebdo ÷ 7)') : canal === 'mail' ? ((D.pmail && D.pmail.rows.length) ? (D.meta.pmail || D.pmail.file) : 'import « Prévision Mail »') : '—') +
    kpi('Heures de traitement', hhDur(H * 3600), 'somme des temps de traitement');

  /* graphique : journalier reçus / traités / prévision */
  mkChart(ids('c5a'), { type: 'bar', data: { labels, datasets: [
      { label: 'Reçus', data: recJ, backgroundColor: 'rgba(59,91,219,.35)', borderRadius: 3 },
      { label: 'Traités', data: trJ, backgroundColor: '#3b5bdb', borderRadius: 3 },
      ...(PV ? [{ label: 'Prévision', data: pvJ.map(v => Math.round(v)), type: 'line', borderColor: '#f59f00', borderDash: [5, 4], borderWidth: 2, pointRadius: 0, tension: .3 }] : [])] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt(c.parsed.y ?? c.parsed) } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 }, title: { display: true, text: rl, font: { size: 10.5 } } }, y: axisY('contacts / jour') } } });

  /* graphique : qualité journalière (%) */
  const axP5 = { beginAtZero: true, grid: GRID, ticks: { callback: v => v + ' %' } };
  const ln = (lab, data, col, dash) => ({ label: lab, data, borderColor: col, backgroundColor: 'transparent',
    borderDash: dash ? [5, 4] : [], borderWidth: 2, pointRadius: 1.5, tension: .3, spanGaps: true });
  mkChart(ids('c5b'), { type: 'line', data: { labels, datasets: [
      ln('QS', qsJ, '#0ca678'), ln('QS < 60 s', q60J, '#3b5bdb'),
      ln('QP', qpJ, '#f59f00', true), ln('T/P', tpJ, '#7048e8')] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => c.parsed.y == null ? null : ' ' + c.dataset.label + ' : ' + Math.round(c.parsed.y) + ' %' } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axP5 } } });

  /* graphique : répartition par activité (traités) */
  const byA = acts.map(a => { let s = 0; idx.forEach(i => s += C.get(a, i).tr); return s; });
  mkChart(ids('c5c'), { type: 'doughnut',
    data: { labels: acts, datasets: [{ data: byA, backgroundColor: acts.map((a, i) => RCOL[a.toUpperCase()] || PAL[i % PAL.length]), borderWidth: 2, borderColor: '#fff' }] },
    options: { maintainAspectRatio: false, cutout: '58%',
      plugins: { legend: { position: 'right' },
        tooltip: { callbacks: { label: c => ' ' + c.label + ' : ' + fmt(c.parsed) + ' (' + pctS(c.parsed, byA.reduce((a, b) => a + b, 0)) + ')' } } } } });

  /* tableau : jour × activité — tous les indicateurs */
  let h = '<thead><tr><th>Date</th><th>Jour</th><th>Activité</th><th>Reçus</th><th>Traités</th><th>Prévision</th>' +
          '<th>QS</th><th>QP</th><th>QS &lt; 60 s</th><th>T/P</th><th>QE</th><th>Heures</th><th>DMT</th><th>Prod</th><th>TO</th></tr></thead><tbody>';
  let rowsN = 0;
  idx.forEach(i => { const d = C.dates[i];
    acts.forEach(a => {
      const v = C.get(a, i); const pv = C.prev(a, d);
      if (!v.rec && !v.tr && !pv && !v.h) return;
      rowsN++;
      const qp = q(v.rec, pv), tp = q(v.tr, pv), qe = (qp != null && qp > 115) ? Math.round(v.tr / pv * 92) : null;
      const dm = C.dmt(v);
      const prod = v.h ? v.tr / v.h : null;
      const ph = planHoursOf(a, d);
      const to = (ph && v.h) ? Math.min(999, Math.round(v.h / ph * 100)) : null;
      h += `<tr><td>${dLab(d)}</td><td>${jJours(d)}</td><td>${a}</td><td>${v.rec ? fmt(v.rec) : '—'}</td>` +
           `<td>${v.tr ? fmt(v.tr) : '—'}</td><td>${pv ? fmt(Math.round(pv)) : '—'}</td>` +
           `<td>${pctS(v.tr, v.rec)}</td><td>${qp == null ? '—' : qp + ' %'}</td>` +
           `<td>${pctS(v.t60, v.rec)}</td><td>${tp == null ? '—' : tp + ' %'}</td>` +
           `<td>${qe == null ? '—' : qe + ' %'}</td>` +
           `<td>${v.h ? fmt1(v.h) + ' h' : '—'}</td>` +
           `<td>${dm == null ? '—' : sec(dm) + ' s'}</td>` +
           `<td>${prod ? fmt1(prod) : '—'}</td>` +
           `<td>${to == null ? '—' : to + ' %'}</td></tr>`;
    });
  });
  if (!rowsN) h += '<tr><td colspan="15" style="text-align:center;color:#6b7594">Aucune donnée sur la période</td></tr>';
  h += '</tbody><tfoot><tr><td colspan="3">Total période · ' + gfLbl() + '</td>' +
       `<td>${fmt(REC)}</td><td>${fmt(TR)}</td><td>${PV ? fmt(Math.round(PV)) : '—'}</td>` +
       `<td>${QS == null ? '—' : QS + ' %'}</td><td>${QP == null ? '—' : QP + ' %'}</td>` +
       `<td>${QS60 == null ? '—' : QS60 + ' %'}</td><td>${TPp == null ? '—' : TPp + ' %'}</td>` +
       `<td>${QE == null ? '—' : QE + ' %'}</td>` +
       `<td>${H ? hhDur(H * 3600) : '—'}</td>` +
       `<td>${DMTp == null ? '—' : sec(DMTp) + ' s'}</td>` +
       `<td>${PRODp ? fmt1(PRODp) : '—'}</td>` +
       `<td>${TOp == null ? '—' : TOp + ' %'}</td></tr></tfoot>`;
  $(ids('t5')).innerHTML = h;
  return canalLbl + ' : ' + idx.length + ' j · ' + rl;
}

function bind5() {
  RENDERS.p5 = r5;
}

/* =====================================================================
   P7 — MAIL (les onglets DMT et Mail ont été retirés : les données restent
   importées pour l'onglet Productivité — Phone utilise l'Export Vonage Call,
   Mail l'Export Mail + Prévision Mail)
   ===================================================================== */
const hhDur = s => { s = Math.round(s || 0); let h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  if (m === 60) { h++; m = 0; } return h + ' h ' + String(m).padStart(2, '0'); };
function prevMailMap() {                                           // flux normalisé -> {date : prévision}
  const PM = {};
  ((D.pmail && D.pmail.rows) || []).forEach(([d, f, v]) => {
    const k = norm(f); PM[k] = PM[k] || {}; PM[k][d] = (PM[k][d] || 0) + v;
  });
  return PM;
}


boot();
