'use strict';
/* =====================================================================
   Dashboard capacitaire – Roadmap Auchan
   Données : localStorage « capaData » sinon data/data.json + data/roadmap.json
             (modèle RM) + data/prevision.json (Prévision Webhelp) + data/dashcapa.json
             (Données DASHBOARD CAPA AUCHAN : planification, skills, réalisation).
   Onglets : p1 Roadmap (3 sous-onglets : annuelle par semaine · journalière · créneaux 30 min —
             capa du modèle RM répartie selon les poids de la prévision) ·
             p8 Planification (2 sous-onglets : journalière · créneaux — heures réparties
             par activité × canal selon la feuille Skills) ·
             p3 Analyse capa (capa roadmap vs planif) · p5 Analyse réalisé (sections Phone/Mail/Chat).
   Filtres globaux (tous les onglets) : Granularité · Flux (FO/BO/Autres, multi) ·
   Channel (PHONE/MAIL/CHAT, multi) · Activités (multi) · Période · Intervalle de période.
   Structure : Front office = PHONE (Hyper, C2E, AFR, Drive, SAV, Direct) · Back office = MAIL (Hyper, AFR, Drive) · Autres = CHAT.
   ===================================================================== */

/* ---------- constantes ---------- */
const LS = 'capaData';
const RFLOW = ['HYPER', 'C2E', 'AFR', 'DRIVE', 'SAV'];                       // flux du réalisé (DRM)
const RCOL  = { HYPER:'#3b5bdb', C2E:'#0ca678', AFR:'#f59f00', DRIVE:'#7048e8', SAV:'#e8590c' };
const PAL   = ['#3b5bdb','#0ca678','#f59f00','#7048e8','#e8590c','#1098ad','#d6336c','#74b816'];
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
const GF_V = 2;                                      /* v2 : sélection explicite (vide = rien d'affiché) */
const gfAllActs = () => [...new Set(Object.values(CH_ACTS).flat())];
let GF = { v: GF_V, g: 'jour', flux: Object.keys(FLUX_CH).slice(), chan: ['PHONE', 'MAIL', 'CHAT'],
           acts: gfAllActs(), per: 'all', a: '', b: '' };
function gfLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(GF_LS));
    if (s && typeof s === 'object') {
      const old = !s.v || s.v < GF_V;                /* ancien format : sélection vide = tout */
      GF = Object.assign(GF, s); GF.v = GF_V;
      if (old) { GF.flux = Object.keys(FLUX_CH).slice(); GF.chan = ['PHONE', 'MAIL', 'CHAT']; GF.acts = gfAllActs(); }
    }
  } catch (e) {}
}
function gfSave() { try { localStorage.setItem(GF_LS, JSON.stringify(GF)); } catch (e) {} }
function effFluxSet() { return new Set(GF.flux); }
function effChanSet() {
  const allow = new Set();
  GF.flux.forEach(f => (FLUX_CH[f] || []).forEach(c => allow.add(c)));
  return new Set(GF.chan.filter(c => allow.has(c)));
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
  return GF.acts.includes(actKeyOf(a));
}
function gfLbl() {                                   // libellé du périmètre choisi
  const allF = GF.flux.length === Object.keys(FLUX_CH).length;
  const allA = GF.acts.length >= gfAllActs().length;
  if (allF && GF.chan.length >= 3 && allA) return 'Total';
  const bits = [];
  if (GF.flux.length && !allF) bits.push(GF.flux.map(f => FLUX_LBL[f]).join(' + '));
  if (!GF.flux.length && GF.chan.length) bits.push(GF.chan.join(' + '));
  if (GF.acts.length && !allA) bits.push(GF.acts.join(' + '));
  return bits.length ? bits.join(' · ') : 'Total';
}
function gfCascade(auto) {
  const chanAllow = new Set(); GF.flux.forEach(f => (FLUX_CH[f] || []).forEach(c => chanAllow.add(c)));
  GF.chan = GF.chan.filter(c => chanAllow.has(c));
  const actAllow = new Set(); GF.chan.forEach(c => (CH_ACTS[c] || []).forEach(a => actAllow.add(a)));
  GF.acts = GF.acts.filter(a => actAllow.has(a));
  if (auto) {                                        /* parent modifié : compléter les enfants si vide */
    if (GF.flux.length && !GF.chan.length) GF.chan = [...chanAllow];
    if (GF.chan.length && !GF.acts.length) GF.acts = [...new Set(GF.chan.flatMap(c => CH_ACTS[c] || []))];
  }
}
function gfRender() {
  const fx = $('gfFlux'), cx = $('gfChan'), ax = $('gfActs');
  fx.innerHTML = Object.keys(FLUX_CH).map(f =>
    `<button type="button" class="chipbtn${GF.flux.includes(f) ? ' on' : ''}" data-f="${f}">${FLUX_LBL[f]}</button>`).join('');
  const chanAllow = new Set(); GF.flux.forEach(f => (FLUX_CH[f] || []).forEach(c => chanAllow.add(c)));
  cx.innerHTML = ['PHONE', 'MAIL', 'CHAT'].filter(c => chanAllow.has(c)).map(c =>
    `<button type="button" class="chipbtn${GF.chan.includes(c) ? ' on' : ''}" data-c="${c}">${c}</button>`).join('');
  const actAllow = new Set(); GF.chan.forEach(c => (CH_ACTS[c] || []).forEach(a => actAllow.add(a)));
  ax.innerHTML = [...actAllow].map(a =>
    `<button type="button" class="chipbtn${GF.acts.includes(a) ? ' on' : ''}" data-a="${a}">${a}</button>`).join('');
  fx.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const f = b.dataset.f;
    GF.flux = GF.flux.includes(f) ? GF.flux.filter(x => x !== f) : GF.flux.concat(f);
    gfCascade(true); gfSave(); gfRender(); if (RENDERS[PAGE]) RENDERS[PAGE](); }));
  cx.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const c = b.dataset.c;
    GF.chan = GF.chan.includes(c) ? GF.chan.filter(x => x !== c) : GF.chan.concat(c);
    gfCascade(true); gfSave(); gfRender(); if (RENDERS[PAGE]) RENDERS[PAGE](); }));
  ax.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.a;
    GF.acts = GF.acts.includes(a) ? GF.acts.filter(x => x !== a) : GF.acts.concat(a);
    gfSave(); gfRender(); if (RENDERS[PAGE]) RENDERS[PAGE](); }));
}
function gfSetGroup(gk, on) {                        /* Tout / Aucun sur un groupe */
  if (gk === 'flux') GF.flux = on ? Object.keys(FLUX_CH).slice() : [];
  else if (gk === 'chan') GF.chan = on ? [...new Set(GF.flux.flatMap(f => FLUX_CH[f] || []))] : [];
  else GF.acts = on ? [...new Set(GF.chan.flatMap(c => CH_ACTS[c] || []))] : [];
}
function gfDisables() {                              // filtres sans objet sur certains onglets
  const off = { p1: ['gfGW', 'gfPW', 'gfIW'], p8: ['gfGW', 'gfPW', 'gfIW'] }[PAGE] || [];
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
  document.querySelectorAll('.fmini').forEach(b => b.addEventListener('click', () => {
    gfSetGroup(b.dataset.g, b.dataset.on === '1');
    gfCascade(b.dataset.on === '1'); gfSave(); gfRender(); if (RENDERS[PAGE]) RENDERS[PAGE]();
  }));
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
function isoWeekYear(d) {                            // année ISO de la semaine (année du jeudi)
  const dt = new Date(d + 'T00:00:00');
  const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const dn = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - dn + 3);
  return t.getUTCFullYear();
}
const wLabY = d => 'S' + isoWeek(d) + ' ' + String(isoWeekYear(d)).slice(2);   // 'S46 26' (S46 de 2025 ≠ S46 de 2026)
const cum = a => { let s = 0; return a.map(v => (s += v)); };
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
const mondayOfW = w => addDays('2025-12-29', (w - 1) * 7);          // semaine 1 de 2026 : lun. 29 déc. 2025
const sec = s => Math.round(s || 0);               // DMT affichée en secondes (nombre) : 300 = 5 min
const dShort = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? (+d.slice(8, 10)) + ' ' + MOIS[+d.slice(5, 7) - 1] : (d || '—');
const rangeLbl = (a, b) => !a && !b ? 'période complète'
  : a && b ? dShort(a) + ' → ' + dShort(b) + (a.slice(0, 4) !== b.slice(0, 4) ? ' ' + b.slice(0, 4) : '')
  : a ? 'depuis le ' + dShort(a) : 'jusqu\'au ' + dShort(b);

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
function rmProdKey(act, chan) {               // clé « Productivité » du modèle RM pour (activité, canal)
  const s = norm(act);
  let base = null;
  if (s.includes('borne') || s.includes('lsa')) base = 'Borne/LSA';
  else if (s.includes('chat')) base = 'Chat';
  else for (const x in ACT_CAP) if (s.includes(x)) base = ACT_CAP[x];
  if (!base) return String(act).trim();
  if (norm(base) === 'direct') base = 'Direct (LAD)';            // libellé exact du RM
  if (norm(chan) === 'mail' && !norm(base).startsWith('mail')) base = 'Mail ' + base;
  return base;
}
function rmHypOf(act, chan) {                 // hypothèse RM moyenne (toutes semaines disponibles)
  const S = D.rm2 && D.rm2.s && D.rm2.s.prod_h;
  if (!S || !S.a) return null;
  let arr = S.a[rmProdKey(act, chan)];
  if (!arr && norm(chan) === 'mail') arr = S.a[rmProdKey(act, 'PHONE')];   // repli : productivité voix
  if (!arr) return null;
  const xs = arr.filter(v => v != null && v > 0);
  return xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length * 10) / 10 : null;
}
function manProdOf(act, chan) {               // hypothèse manuelle enregistrée (clé RM|canal, act|canal ou act) ou null
  const s = norm(act), c = norm(chan);
  const tries = [norm(rmProdKey(act, chan)) + '|' + c, s + '|' + c, s];
  for (const k of tries) { const v = D.prod.def[k]; if (v > 0) return v; }
  return null;
}
function planProdOf(act, chan, wi) {          // capa planif : hypothèse manuelle > modèle RM > replis
  const m = manProdOf(act, chan);
  if (m != null) return m;
  const S = D.rm2 && D.rm2.s && D.rm2.s.prod_h;
  const key = rmProdKey(act, chan);
  const x = S && S.a[key] ? S.a[key][wi] : null;
  if (x != null) return x;
  if (norm(chan) === 'mail') {                // repli : productivité voix de l'activité
    const k2 = rmProdKey(act, 'PHONE');
    const y = S && S.a[k2] ? S.a[k2][wi] : null;
    if (y != null) return y;
  }
  return prodOf(act);
}

/* ---------- état ---------- */
let D = null;                                        // données complètes
let PAGE = 'p1';
const CH = {};                                       // instances Chart.js

function emptyData() {
  return { meta: { maj: new Date().toISOString().slice(0, 10) },
           roadmap: [],
           planH: { file: '', maj: '', dates: [], acts: [], f: {} },
           etp: { file: '', maj: '', rows: [] },
           prod: { file: '', def: {} },
           real: { maj: '', file: '', flows: RFLOW.slice(), dates: [], sem: [], jours: [],
                   f: Object.fromEntries(RFLOW.map(f => [f, { t: [], r: [], s: [] }])) },
           dmt: { file: '', maj: '', dates: [], flows: [], f: {} },
           mail: { file: '', maj: '', dates: [], flows: [], f: {} },
           pmail: { file: '', maj: '', rows: [] },
           skills: null, logR: null,
           plan: null,
           prev: null };
}
function ensure() {
  if (!D.meta) D.meta = {};
  if (D.rm2 === undefined) D.rm2 = null;
  if (!D.roadmap) D.roadmap = [];
  D.roadmap.forEach(r => { if (!Array.isArray(r.etp)) r.etp = []; if (!Array.isArray(r.capa)) r.capa = []; });
  if (!D.planH) D.planH = { file: '', maj: '', dates: [], acts: [], f: {} };
  if (!D.etp) D.etp = { file: '', maj: '', rows: [] };
  if (!D.prod) D.prod = { file: '', def: {} };
  if (!D.prod.def) D.prod.def = {};
  if (!D.real) D.real = emptyData().real;
  D.real.flows = RFLOW.slice();
  RFLOW.forEach(f => { if (!D.real.f[f]) D.real.f[f] = { t: [], r: [], s: [] }; });
  if (!D.dmt) D.dmt = { file: '', maj: '', dates: [], flows: [], f: {} };
  if (!D.mail) D.mail = { file: '', maj: '', dates: [], flows: [], f: {} };
  if (!D.pmail) D.pmail = { file: '', maj: '', rows: [] };
  if (D.plan === undefined) D.plan = null;
  if (D.prev === undefined) D.prev = null;
  if (D.skills === undefined) D.skills = null;
  if (D.logR === undefined) D.logR = null;
}
/* ---------- stockage persistant : IndexedDB (repli localStorage) ----------
   localStorage est limité (~5 Mo) : avec les fichiers complets (RM + Prévision +
   Planning sur plusieurs mois) la sauvegarde échouait en silence et les données
   disparaissaient à l'actualisation. IndexedDB offre un quota bien supérieur ;
   localStorage reste écrit en parallèle quand c'est possible (compatibilité). */
const DBN = 'capaDB', DBS = 'state', DBK = 'capaData';
let _idbP = null;
function idb() {
  if (_idbP !== null) return _idbP;
  _idbP = new Promise((res, rej) => {
    try {
      const rq = indexedDB.open(DBN, 1);
      rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains(DBS)) rq.result.createObjectStore(DBS); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    } catch (e) { rej(e); }
  }).catch(() => null);
  return _idbP;
}
async function storeGet() {                          // chaîne JSON stockée, ou null
  const db = await idb();
  if (db) {
    try {
      return await new Promise((res, rej) => {
        const rq = db.transaction(DBS, 'readonly').objectStore(DBS).get(DBK);
        rq.onsuccess = () => res(rq.result || null);
        rq.onerror = () => rej(rq.error);
      });
    } catch (e) { /* repli localStorage */ }
  }
  try { return localStorage.getItem(LS); } catch (e) { return null; }
}
async function storeDel() {
  _saveGen++; _saveDirty = false;                    // annule toute sauvegarde en attente (course reset)
  if (_saveT) { clearTimeout(_saveT); _saveT = null; }
  const db = await idb();
  if (db) { try { db.transaction(DBS, 'readwrite').objectStore(DBS).delete(DBK); } catch (e) {} }
  try { localStorage.removeItem(LS); } catch (e) {}
}
let _saveT = null, _saveDirty = false, _saveGen = 0;
function save() {                                    // sauvegarde automatique (débounce 200 ms)
  _saveDirty = true;
  if (_saveT) return;
  const g = _saveGen;
  _saveT = setTimeout(async () => {
    _saveT = null;
    if (g !== _saveGen || !_saveDirty) return;       // réinitialisation entre-temps : ne pas réécrire
    _saveDirty = false;
    await doSave();
    if (g === _saveGen && _saveDirty) save();        // modifications pendant l'écriture
  }, 200);
}
async function doSave() {
  let ok = false;
  try {
    const json = JSON.stringify(D);
    const db = await idb();
    if (db) {
      await new Promise((res, rej) => {
        const rq = db.transaction(DBS, 'readwrite').objectStore(DBS).put(json, DBK);
        rq.onsuccess = res; rq.onerror = () => rej(rq.error);
      });
      ok = true;
    }
    try { localStorage.setItem(LS, json); ok = true; } catch (e) { /* quota LS dépassé : IndexedDB suffit */ }
  } catch (e) { console.warn('sauvegarde', e); }
  const el = $('saveSt');
  if (el) {
    if (!ok) { el.textContent = '⚠ Sauvegarde impossible'; el.className = 'savest err'; }
    else {
      const t = new Date();
      el.textContent = 'Sauvegardé à ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
      el.className = 'savest';
    }
  }
  return ok;
}
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
  if (D.planH && D.planH.dates && D.planH.dates.length)
    bits.push('Planning (h) : ' + (m.plan || D.planH.file || 'importé') + ' (' + D.planH.dates.length + ' j)');
  if (D.plan && D.plan.dates && D.plan.dates.length)
    bits.push('Planification : ' + ((D.plan.meta && D.plan.meta.file) || 'importée') + ' (' + D.plan.dates.length + ' j)' +
      (D.skills && D.skills.by ? ' · ' + Object.keys(D.skills.by).filter(k => k.startsWith('wd:')).length + ' compétences' : ''));
  if (D.logR && D.logR.dates && D.logR.dates.length)
    bits.push('Heures de log réalisées : ' + D.logR.dates.length + ' j');
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

/* ---- Planification : feuille « Planning » du fichier « Données DASHBOARD CAPA AUCHAN » ----
   Lignes Statut = « Planifié » uniquement. Présence par créneau 30 min =
   recouvrement [Shift In, Shift Out) − recouvrement [Pause repas).
   FIM (Compétences = FIM ou Total FIM ≥ HP) = personnes hors prod : comptées à part, 0 en prod.
   HP du fichier = shift − pause repas ; Heures de log = HP − Total FIM.
   Capa en heures (contrat) = effectif planifié hors FIM × heure contrat
   (8 h/jour · 40 h/semaine, 7 h si allaitement) — cf. day[].ctr / buildPlanExtras.
   Répartition par activité × canal : cf. buildPlanExtras (feuille Skills). */
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
    let hp = 0, fimh = 0, rep = 0, n = 0, nF = 0, nctr = 0, ctr = 0, nal = 0; const ags = [];
    by[d].forEach(r => {
      const hasRep = r.r1 != null && r.r2 != null && r.r2 > r.r1;
      const repM = hasRep ? ovMin(r.r1, r.r2, 0, 1440) : 0;
      rep += repM / 60; hp += r.hp; fimh += r.fim; n++; ags.push(r.ag);
      if (r.fimrow) nF++;
      else { const al = r.al || 0; nctr++; ctr += Math.max(0, 8 - al); if (al > 0) nal++; }
      slots.forEach((s, i) => {
        const x = ovMin(s, s + 30, r.sin, r.sout) - (hasRep ? ovMin(s, s + 30, r.r1, r.r2) : 0);
        if (x <= 0) return;
        const w = x / 30;
        pres[i] += w;
        if (r.fimrow) fim[i] += w; else prod[i] += w;
      });
    });
    m.prod[d] = prod.map(v => Math.round(v * 1000) / 1000);
    m.fim[d]  = fim.map(v => Math.round(v * 1000) / 1000);
    m.pres[d] = pres.map(v => Math.round(v * 1000) / 1000);
    day[d] = { plan: n, fim: nF, hp: r2d(hp), hprod: r2d(Math.max(0, hp - fimh)),
               fimh: r2d(fimh), repas: r2d(rep), nctr, ctr: r2d(ctr), nal, ag: ags };
  });
  return { meta: { agents: new Set(pr.map(r => r.ag)).size }, dates,
           slots: slots.map(t => slotLab(Math.floor(t / 60) * 100 + t % 60)), m, day };
}
/* ---- Compétences (feuille Skills) & répartition des heures planifiées ----
   HYPER/DRIVE -> 50/50 sur les activités Hyper et Drive × 50/50 sur les canaux MAIL/PHONE
   ALL         -> toutes les activités et tous les canaux (répartition uniforme)
   SAV         -> mono-compétence sur le PHONE · CHAT -> mono-compétence sur le CHAT
   FIM         -> hors prod (exclu de la répartition). */
const SK_LOT = { 'lot 1 & lot 2': 'HYPER/DRIVE', 'lot 3': 'SAV', 'lot 4': 'CHAT', 'lot unique': 'ALL' };
function lotToSkill(lot) {
  const s = norm(lot);
  for (const k in SK_LOT) if (s.startsWith(k)) return SK_LOT[k];
  return '';
}
function actSkillOf(acts) {
  const s = norm(acts);
  if (s.includes('all')) return 'ALL';
  if (s.includes('hyper') || s.includes('drive')) return 'HYPER/DRIVE';
  if (s.includes('sav')) return 'SAV';
  if (s.includes('chat')) return 'CHAT';
  return '';
}
function skillWeights(sk) {                          // [activité, canal, part]
  if (sk === 'HYPER/DRIVE') return [['Hyper', 'PHONE', .25], ['Drive', 'PHONE', .25], ['Hyper', 'MAIL', .25], ['Drive', 'MAIL', .25]];
  if (sk === 'SAV')  return [['SAV', 'PHONE', 1]];
  if (sk === 'CHAT') return [['Chat', 'CHAT', 1]];
  if (sk === 'ALL') {
    const combos = [];
    ['PHONE', 'MAIL', 'CHAT'].forEach(c => (CH_ACTS[c] || []).forEach(a => combos.push([a, c])));
    const w = Math.round(1 / combos.length * 1e6) / 1e6;
    return combos.map(([a, c]) => [a, c, w]);
  }
  return [];
}
function skillOfRow(r) {                             // compétence d'une ligne Planning
  const S = D.skills && D.skills.by;
  if (S) {
    if (r.wd && S['wd:' + r.wd]) return S['wd:' + r.wd].sk;
    const mio = norm(r.ag).match(/web_pst42_\d+/);
    if (mio && S['io:' + mio[0]]) return S['io:' + mio[0]].sk;
  }
  return lotToSkill(r.lot) || actSkillOf(r.lot) || 'ALL';
}
const slotMinCache = {};
function slotMin(lab) {                              // '07:30' -> 450
  if (slotMinCache[lab] != null) return slotMinCache[lab];
  const m = String(lab).match(/^(\d{1,2}):(\d{2})$/);
  return slotMinCache[lab] = m ? +m[1] * 60 + +m[2] : 0;
}

/* ---- Répartition de la capa en heures de contrat par activité × canal (skills) ----
   Génère plan.byAct {date -> {'Act|CANAL' -> h}}, plan.byActSlot {date -> {'Act|CANAL' -> [h/créneau]}}
   et D.planH (heures par activité, canaux fusionnés — f — et par act|canal — fc)
   à partir des lignes planifiées hors FIM (plan.rows).
   Heures = heure de contrat (8 h/jour, 7 h si allaitement) ramenée sur la
   présence [Shift In, Shift Out) − pause repas, au prorata des créneaux. */
function buildPlanExtras() {
  const P = D.plan; if (!P || !P.rows) return;
  const combos = new Map();
  const byAct = {}, byActSlot = {};
  const slotMins = (P.slots || []).map(slotMin);
  P.rows.forEach(r => {
    if (r.fimrow) return;
    const w = skillWeights(skillOfRow(r));
    if (!w.length) return;
    const d = r.d;
    byAct[d] = byAct[d] || {}; byActSlot[d] = byActSlot[d] || {};
    const ctr = Math.max(0, 8 - (r.al || 0));      // heure contrat : 8 h/jour, 7 h si allaitement
    const sh = slotMins.map((s0, si) => {          // heures de présence du créneau
      let x = ovMin(s0, s0 + 30, r.sin, r.sout);
      if (r.r1 != null && r.r2 != null && r.r2 > r.r1) x -= ovMin(s0, s0 + 30, r.r1, r.r2);
      return x > 0 ? x / 60 : 0;
    });
    const presH = sh.reduce((a, b) => a + b, 0);
    if (presH <= 0 || ctr <= 0) return;            // ligne sans présence exploitable
    const kC = ctr / presH;                        // présence ramenée aux heures de contrat
    slotMins.forEach((s0, si) => {
      const h = sh[si] * kC;                       // heures de contrat du créneau (Σ = ctr)
      if (!h) return;
      w.forEach(([a, c, share]) => {
        const k = a + '|' + c; combos.set(k, { a, c });
        byAct[d][k] = (byAct[d][k] || 0) + h * share;          // accumulation brute (arrondi final ci-dessous)
        (byActSlot[d][k] = byActSlot[d][k] || Array(P.slots.length).fill(0))[si] += h * share;
      });
    });
  });
  /* arrondi final — jamais à chaque pas (l'arrondi par accumulation fausse les sommes :
     16 créneaux × 0.0454545 arrondis pas à pas donnent 0.720 au lieu de 0.727) */
  Object.values(byAct).forEach(m => { for (const k in m) m[k] = Math.round(m[k] * 1000) / 1000; });
  Object.values(byActSlot).forEach(m => { for (const k in m) {
    const arr = m[k]; for (let i = 0; i < arr.length; i++) if (arr[i]) arr[i] = Math.round(arr[i] * 1000) / 1000;
  } });
  P.acts = [...combos.keys()];
  P.byAct = byAct; P.byActSlot = byActSlot;
  const PH = D.planH = { file: (P.meta && P.meta.file) || '', maj: (P.meta && P.meta.maj) || '',
    dates: (P.dates || []).slice(), acts: [], f: {}, fc: {} };
  combos.forEach(({ a }) => { if (!PH.acts.includes(a)) PH.acts.push(a); });
  PH.acts.sort();
  PH.dates.forEach((d, di) => PH.acts.forEach(a => { PH.f[a] = PH.f[a] || []; PH.f[a][di] = 0; }));
  P.dates.forEach((d, di) => {
    Object.entries(byAct[d] || {}).forEach(([k, h]) => {
      const a = k.split('|')[0];
      PH.f[a][di] = (PH.f[a][di] || 0) + h;            // accumulation brute, arrondi à la fin
      PH.fc[k] = PH.fc[k] || Array(PH.dates.length).fill(0);
      PH.fc[k][di] = h;
    });
  });
  Object.keys(PH.f).forEach(a => { const arr = PH.f[a]; for (let i = 0; i < arr.length; i++) if (arr[i]) arr[i] = Math.round(arr[i] * 1000) / 1000; });
}

/* ---- Import « Données DASHBOARD CAPA AUCHAN » (.xlsx) ----
   Feuilles : Planning (heures planifiées agent × jour) · Skills (compétences) ·
   EXT_Agent (heures de log réalisées) · EXT_Entrant (réalisé voix + DMT) · EXT_Email (réalisé mail).
   Ce fichier devient la source unique de la planification et de la réalisation. */
function impDashCapa(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetOf = test => wb.Sheets[wb.SheetNames.find(n => test(norm(n)))];
  const aoa = sn => sn ? XLSX.utils.sheet_to_json(sn, { header: 1, raw: true, defval: null }) : null;
  const bits = [];
  /* 1 · Skills — agent -> compétence (clés wd:<workday> et io:<id odigo>) */
  const snSk = sheetOf(n => n === 'skills');
  if (snSk) {
    const a = aoa(snSk), by = {};
    for (let i = 1; i < a.length; i++) {
      const r = a[i] || [];
      const sk = actSkillOf(r[6]) || lotToSkill(r[0]);
      if (!sk) continue;
      const info = { sk, lot: String(r[0] ?? '') };
      if (r[1] != null && String(r[1]).trim() !== '') by['wd:' + String(r[1]).trim()] = info;
      if (r[5]) by['io:' + norm(r[5])] = info;
    }
    if (Object.keys(by).length)
      D.skills = { meta: { file: name, maj: new Date().toISOString().slice(0, 10) }, by };
  }
  /* 2 · Planning — heures planifiées par agent × jour (Statut = Planifié) */
  const snPl = sheetOf(n => n === 'planning');
  if (!snPl) throw new Error('Feuille « Planning » introuvable');
  const aP = aoa(snPl);
  let hi = aP.findIndex(r => r && r.some(v => norm(v) === 'statut') && r.some(v => norm(v).includes('shift')));
  if (hi < 0) hi = 0;
  const head = (aP[hi] || []).map(v => norm(v));
  const col = (nm, alts) => { let i = head.indexOf(nm);
    if (i >= 0) return i;
    if (alts) for (const x of alts) { i = head.findIndex(h => h.includes(x)); if (i >= 0) return i; }
    return -1; };
  const cD = col('date'), cSt = col('statut'), cAg = col('log vonage', ['agent', 'noms']),
    cCp = col('competences'), cWd = col('workday'), cSI = col('shift in', ['debut de shift']),
    cSO = col('fin de shift', ['shift out']), cR1 = col('debut pause repas'), cR2 = col('fin pause repas'),
    cHP = col('hp'), cFm = col('total fim'), cAl = col('allaitement');
  if (cD < 0 || cSt < 0 || cSI < 0 || cSO < 0) throw new Error('Colonnes Statut / date / Shift In / Shift Out introuvables');
  const rows = [], prodRows = [], fimAgs = new Set();
  for (let i = hi + 1; i < aP.length; i++) {
    const r = aP[i] || [];
    const d = isoD(r[cD]);
    const sin = tMin(cSI >= 0 ? r[cSI] : null), sout = tMin(cSO >= 0 ? r[cSO] : null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || sin == null || sout == null || norm(r[cSt]) !== 'planifie') continue;
    if (sout <= sin) sout += 1440;
    const hp = tHrs(cHP >= 0 ? r[cHP] : 0), fim = tHrs(cFm >= 0 ? r[cFm] : 0);
    const comp = norm(cCp >= 0 ? r[cCp] : '');
    const row = { ok: true, d, ag: String(cAg >= 0 ? (r[cAg] ?? '') : ''),
      wd: cWd >= 0 ? String(r[cWd] ?? '').trim() : '', lot: comp,
      fimrow: comp === 'fim' || (fim > 0 && hp > 0 && fim >= hp - 0.01),
      sin, sout, r1: tMin(cR1 >= 0 ? r[cR1] : null), r2: tMin(cR2 >= 0 ? r[cR2] : null),
      hp: r2d(hp), fim: r2d(fim), al: cAl >= 0 ? r2d(tHrs(r[cAl])) : 0 };
    rows.push(row);
    if (row.fimrow) fimAgs.add(row.ag); else prodRows.push(row);
  }
  const plan = planAgg(rows);
  plan.meta = Object.assign(plan.meta || {}, { file: name, maj: new Date().toISOString().slice(0, 10) });
  plan.rows = prodRows;
  D.plan = plan;
  D.meta.planA = name;
  buildPlanExtras();
  bits.push(plan.dates.length + ' jours · ' + plan.meta.agents + ' agents planifiés · ' +
    (D.planH.acts || []).length + ' activités réparties');
  /* 3 · EXT_Agent — heures de log réalisées (Busy / Wrap Up / Hold / Chat / Panier), hors agents FIM */
  const snAg = sheetOf(n => n.includes('ext_agent'));
  if (snAg) {
    const a = aoa(snAg);
    const PROD = s => s.startsWith('busy') || ['wrap up', 'hold', 'chat', 'panier', 'transfer in', 'fintecture', 'courrier'].includes(s);
    const acc = { PHONE: {}, CHAT: {} };
    for (let i = 1; i < a.length; i++) {
      const r = a[i] || []; if (r.length < 7) continue;
      const d = isoD(r[1]); const act = norm(r[6]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !PROD(act)) continue;
      if (fimAgs.has(String(r[2] ?? ''))) continue;
      const chan = norm(r[9]).toUpperCase() === 'CHAT' ? 'CHAT' : 'PHONE';
      const h = tHrs(r[5]);
      if (!(h > 0)) continue;
      acc[chan][d] = (acc[chan][d] || 0) + h;
    }
    const dates = [...new Set(Object.keys(acc.PHONE).concat(Object.keys(acc.CHAT)))].sort();
    if (dates.length) {
      D.logR = { meta: { file: name, maj: new Date().toISOString().slice(0, 10) }, dates,
        h: { PHONE: dates.map(d => r2d(acc.PHONE[d] || 0)), CHAT: dates.map(d => r2d(acc.CHAT[d] || 0)) } };
      D.logR.h.tot = D.logR.h.PHONE.map((v, i) => r2d(v + D.logR.h.CHAT[i]));
      bits.push('heures de log réalisées ' + fmt(Math.round(D.logR.h.tot.reduce((x, y) => x + y, 0))) + ' h');
    }
  }
  /* 4 · EXT_Entrant — réalisé voix (Reçus / Traité / Traité -60 s) + DMT (communication + after-call) */
  const snEn = sheetOf(n => n.includes('ext_entrant'));
  if (snEn) {
    const a = aoa(snEn);
    const fluxOf = q => { const s = norm(q).toUpperCase();
      const m = s.match(/^V\s+([A-Z0-9]+)/); let tok = m ? m[1] : s.replace(/-\d+$/, '').trim();
      if (tok.startsWith('BARCELONE')) tok = 'BCN';
      return tok || 'AUTRE'; };
    const F = {}, ds = new Set();
    for (let i = 1; i < a.length; i++) {
      const r = a[i] || []; if (r.length < 27) continue;
      const q = r[1] || r[2]; if (!q) continue;
      const d = isoD(r[14]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const fl = fluxOf(q); ds.add(d);
      const o = F[fl] = F[fl] || { r: {}, t: {}, s: {}, n: {}, com: {}, acw: {} };
      const rep = norm(r[4]) === 'vrai';
      o.r[d] = (o.r[d] || 0) + (n2(r[26]) || (rep ? 1 : 0));
      o.t[d] = (o.t[d] || 0) + n2(r[25]);
      o.s[d] = (o.s[d] || 0) + n2(r[5]);
      if (rep) { o.n[d] = (o.n[d] || 0) + 1; o.com[d] = (o.com[d] || 0) + n2(r[13]); o.acw[d] = (o.acw[d] || 0) + n2(r[9]); }
    }
    const dates = [...ds].sort();
    const rank = f => (RFLOW.indexOf(f) < 0 ? 9 : RFLOW.indexOf(f));
    const flows = Object.keys(F).sort((x, y) => rank(x) - rank(y) || (x < y ? -1 : 1));
    if (dates.length && flows.length) {
      D.real = { meta: { file: name, maj: new Date().toISOString().slice(0, 10) }, dates, flows,
        sem: dates.map(d => isoWeek(d)), jours: dates.map(jJours),
        f: Object.fromEntries(flows.map(f => [f, { r: dates.map(d => F[f].r[d] || 0),
          t: dates.map(d => F[f].t[d] || 0), s: dates.map(d => F[f].s[d] || 0) }])) };
      D.dmt = { meta: { file: name, maj: new Date().toISOString().slice(0, 10) }, dates, flows,
        f: Object.fromEntries(flows.map(f => [f, { n: dates.map(d => F[f].n[d] || 0),
          com: dates.map(d => r2d(F[f].com[d] || 0)), acw: dates.map(d => r2d(F[f].acw[d] || 0)),
          lost: dates.map(() => 0) }])) };
      D.meta.real = D.meta.dmt = name;
      bits.push('réalisé voix : ' + flows.length + ' flux');
    }
  }
  /* 5 · EXT_Email — réalisé mail (reçus / traités / QS < 60 s / délais) */
  const snMl = sheetOf(n => n.includes('ext_email'));
  if (snMl) {
    const a = aoa(snMl);
    const F = {}, ds = new Set();
    for (let i = 1; i < a.length; i++) {
      const r = a[i] || []; if (r.length < 7) continue;
      const fl = r[4]; if (!fl) continue;
      const d = isoD(r[6]) || isoD(r[7]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const o = F[String(fl)] = F[String(fl)] || { rec: {}, tr: {}, t60: {}, del: {} };
      ds.add(d);
      o.rec[d] = (o.rec[d] || 0) + 1;
      const st = norm(r[1]), de = n2(r[2]);
      if (st.startsWith('ferm') || Math.round(n2(st)) === 1) {
        o.tr[d] = (o.tr[d] || 0) + 1; o.del[d] = (o.del[d] || 0) + de;
        if (de > 0 && de < 60) o.t60[d] = (o.t60[d] || 0) + 1;
      }
    }
    const dates = [...ds].sort();
    const rank = f => { const i = RFLOW.indexOf(f.toUpperCase()); return i < 0 ? 9 : i; };
    const flows = Object.keys(F).sort((x, y) => rank(x) - rank(y) || (x < y ? -1 : 1));
    if (dates.length && flows.length) {
      D.mail = { meta: { file: name, maj: new Date().toISOString().slice(0, 10) }, dates, flows,
        f: Object.fromEntries(flows.map(f => [f, { rec: dates.map(d => F[f].rec[d] || 0),
          tr: dates.map(d => F[f].tr[d] || 0), t60: dates.map(d => F[f].t60[d] || 0),
          del: dates.map(d => F[f].del[d] || 0) }])) };
      D.meta.mail = name;
      bits.push('réalisé mail : ' + flows.length + ' files');
    }
  }
  if (bits.length <= 1) bits.push('réalisation : feuilles EXT_* absentes ou vides');
  return bits.join(' · ');
}

/* ---- Prévision Webhelp : onglet « 2026 » (prévus mensuels par flux) + onglet « Poids » ----
   Poids journaliers (Appel B-F, Mail J-L) -> vue par jour ; créneaux 30 min (col. R :
   codes = FIN de créneau (800 = [07:30 → 08:00) Paris), profils « Lundi au samedi » /
   « Dimanche » S..AA) -> vue par créneau.
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

/* ---- gestion des fichiers ---- */
function bindImports() {
  $('fRoad').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stRoad', impRoadmap(f.name, b), true); afterImport('p1'); }
    catch (err) { setStatus('stRoad', 'Erreur : ' + err.message, false); }
  }));
  $('fPrev').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stPrev', impPrev(f.name, b), true); afterImport('p1'); }
    catch (err) { setStatus('stPrev', 'Erreur : ' + err.message, false); }
  }));
  $('fDash').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stDash', impDashCapa(f.name, b), true); afterImport('p8'); }
    catch (err) { setStatus('stDash', 'Erreur : ' + err.message, false); }
  }));
}
function afterImport(page) {
  D.meta.maj = new Date().toISOString().slice(0, 10);
  save(); renderHead(); fillSelects();
  go(page);
}

/* =====================================================================
   AMORÇAGE
   ===================================================================== */
async function loadPreloaded() {                     // fichiers statiques du dépôt — ne remplace jamais les données importées
  if (!D.rm2) {                                                     // modèle RM : 1 fichier dédié
    try {
      D.rm2 = await (await fetch('data/roadmap.json', { cache: 'no-store' })).json();
      if (D.rm2 && D.rm2.meta && D.rm2.meta.file) D.meta.rm2 = D.rm2.meta.file;
    } catch (e) { D.rm2 = null; }
  }
  if (!D.prev) {                                                    // prévision Webhelp : 1 fichier dédié
    try {
      D.prev = await (await fetch('data/prevision.json', { cache: 'no-store' })).json();
      if (D.prev && D.prev.meta && D.prev.meta.file) D.meta.prev = D.prev.meta.file;
    } catch (e) { D.prev = null; }
  }
  if (!D.plan || !D.plan.rows || !D.skills) {                       // Données DASHBOARD CAPA (plan + skills + réalisation)
    try {
      const J = await (await fetch('data/dashcapa.json', { cache: 'no-store' })).json();
      if (!D.plan || !D.plan.rows) {
        D.plan = J.plan || null;
        if (D.plan && D.plan.meta && D.plan.meta.file) D.meta.planA = D.plan.meta.file;
      }
      if (!D.skills && J.skills) D.skills = J.skills;
      if ((!D.logR || !D.logR.dates || !D.logR.dates.length) && J.logR) D.logR = J.logR;
      if (D.real && (!D.real.dates || !D.real.dates.length) && J.real) {
        D.real = J.real; if (J.real.meta && J.real.meta.file) D.meta.real = J.real.meta.file;
      }
      if (D.dmt && (!D.dmt.dates || !D.dmt.dates.length) && J.dmt) {
        D.dmt = J.dmt; if (J.dmt.meta && J.dmt.meta.file) D.meta.dmt = J.dmt.meta.file;
      }
      if (D.mail && (!D.mail.dates || !D.mail.dates.length) && J.mail) {
        D.mail = J.mail; if (J.mail.meta && J.mail.meta.file) D.meta.mail = J.mail.meta.file;
      }
    } catch (e) { /* fichier absent : données à importer */ }
  }
}
async function boot() {
  try {
    const s = await storeGet();                                     // IndexedDB, repli localStorage
    if (s) D = typeof s === 'string' ? JSON.parse(s) : s;
  } catch (e) { /* ignoré */ }
  if (!D) {
    try { D = await (await fetch('data/data.json', { cache: 'no-store' })).json(); }
    catch (e) { D = emptyData(); }
  }
  ensure();
  await loadPreloaded();
  if (D.plan && D.plan.rows && !D.plan.byAct) buildPlanExtras();    // répartition skills des données préchargées
  buildRoadmapCompat();
  bindUI();
  renderHead();
  fillSelects();
  { const el = $('saveSt'); if (el && !el.textContent) el.textContent = 'Sauvegarde locale active'; }
  go('p1');
}
function bindUI() {
  document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => go(b.dataset.p)));
  $('bImp').addEventListener('click', () => $('imp').showModal());
  $('bImpClose').addEventListener('click', () => $('imp').close());
  $('bExp').addEventListener('click', dlJSON);
  $('bExp2').addEventListener('click', dlJSON);
  $('bDemo').addEventListener('click', demo);
  $('bDemo2').addEventListener('click', demo);
  $('bReset').addEventListener('click', async () => {
    if (!confirm('Effacer les données locales et recharger les données préchargées ?')) return;
    await storeDel(); location.reload();
  });
  document.querySelectorAll('.refbtn').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true; b.classList.add('busy');
    const old = b.innerHTML;
    b.innerHTML = '⏳ Chargement…';
    await loadPreloaded();
    if (D.plan && D.plan.rows && (!D.plan.byAct || !D.plan.byActSlot)) buildPlanExtras();
    buildRoadmapCompat();
    save(); renderHead(); fillSelects();
    go(b.dataset.p);
    b.innerHTML = '✓ Actualisé'; b.classList.remove('busy');
    setTimeout(() => { b.innerHTML = old; b.disabled = false; }, 1200);
  }));
  bindImports();
  bindGBar();
  $('s1U').addEventListener('change', r1);
  bindP1Subs();
  bind8();
  RENDERS.p1 = r1; RENDERS.p3 = r3; RENDERS.p5 = r5;
  gfDisables();
}

function dlJSON() {
  const blob = new Blob([JSON.stringify(D)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function demo() {
  const base = emptyData();
  const today = new Date().toISOString().slice(0, 10);
  base.meta = { rm2: 'Démo RM', plan: 'Démo Planning', prod: 'Démo', prev: 'Démo Webhelp', real: 'Démo réalisé', dmt: 'Démo réalisé', mail: 'Démo réalisé', maj: today };
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
  const past = dates.filter(d => d <= today);
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
  /* prévision démo : 5 mois (poids journaliers + créneaux 30 min) — couvre les semaines RM démo */
  const dmos = ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'];
  const dmoOf = () => ({ appels: { hyper: 15000, c2e: 60, afr: 4200, drive: 13000, sav: 8000, direct: 0 },
                         mails: { hyper: 3300, c2e: 0, afr: 2100, drive: 2900, sav: 0, direct: 0 } });
  const dj = {}, slotsD = []; for (let t = 730; t <= 2030; t += 30) slotsD.push(t);
  const bell = t => Math.exp(-Math.pow(t - 1130, 2) / (2 * 180 * 180));
  const dcr = {}; PACTS.forEach(f => { dcr[f] = { ls: {}, dim: {} };
    slotsD.forEach(t => { dcr[f].ls[t] = f === 'direct' ? 0 : bell(t);
      dcr[f].dim[t] = ['hyper', 'afr', 'drive'].includes(f) && t >= 800 && t <= 1230 ? bell(t) * 3.2 : 0; });
    ['ls', 'dim'].forEach(p => { const s = Object.values(dcr[f][p]).reduce((x, y) => x + y, 0);
      if (s > 0) Object.keys(dcr[f][p]).forEach(t => dcr[f][p][t] = Math.round(dcr[f][p][t] / s * 1e6) / 1e6); }); });
  const creD = {};
  dmos.forEach(mk => {
    creD[mk] = dcr;
    const nD = new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate();
    const wsumD = { a: 0, m: 0 }, raw = {};
    for (let d = 1; d <= nD; d++) {
      const dk = mk + '-' + String(d).padStart(2, '0');
      const wd = new Date(dk + 'T00:00:00').getDay();
      const P = Math.pow(wd === 0 ? 0.25 : wd === 6 ? 0.7 : 1.08, wd === 0 ? 2 : 1);
      raw[dk] = { a: { hyper: P, c2e: P, afr: P, drive: P, sav: P, direct: 0 },
                  m: { hyper: P, c2e: 0, afr: P, drive: P, sav: 0, direct: 0 } };
      wsumD.a += P; wsumD.m += P;
    }
    Object.keys(raw).forEach(dk => { ['a', 'm'].forEach(c => Object.keys(raw[dk][c]).forEach(f =>
      raw[dk][c][f] = Math.round(raw[dk][c][f] / wsumD[c] * 1e6) / 1e6)); });
    Object.assign(dj, raw);
  });
  base.prev = { meta: { file: 'Démo Webhelp', maj: today, snapshot: today },
    mois: Object.fromEntries(dmos.map(mk => [mk, dmoOf()])),
    poidsJour: dj, poidsChat: {}, creneaux: creD };
  /* planification démo : agents avec compétences (feuille Skills) + agents FIM (hors prod) */
  const lotsD = [['LOT 1 & LOT 2'], ['LOT 3'], ['LOT 4'], ['LOT UNIQUE']];
  const agentsD = [];
  for (let i = 0; i < 4; i++) lotsD.forEach(([lot]) => agentsD.push({ n: 'Agent ' + lot + ' ' + (i + 1), lot }));
  for (let i = 0; i < 4; i++) agentsD.push({ n: 'Agent FIM ' + (i + 1), lot: 'FIM' });
  const dr = [];
  past.forEach((d, di) => {
    const wd = new Date(d + 'T00:00:00').getDay();
    agentsD.forEach((a, ai) => {
      if ((di + ai) % 7 === 3) return;                              // day off
      const sin = 10 * 60 + (ai % 3) * 30;
      const sout = sin + (wd === 0 ? 5 : 9) * 60 - (wd === 6 ? 2 * 60 : 0);
      const r1 = sin + 240, r2 = r1 + 60;
      dr.push({ ok: true, d, ag: a.n, lot: norm(a.lot), fimrow: a.lot === 'FIM', sin, sout, r1, r2,
        hp: (sout - sin - 60) / 60, fim: a.lot === 'FIM' ? (sout - sin - 60) / 60 : 0 });
    });
  });
  base.plan = planAgg(dr);
  base.plan.meta = Object.assign(base.plan.meta, { file: 'Démo Planning', maj: today });
  base.plan.rows = dr.filter(r => !r.fimrow);
  base.skills = { meta: { file: 'Démo Planning', maj: today },
    by: Object.fromEntries(agentsD.filter(a => a.lot !== 'FIM')
      .map((a, i) => ['wd:90000' + i, { sk: lotToSkill(a.lot) || 'ALL', lot: a.lot }])) };
  D = base; ensure();
  buildPlanExtras();
  /* heures de log réalisées démo (EXT_Agent) : ~60-85 % des heures planifiées par canal */
  const lrD = { meta: { file: 'Démo EXT_Agent', maj: today }, dates: past.slice(), h: { PHONE: [], CHAT: [], tot: [] } };
  past.forEach(d => {
    const BA = base.plan.byAct[d] || {};
    const hpP = Object.entries(BA).reduce((s, [k, h]) => s + (k.endsWith('|PHONE') ? h : 0), 0);
    const hpC = Object.entries(BA).reduce((s, [k, h]) => s + (k.endsWith('|CHAT') ? h : 0), 0);
    const f = 0.6 + 0.25 * Math.abs(Math.sin(+d.slice(8) / 2));
    const p = Math.round(hpP * f * 100) / 100, c = Math.round(hpC * f * 100) / 100;
    lrD.h.PHONE.push(p); lrD.h.CHAT.push(c); lrD.h.tot.push(Math.round((p + c) * 100) / 100);
  });
  base.logR = lrD;
  /* réalisé démo : DRM voix cohérent avec la capacitaire */
  const R = base.real; R.file = 'Démo réalisé'; R.maj = today;
  past.forEach(d => {
    R.dates.push(d); R.sem.push(isoWeek(d)); R.jours.push(jJours(d));
    RFLOW.forEach((fl, fi) => {
      const rec = 80 + Math.round(300 * Math.abs(Math.sin(+d.slice(8) + fi * 1.1)));
      const tr = Math.round(rec * (0.9 + 0.08 * Math.random()));
      R.f[fl].r.push(rec); R.f[fl].t.push(tr); R.f[fl].s.push(Math.round(tr * 0.62));
    });
  });
  D = base;
  buildPlanExtras();
  buildRoadmapCompat();
  save();
  renderHead(); fillSelects(); go('p1');
}

/* =====================================================================
   SÉLECTEURS COMMUNS
   ===================================================================== */
function fillSelects() {
  const R = D.rm2;
  const RW = !!(R && R.weeks && R.weeks.length);
  /* p1 vue annuelle : années + mois */
  const yrs = RW ? [...new Set(R.weeks.map(w => w.y))].sort() : [];
  fillSel('w1Y', [['', 'Toutes']].concat(yrs.map(y => [String(y), String(y)])));
  fillW1Months();
  /* p1 vues journalière / créneaux : années + semaines */
  const days = rmDays();
  const yrsD = [...new Set(days.map(d => d.slice(0, 4)))].sort();
  ['J', 'C'].forEach(pf => {
    fillSel('w1' + pf + 'Y', [['', 'Toutes']].concat(yrsD.map(y => [y, y])));
    fillW1Weeks(pf);
  });
  /* année courante par défaut (journalière / créneaux) */
  const yNow = String(new Date().getFullYear());
  ['J', 'C'].forEach(pf => {
    const el = $('w1' + pf + 'Y');
    if (!el.value && [...el.options].some(o => o.value === yNow)) { el.value = yNow; fillW1Weeks(pf); }
  });
  fillW1Days();
  /* sources */
  $('w1Src').textContent = RW ? 'Modèle RM : ' + (D.meta.rm2 || (R.meta && R.meta.file) || 'RM') + ' · ' + R.weeks.length + ' sem.'
                              : 'Modèle RM : à importer';
  $('w1JSrc').textContent = RW ? 'Capa du modèle RM répartie par jour selon les poids de la Prévision Webhelp'
                              : 'Vue journalière : modèle RM à importer';
  $('w1CSrc').textContent = RW ? 'Capa du modèle RM répartie par créneau 30 min (poids journaliers + créneaux de la prévision)'
                              : 'Vue créneaux : modèle RM à importer';
  $('w3Src').textContent = 'Capa roadmap : ' + (RW ? 'modèle RM (' + R.weeks.length + ' sem.) × poids de la prévision' : 'modèle RM à importer') +
    ' · Capa planif : ' + (D.plan && D.plan.dates && D.plan.dates.length ? ((D.plan.meta && D.plan.meta.file) || 'importée') + ' (' + D.plan.dates.length + ' j)' : 'à importer');
  $('w5Src').textContent = 'Phone : EXT_Entrant (Données DASHBOARD CAPA) · Mail : EXT_Email · Chat : —';
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
    case 'p3': { const d = (D.plan && D.plan.dates) || []; return d.length ? [d[0], d[d.length - 1]] : []; }
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
/* ---------- sous-onglets Roadmap (annuelle · journalière · créneaux) ---------- */
const P1V = { view: 'ann' };
function rmWeekOfDay(d) {                            // index de la semaine RM contenant d
  const R = D.rm2; if (!R || !R.weeks) return -1;
  for (let i = 0; i < R.weeks.length; i++) {
    const w = R.weeks[i], st = w.start || '', en = w.end || (st ? addDays(st, 6) : '');
    if (st && d >= st && d <= en) return i;
  }
  return -1;
}
function rmWeeksFiltered(y, m) {                     // semaines filtrées par année + mois (chevauchement)
  const R = D.rm2; if (!R || !R.weeks) return [];
  const out = [];
  R.weeks.forEach((w, i) => {
    const st = w.start || '', en = w.end || (st ? addDays(st, 6) : '');
    if (y && String(w.y) !== String(y)) return;
    if (m) {
      if (!st) return;
      const ym = String(y || st.slice(0, 4)) + '-' + m;
      if (!(st <= ym + '-31' && en >= ym + '-01')) return;
    }
    out.push(i);
  });
  return out;
}
function rmWeeksSel() { return rmWeeksFiltered($('w1Y').value, $('w1M').value); }
function r1() {
  if (P1V.view === 'jour') return r1Jour();
  if (P1V.view === 'cre') return r1Cre();
  return r1Ann();
}
function bindP1Subs() {
  document.querySelectorAll('#p1subs button[data-v]').forEach(b => b.addEventListener('click', () => {
    P1V.view = b.dataset.v;
    document.querySelectorAll('#p1subs button[data-v]').forEach(x => x.classList.toggle('on', x === b));
    $('p1fAnn').style.display = P1V.view === 'ann' ? '' : 'none';
    $('p1fJour').style.display = P1V.view === 'jour' ? '' : 'none';
    $('p1fCre').style.display = P1V.view === 'cre' ? '' : 'none';
    $('p1vAnn').style.display = P1V.view === 'ann' ? '' : 'none';
    $('p1vJour').style.display = P1V.view === 'jour' ? '' : 'none';
    $('p1vCre').style.display = P1V.view === 'cre' ? '' : 'none';
    gfDisables(); r1();
  }));
  $('w1Y').addEventListener('change', () => { fillW1Months(); r1(); });
  $('w1M').addEventListener('change', r1);
  $('w1JY').addEventListener('change', () => { fillW1Weeks('J'); r1(); });
  $('w1JM').addEventListener('change', () => { fillW1Weeks('J'); r1(); });
  ['w1JW', 'w1JA', 'w1JB'].forEach(id => $(id).addEventListener('change', r1));
  $('w1CY').addEventListener('change', () => { fillW1Weeks('C'); fillW1Days(); r1(); });
  $('w1CM').addEventListener('change', () => { fillW1Weeks('C'); fillW1Days(); r1(); });
  ['w1CW', 'w1CA', 'w1CB', 'w1CV', 'w1CD'].forEach(id => $(id).addEventListener('change', r1));
  /* fuseau d'affichage & agrégat de la vue par créneaux (persistés) */
  try { const tz = JSON.parse(localStorage.getItem('capaTZ') || '{}');
    if (tz.tz != null && $('w1CTZ')) $('w1CTZ').value = String(tz.tz);
    if (tz.ag && $('w1CAg')) $('w1CAg').value = tz.ag; } catch (e) {}
  const tzSave = () => { try { localStorage.setItem('capaTZ',
    JSON.stringify({ tz: +($('w1CTZ') ? $('w1CTZ').value : 0), ag: $('w1CAg') ? $('w1CAg').value : '30' })); } catch (e) {} };
  tzSave();
  ['w1CTZ', 'w1CAg'].forEach(id => $(id).addEventListener('change', () => { tzSave(); r1(); }));
}
function fillSel(id, opts) {                         // remplit un select en conservant la sélection
  const el = $(id), cur = el.value;
  el.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  el.value = [...el.options].some(o => o.value === cur) ? cur
    : (opts[1] ? opts[1][0] : (opts[0] ? opts[0][0] : ''));
}
function fillW1Months() {                            // mois disponibles selon l'année (semaines RM)
  const R = D.rm2, y = $('w1Y').value, ms = new Set();
  (R && R.weeks || []).forEach(w => {
    if (y && String(w.y) !== y) return;
    if (w.start && (!y || w.start.slice(0, 4) === y)) ms.add(w.start.slice(5, 7));
    if (w.end && (!y || w.end.slice(0, 4) === y)) ms.add(w.end.slice(5, 7));
  });
  fillSel('w1M', [['', 'Tous']].concat([...ms].sort().map(m => [m, MOIS[+m - 1]])));
}
function fillW1Weeks(pf) {                           // semaines disponibles (vue journalière / créneaux)
  let days = rmDays();
  const y = $('w1' + pf + 'Y').value, m = $('w1' + pf + 'M').value;
  if (y) days = days.filter(d => d.slice(0, 4) === y);
  if (m) days = days.filter(d => d.slice(5, 7) === m);
  const ws = [...new Set(days.map(wLabY))].sort();
  fillSel('w1' + pf + 'W', [['', 'Toutes']].concat(ws.map(w => [w, w])));
}
function fillW1Days() {                              // bornes du jour précis (vue créneaux)
  const days = rmDays(), el = $('w1CD');
  if (!days.length) { el.value = ''; el.min = ''; el.max = ''; return; }
  el.min = days[0]; el.max = days[days.length - 1];
  if (!days.includes(el.value)) el.value = days[Math.min(days.length - 1, Math.floor(days.length / 2))];
}
function r1jDays(pf) {                               // jours retenus par les filtres année/mois/semaine/perso
  let days = rmDays();
  const y = $('w1' + pf + 'Y').value, m = $('w1' + pf + 'M').value, w = $('w1' + pf + 'W').value,
        a = $('w1' + pf + 'A').value, b = $('w1' + pf + 'B').value;
  if (y) days = days.filter(d => d.slice(0, 4) === y);
  if (m) days = days.filter(d => d.slice(5, 7) === m);
  if (w) days = days.filter(d => wLabY(d) === w);
  if (a) days = days.filter(d => d >= a);
  if (b) days = days.filter(d => d <= b);
  return days;
}

/* ---------- vue annuelle (par semaine) ---------- */
function r1Ann() {
  const R = D.rm2;
  const C1 = ['c1a', 'c1b', 'c1c', 'c1d', 'c1e', 'c1f', 'c1g', 'c1h', 'c1i'];
  const blank = () => {
    $('k1').innerHTML = '<div class="kpi"><div class="lbl">Aucun modèle RM</div><div class="sub">Importez le modèle RM (.xlsm, onglet AUCHAN) via « Importer » — besoin &amp; capacité, SLA/QE, DMT, occupation, absentéisme, congés.</div></div>';
    C1.forEach(c => mkChart(c, { type: 'bar', data: { labels: [], datasets: [] } }));
    $('t1').innerHTML = ''; $('t1Per').textContent = '—';
    $('w1Src').textContent = 'Modèle RM : à importer';
  };
  if (!R || !R.weeks || !R.weeks.length) { blank(); return; }
  const acts = rmActsSel();
  const perLbl = gfLbl();
  const W = R.weeks.length;
  const win = rmWeeksSel();
  if (!win.length) {
    $('k1').innerHTML = '<div class="kpi"><div class="lbl">Aucune semaine sur la période</div><div class="sub">Élargissez les filtres Année / Mois de la vue annuelle.</div></div>';
    C1.forEach(c => mkChart(c, { type: 'bar', data: { labels: [], datasets: [] } }));
    $('t1').innerHTML = ''; $('t1Per').textContent = '—';
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
  const dPct = (a, b) => a != null && b != null && b !== 0 ? ' · Δ ' + (a >= b ? '+' : '') + (Math.round((a / b - 1) * 1000) / 10) + ' %' : '';
  const pc1 = v => v == null ? '—' : (Math.round(v * 1000) / 10) + ' %';
  /* ---- KPIs de la période (années / mois sélectionnés) ---- */
  const sum = k => win.reduce((s, i) => s + (F[k][i] != null ? F[k][i] : 0), 0);
  const avg = k => { const vs = win.map(i => F[k][i]).filter(v => v != null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null; };
  const qeP = sum('pfin') > 0 ? sum('capa_a') / sum('pfin') : null;
  const dE = sum('eff_prod') - sum('bes_etp');
  const wLast = R.weeks[win[win.length - 1]];
  $('k1').innerHTML =
    kpi('SLA / QE — ' + perLbl, pc1(qeP), 'capa actes / prévision finale · cible ' + pc1(avg('cible')), qeP != null ? Math.min(100, qeP * 100) : 0) +
    kpi('Prévision finale', fmt(Math.round(sum('pfin'))), 'actes · ' + labels[0] + ' → ' + labels[labels.length - 1]) +
    kpi('Capacité actes', fmt(Math.round(sum('capa_a'))), 'couverture ' + pctS(sum('capa_a'), sum('pfin'))) +
    kpi('Heures de log', fmt(Math.round(sum('capa_hlog'))) + ' h',
        'besoin ' + fmt(Math.round(sum('bes_hlog'))) + ' h · capa prod ' + fmt(Math.round(sum('capa_hprod'))) + ' h') +
    kpi('Écart ETP', fmt1(dE), 'capacité − besoin' + (dE >= 0 ? ' · surplus' : ' · tension')) +
    kpi('Effectif productif', F.eff_prod[wLast ? win[win.length - 1] : 0] == null ? '—' : fmt1(F.eff_prod[win[win.length - 1]]) + ' ETP',
        'dernière semaine affichée (' + (wLast ? wLast.k : '—') + ')') +
    kpi('Absentéisme', pc1(avg('abs')), 'hypothèse du modèle RM (moyenne)') +
    kpi("Taux d'occupation", pc1(avg('occ')), 'hypothèse pondérée (moyenne)', avg('occ') != null ? avg('occ') * 100 : 0);

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

  $('w1Src').textContent = 'Modèle RM : ' + (D.meta.rm2 || (R.meta && R.meta.file) || 'RM') +
    ' · ' + win.length + '/' + W + ' sem. (' + (R.weeks[win[0]] || {}).k + ' → ' + (R.weeks[win[win.length - 1]] || {}).k + ') · ' + perLbl;
}

/* ---------- vue journalière (poids de la prévision Webhelp) ---------- */
function r1Jour() {
  const R = D.rm2;
  const CJ = ['c1ja', 'c1jb', 'c1jc', 'c1jd', 'c1je', 'c1jf', 'c1jg', 'c1jh'];
  const blank = msg => {
    $('k1j').innerHTML = '<div class="kpi"><div class="lbl">' + msg + '</div></div>';
    CJ.forEach(c => mkChart(c, { type: 'bar', data: { labels: [], datasets: [] } }));
    $('t1j').innerHTML = ''; $('t1jPer').textContent = '—';
    $('w1JSrc').textContent = 'Vue journalière : indisponible';
  };
  if (!R || !R.weeks || !R.weeks.length) { blank('Aucun modèle RM — importez le modèle RM (onglet AUCHAN)'); return; }
  const days = r1jDays('J');
  if (!days.length) { blank('Aucun jour sur la période — élargissez Année / Mois / Semaine / Personnalisé'); return; }
  const acts = rmActsSel();
  const perLbl = gfLbl();
  if (!acts.length) { blank('Aucune activité dans ce périmètre — ajustez les filtres Flux / Channel / Activités'); return; }
  /* matrices journalières : capa hebdo du modèle RM répartie au prorata des poids de la prévision */
  const secs = ['capa_a', 'pfin', 'capa_hlog', 'bes_hlog', 'capa_hprod', 'bes_hprod', 'bes_etp', 'eff', 'eff_prod'];
  const MD = {}; secs.forEach(s => MD[s] = rmDaily(s));
  const volOf = sec => { const M = MD[sec], out = days.map(() => 0); let any = false;
    acts.forEach(k => { const a = M.by[k]; if (!a) return;
      days.forEach((d, i) => { const v = a[M.dates.indexOf(d)]; if (v != null) { out[i] += v; any = true; } }); });
    return { v: out.map(x => Math.round(x * 10) / 10), any }; };
  const rateOf = sec => { const A = rmAggM(sec, acts);
    return days.map(d => { const i = rmWeekOfDay(d); return i >= 0 && A && A[i] != null ? A[i] : null; }); };
  const CA = volOf('capa_a'), PF = volOf('pfin'), CHL = volOf('capa_hlog'), BHL = volOf('bes_hlog'),
        CHP = volOf('capa_hprod'), BHP = volOf('bes_hprod'), BE = volOf('bes_etp'), EP = volOf('eff_prod');
  /* prévision Webhelp du jour = prévu du MOIS × poids journalier (logique « Calcul prévision ») */
  const PFW = { v: days.map(() => 0), any: false };
  days.forEach((d, i) => acts.forEach(k => {
    const pk = prevKeyOfAct(k); if (!pk) return;
    const v = whPrevDay(pk[1], pk[0], d);
    if (v != null) { PFW.v[i] += v; PFW.any = true; }
  }));
  const QE = days.map((d, i) => PFW.any && PFW.v[i] > 0 ? CA.v[i] / PFW.v[i] : (PF.v[i] > 0 ? CA.v[i] / PF.v[i] : null));
  const DMT = rateOf('dmt'), OCC = rateOf('occ'), ABS = rateOf('abs'), CG = rateOf('conges'), CIB = rateOf('cible');
  const tCA = CA.v.reduce((a, b) => a + b, 0), tPF = PF.v.reduce((a, b) => a + b, 0);
  const tPFW = PFW.v.reduce((a, b) => a + b, 0);
  const tCH = CHL.v.reduce((a, b) => a + b, 0), tBH = BHL.v.reduce((a, b) => a + b, 0);
  const dE = EP.v.reduce((a, b) => a + b, 0) - BE.v.reduce((a, b) => a + b, 0);
  const avgN = a => { const vs = a.filter(v => v != null); return vs.length ? vs.reduce((x, y) => x + y, 0) / vs.length : null; };
  const pc1 = v => v == null ? '—' : (Math.round(v * 1000) / 10) + ' %';
  const iMax = CA.v.indexOf(Math.max(...CA.v));
  $('k1j').innerHTML =
    kpi('Capa roadmap (actes)', fmt(Math.round(tCA)), days.length + ' j · ' + gfLbl()) +
    kpi('Prévision Webhelp', PFW.any ? fmt(Math.round(tPFW)) : '—',
        PFW.any ? 'prévu du mois × poids journalier · couverture ' + pctS(tCA, tPFW) : 'prévision Webhelp absente') +
    kpi('Prévision finale (RM)', fmt(Math.round(tPF)), 'couverture ' + pctS(tCA, tPF)) +
    kpi('SLA / QE', pc1(PFW.any && tPFW > 0 ? tCA / tPFW : (tPF > 0 ? tCA / tPF : null)),
        'capa actes ÷ ' + (PFW.any ? 'prévision Webhelp (mois × poids daily)' : 'prévision finale RM'),
        PFW.any && tPFW > 0 ? Math.min(100, tCA / tPFW * 100) : (tPF > 0 ? Math.min(100, tCA / tPF * 100) : 0)) +
    kpi('Capa heures de log', fmt(Math.round(tCH)) + ' h', 'besoin ' + fmt(Math.round(tBH)) + ' h') +
    kpi('Écart ETP', fmt1(dE), dE >= 0 ? 'sur-capacité' : 'sous-capacité') +
    (tCA ? kpi('Jour le plus chargé', fmt(Math.round(CA.v[iMax])), dShort(days[iMax]) + ' · ' + jJours(days[iMax])) : '') +
    kpi('Absentéisme (moy.)', pc1(avgN(ABS)), 'hypothèse du modèle RM') +
    kpi("Taux d'occupation (moy.)", pc1(avgN(OCC)), 'hypothèse pondérée', OCC.some(v => v != null) ? Math.min(100, avgN(OCC) * 100) : 0);

  const xJ = { grid: { display: false }, ticks: { maxTicksLimit: 16 } };
  const labJ = days.map(dShort);
  const optJ = (yOpts, tip) => ({ maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' },
      tooltip: { callbacks: { title: c => dLab(days[c[0].dataIndex]) + ' (' + jJours(days[c[0].dataIndex]) + ')',
        label: tip || (c => ' ' + c.dataset.label + ' : ' + fmt(c.parsed.y ?? c.parsed)) } } },
    scales: { x: xJ, y: yOpts } });
  const yV = lab => ({ beginAtZero: true, grid: GRID, ticks: { callback: v => fmt(v) },
    title: { display: true, text: lab, font: { size: 10.5 } } });
  const yP = { beginAtZero: true, grid: GRID, ticks: { callback: v => v + ' %' } };

  mkChart('c1ja', { type: 'bar', data: { labels: labJ, datasets: [
      { label: 'Capa roadmap (actes)', data: CA.v, backgroundColor: '#3b5bdb', borderRadius: 3 },
      { label: 'Prévision Webhelp (mois × poids daily)', data: PFW.v.map(v => Math.round(v)), type: 'line', borderColor: '#1b2440', borderWidth: 2, pointRadius: 0, tension: .3 },
      { label: 'Prévision finale (RM)', data: PF.v, type: 'line', borderColor: '#f59f00', borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, tension: .3 }] },
    options: optJ(yV('actes / jour')) });
  mkChart('c1jb', { type: 'bar', data: { labels: labJ, datasets: [
      { label: 'Capa h log', data: CHL.v, backgroundColor: '#3b5bdb', borderRadius: 3 },
      { label: 'Besoin h log', data: BHL.v, backgroundColor: '#e8590c', borderRadius: 3 },
      { label: 'Capa h prod', data: CHP.v, type: 'line', borderColor: '#1098ad', borderWidth: 1.5, pointRadius: 0, tension: .3 }] },
    options: optJ(yV('heures / jour'), c => ' ' + c.dataset.label + ' : ' + fmt(c.parsed.y ?? 0) + ' h') });
  mkChart('c1jc', { type: 'line', data: { labels: labJ, datasets: [
      { label: 'QE', data: QE.map(v => v == null ? null : Math.round(v * 1000) / 10), borderColor: '#3b5bdb', borderWidth: 2.5, pointRadius: 2, tension: .3, spanGaps: true },
      { label: 'Cible', data: CIB.map(v => v == null ? null : Math.round(v * 1000) / 10), borderColor: '#1b2440', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, spanGaps: true },
      { label: 'Seuil 95 %', data: labJ.map(() => 95), borderColor: '#2f9e44', borderWidth: 1, borderDash: [3, 5], pointRadius: 0 },
      { label: 'Seuil 90 %', data: labJ.map(() => 90), borderColor: '#e03131', borderWidth: 1, borderDash: [3, 5], pointRadius: 0 }] },
    options: optJ({ beginAtZero: false, grid: GRID, ticks: { callback: v => v + ' %' } },
      c => ' ' + c.dataset.label + ' : ' + (c.parsed.y == null ? '—' : c.parsed.y + ' %')) });
  mkChart('c1jd', { type: 'bar', data: { labels: labJ, datasets: [
      { label: 'Besoin ETP', data: BE.v, backgroundColor: '#e8590c', borderRadius: 3 },
      { label: 'Effectif productif', data: EP.v, backgroundColor: '#7048e8', borderRadius: 3 }] },
    options: optJ(yV('ETP'), c => ' ' + c.dataset.label + ' : ' + fmt1(c.parsed.y ?? 0)) });
  mkChart('c1je', { type: 'line', data: { labels: labJ, datasets: [
      { label: 'DMT', data: DMT.map(v => v == null ? null : Math.round(v)), borderColor: '#1b2440', borderWidth: 2.5, pointRadius: 2, tension: .3, spanGaps: true }] },
    options: optJ({ beginAtZero: true, grid: GRID, ticks: { precision: 0 }, title: { display: true, text: 'secondes', font: { size: 10.5 } } },
      c => ' ' + c.dataset.label + ' : ' + (c.parsed.y == null ? '—' : Math.round(c.parsed.y) + ' s')) });
  mkChart('c1jf', { type: 'line', data: { labels: labJ, datasets: [
      { label: "Taux d'occupation", data: OCC.map(v => v == null ? null : Math.round(v * 1000) / 10), borderColor: '#7048e8', borderWidth: 2.5, pointRadius: 2, tension: .3, spanGaps: true }] },
    options: optJ(yP, c => ' ' + c.dataset.label + ' : ' + (c.parsed.y == null ? '—' : c.parsed.y + ' %')) });
  mkChart('c1jg', { type: 'bar', data: { labels: labJ, datasets: [
      { label: 'Absentéisme', data: ABS.map(v => v == null ? null : Math.round(v * 1000) / 10), backgroundColor: '#e8590c', borderRadius: 3 }] },
    options: optJ(yP, c => ' ' + c.dataset.label + ' : ' + (c.parsed.y == null ? '—' : c.parsed.y + ' %')) });
  mkChart('c1jh', { type: 'bar', data: { labels: labJ, datasets: [
      { label: 'Congés (taux)', data: CG.map(v => v == null ? null : Math.round(v * 1000) / 10), backgroundColor: '#1098ad', borderRadius: 3 }] },
    options: optJ(yP, c => ' ' + c.dataset.label + ' : ' + (c.parsed.y == null ? '—' : c.parsed.y + ' %')) });

  const fmtC = { vol: v => v == null ? '—' : fmt(Math.round(v)), e: v => v == null ? '—' : fmt1(v),
    pc: v => v == null ? '—' : (Math.round(v * 1000) / 10) + ' %', s: v => v == null ? '—' : Math.round(v) + ' s' };
  const cols = [['Prévu Webhelp', PFW.v, fmtC.vol], ['Prévu final (RM)', PF.v, fmtC.vol], ['Capa actes', CA.v, fmtC.vol], ['QE', QE, fmtC.pc], ['Cible', CIB, fmtC.pc],
    ['Capa h log', CHL.v, fmtC.vol], ['Besoin h log', BHL.v, fmtC.vol], ['Capa h prod', CHP.v, fmtC.vol], ['Besoin h prod', BHP.v, fmtC.vol],
    ['Besoin ETP', BE.v, fmtC.e], ['Eff. productif', EP.v, fmtC.e], ['DMT', DMT, fmtC.s], ['Occup.', OCC, fmtC.pc],
    ['Abs.', ABS, fmtC.pc], ['Congés', CG, fmtC.pc]];
  let h = '<thead><tr><th>Date</th><th>Jour</th>' + cols.map(c => `<th>${c[0]}</th>`).join('') + '</tr></thead><tbody>';
  days.forEach((d, i) => {
    h += `<tr><td>${dLab(d)}</td><td>${jJours(d)}</td>` +
      cols.map(([, a, f]) => `<td>${f(a[i])}</td>`).join('') + '</tr>';
  });
  h += `</tbody><tfoot><tr><td colspan="2">${perLbl} · ${days.length} j</td>`;
  cols.forEach(([, a, f], ci) => {
    const vs = a.filter(v => v != null);
    if (!vs.length) { h += '<td>—</td>'; return; }
    if (['Prévu Webhelp', 'Prévu final (RM)', 'Capa actes', 'Capa h log', 'Besoin h log', 'Capa h prod', 'Besoin h prod'].includes(cols[ci][0]))
      h += '<td>' + fmt(Math.round(vs.reduce((x, y) => x + y, 0))) + '</td>';
    else if (['Besoin ETP', 'Eff. productif'].includes(cols[ci][0]))
      h += '<td>' + fmt1(vs.reduce((x, y) => x + y, 0)) + '</td>';
    else if (cols[ci][0] === 'DMT') h += '<td>' + Math.round(vs.reduce((x, y) => x + y, 0) / vs.length) + ' s</td>';
    else h += '<td>' + fmtC.pc(vs.reduce((x, y) => x + y, 0) / vs.length) + '</td>';
  });
  h += '</tr></tfoot>';
  $('t1j').innerHTML = h;
  $('t1jPer').textContent = perLbl;
  $('w1JSrc').textContent = 'Modèle RM : ' + (D.meta.rm2 || (R.meta && R.meta.file) || 'RM') +
    ' · ' + days.length + ' jours (' + dShort(days[0]) + ' → ' + dShort(days[days.length - 1]) + ') · ' + perLbl +
    (prevHas() ? ' · poids : Prévision Webhelp' : ' · poids de prévision absents : répartition uniforme');
}

/* ---------- vue par créneaux 30 min (poids créneaux de la prévision) ---------- */
const SLOTS_DEF = (() => { const a = []; for (let t = 450; t <= 1350; t += 30) a.push(t); return a; })();
function slotWOf(act, prof, mk) {                    // poids des créneaux d'une activité (repli profil hyper du mois)
  const cre = (D.prev && D.prev.creneaux) || {};
  const m = mk && cre[mk];
  const pk = prevKeyOfAct(act);
  const f = pk && m && m[pk[1]];
  return (f && (f[prof] || f.ls)) || (m && m.hyper && (m.hyper[prof] || m.hyper.ls)) || null;
}
function r1Cre() {
  const R = D.rm2;
  const CC = ['c1ca', 'c1cb'];
  const blank = msg => {
    $('k1c').innerHTML = '<div class="kpi"><div class="lbl">' + msg + '</div></div>';
    CC.forEach(c => mkChart(c, { type: 'bar', data: { labels: [], datasets: [] } }));
    $('t1c').innerHTML = ''; $('t1cPer').textContent = '—';
    $('w1CSrc').textContent = 'Vue par créneaux : indisponible';
  };
  if (!R || !R.weeks || !R.weeks.length) { blank('Aucun modèle RM — importez le modèle RM (onglet AUCHAN)'); return; }
  const days = r1jDays('C');
  if (!days.length) { blank('Aucun jour sur la période — élargissez Année / Mois / Semaine / Personnalisé'); return; }
  const acts = rmActsSel();
  const perLbl = gfLbl();
  if (!acts.length) { blank('Aucune activité dans ce périmètre — ajustez les filtres Flux / Channel / Activités'); return; }
  const mode = $('w1CV').value;
  const dSel = $('w1CD').value;
  const daysUse = mode === 'jour' ? (dSel && days.includes(dSel) ? [dSel] : []) : days;
  if (!daysUse.length) { blank('Choisissez un jour couvert par la période sélectionnée (ou passez en « Moyenne période »)'); return; }
  /* fuseau d'affichage — la prévision est en heure Paris, le planning en heure Madagascar :
     les créneaux prévision / capa roadmap sont affichés décalés (0 / +1 h / +2 h). */
  const TZ = +((($('w1CTZ') || {}).value) || 0);
  const tzLbl = TZ === 2 ? 'Mada +2 h' : TZ === 1 ? 'Mada +1 h' : 'heure Paris';
  const AG = (($('w1CAg') || {}).value) || '30';     // '30' : créneaux 30 min · 'h' : heures pleines
  /* univers de créneaux : poids de la prévision (repli 07:30 → 22:30) */
  const cre = (D.prev && D.prev.creneaux) || {};
  const tuni = new Set();
  Object.values(cre).forEach(fl => Object.values(fl).forEach(pr => Object.values(pr).forEach(sl =>
    Object.keys(sl).forEach(t => { const v = +t; if (isFinite(v)) tuni.add(v); }))));
  const slotList = (tuni.size ? [...tuni].sort((a, b) => a - b) : SLOTS_DEF.slice());
  const nS = slotList.length;
  const profOf = d => jJours(d) === 'dimanche' ? 'dim' : 'ls';
  /* ventilation selon la logique « Calcul prévision » :
     prévision du jour = prévu du MOIS × poids journalier (whPrevDay) ;
     prévision du créneau = prévision du jour × poids intraday du créneau (Σ poids = 1) ;
     les codes du fichier désignent la FIN du créneau (800 = [07:30 → 08:00) Paris) ;
     heure pleine = somme des 2 créneaux consécutifs. Repli : prévision finale RM
     quand le mois / flux n'a pas de prévision Webhelp. */
  const MCA = rmDaily('capa_a'), MCH = rmDaily('capa_hlog'), MPF = rmDaily('pfin'), MBH = rmDaily('bes_hlog');
  const accA = {}, accH = {}, accP = Array(nS).fill(0), accBH = Array(nS).fill(0);
  let etpRatioSum = 0, etpRatioN = 0, repliN = 0;
  daysUse.forEach(d => {
    const di = MCA.dates.indexOf(d); if (di < 0) return;
    const wi = rmWeekOfDay(d);
    const prof = profOf(d);
    acts.forEach(k => {
      const ca = (MCA.by[k] || [])[di]; if (ca == null) return;
      const w = slotWOf(k, prof, mKey(d));
      const chl = (MCH.by[k] || [])[di];
      const cbh = (MBH.by[k] || [])[di];
      const pk = prevKeyOfAct(k);
      const pvW = pk ? whPrevDay(pk[1], pk[0], d) : null;       // prévision Webhelp du jour (mois × poids daily)
      const cpf = pvW == null ? (MPF.by[k] || [])[di] : null;   // repli : prévision finale RM du jour
      if (pvW == null && cpf != null) repliN++;
      const wa = accA[k] = accA[k] || Array(nS).fill(0);
      const wh = accH[k] = accH[k] || Array(nS).fill(0);
      slotList.forEach((t, si) => {
        const wt = w ? (w[t] || 0) : 1 / nS;
        wa[si] += ca * wt;
        if (chl != null) wh[si] += chl * wt;
        const pv = pvW != null ? pvW : cpf;
        if (pv != null) accP[si] += pv * wt;
        if (cbh != null) accBH[si] += cbh * wt;
      });
    });
    const EPW = rmAggM('eff_prod', acts), CHW = rmAggM('capa_hlog', acts);
    if (wi >= 0 && EPW[wi] != null && CHW[wi] > 0) { etpRatioSum += EPW[wi] / CHW[wi]; etpRatioN++; }
  });
  const nD = daysUse.length;
  const divD = a => a.map(v => Math.round(v / nD * 100) / 100);
  const A = {}; Object.keys(accA).forEach(k => A[k] = divD(accA[k]));
  const H = divD(Object.keys(accH).reduce((s, k) => s.map((v, i) => v + accH[k][i]), Array(nS).fill(0)));
  const P = divD(accP), BH = divD(accBH);
  const etpRatio = etpRatioN ? etpRatioSum / etpRatioN : null;
  const ETP = etpRatio ? H.map(v => Math.round(v * etpRatio * 100) / 100) : null;
  const totA = A && Object.keys(A).length ? Object.values(A).reduce((s, a) => s.map((v, i) => v + a[i]), Array(nS).fill(0)) : Array(nS).fill(0);
  /* lignes d'affichage : créneaux 30 min ou heures pleines (2 créneaux consécutifs) ;
     affichage par intervalle, décalé au fuseau choisi */
  const toMin = c => Math.floor(c / 100) * 60 + c % 100;
  const labMin = m => { const x = ((m % 1440) + 1440) % 1440; return slotLab(Math.floor(x / 60) * 100 + x % 60); };
  const labBeg = c => labMin(toMin(c) - 30 + TZ * 60);             // début du créneau (fuseau)
  const labEnd = c => labMin(toMin(c) + TZ * 60);                  // fin du créneau (fuseau)
  const slotSucc = t => (t % 100) === 30 ? t + 70 : t + 30;        // code 30 min plus tard
  const rows = [];
  if (AG === 'h') {
    for (let i = 0; i < slotList.length; i++) {
      const t = slotList[i], t2 = slotSucc(t);
      if (i + 1 < slotList.length && slotList[i + 1] === t2) {
        rows.push({ idxs: [i, i + 1], lab: labBeg(t) + ' → ' + labEnd(t2) }); i++;
      } else rows.push({ idxs: [i], lab: labBeg(t) + ' → ' + labEnd(t) });
    }
  } else slotList.forEach((t, i) => rows.push({ idxs: [i], lab: labBeg(t) + ' → ' + labEnd(t) }));
  const aggR = a => rows.map(r => r.idxs.reduce((s, si) => s + a[si], 0));
  const totR = aggR(totA), PR = aggR(P), HR = aggR(H), BHR = aggR(BH);
  const ETPR = ETP ? aggR(ETP) : null;
  const AR = {}; Object.keys(A).forEach(k => AR[k] = aggR(A[k]));
  const iMaxR = totR.indexOf(Math.max(...totR));
  const sumTot = totR.reduce((a, b) => a + b, 0), sumP = PR.reduce((a, b) => a + b, 0), sumH = HR.reduce((a, b) => a + b, 0);
  const lblC = mode === 'jour' ? dShort(daysUse[0]) + ' (' + jJours(daysUse[0]) + ')' : 'moyenne ' + nD + ' jours';
  const aggLbl = AG === 'h' ? 'heure' : 'créneau';
  $('k1c').innerHTML =
    kpi('Capa actes (' + (mode === 'jour' ? 'jour' : 'moy. / jour') + ')', fmt(Math.round(sumTot)), lblC + ' · ' + gfLbl()) +
    (sumTot ? kpi('Pointe actes', fmt(Math.round(totR[iMaxR])), rows[iMaxR].lab + ' · ' + lblC) : '') +
    kpi('Capa heures de log', fmt(Math.round(sumH)) + ' h', (mode === 'jour' ? 'jour' : 'moy. / jour') + ' · Σ créneaux') +
    kpi('Prévision Webhelp', fmt(Math.round(sumP)), 'mois × poids daily × poids ' + aggLbl +
        (repliN ? ' · repli prévision finale RM' : '') + ' · couverture ' + pctS(sumTot, sumP)) +
    kpi('ETP à la pointe', ETPR ? fmt1(ETPR[iMaxR]) : '—', 'effectif productif ÷ capa h log') +
    kpi('QE', pc1v(sumP > 0 ? sumTot / sumP : null), 'capa / prévision Webhelp', sumP > 0 ? Math.min(100, sumTot / sumP * 100) : 0);
  function pc1v(v) { return v == null ? '—' : (Math.round(v * 1000) / 10) + ' %'; }
  const lbls = rows.map(r => r.lab);
  const actKeys = Object.keys(AR);
  mkChart('c1ca', { type: 'bar', data: { labels: lbls, datasets: [
      ...actKeys.map((k, i) => ({ label: k, data: AR[k], backgroundColor: PAL[i % PAL.length], stack: 's', borderRadius: 2 })),
      { label: 'Prévision Webhelp (actes)', data: PR.map(v => Math.round(v)), type: 'line', borderColor: '#1b2440',
        borderWidth: 2, pointRadius: 0, tension: .3 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt1(c.parsed.y ?? 0) } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
                y: { stacked: true, beginAtZero: true, ...axisY('actes / ' + aggLbl) } } } });
  mkChart('c1cb', { type: 'bar', data: { labels: lbls, datasets: [
      { label: 'Capa heures de log', data: HR.map(v => Math.round(v * 10) / 10), backgroundColor: '#3b5bdb', borderRadius: 2 },
      { label: 'Besoin (h)', data: BHR.map(v => Math.round(v * 10) / 10), backgroundColor: 'rgba(232,89,12,.55)', borderRadius: 2 },
      ...(ETPR ? [{ label: 'ETP productif', data: ETPR, type: 'line', borderColor: '#7048e8', borderWidth: 2, pointRadius: 0, tension: .3, yAxisID: 'y2' }] : [])] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt1(c.parsed.y ?? 0) } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
                y: { stacked: true, beginAtZero: true, ...axisY('heures / ' + aggLbl) },
                y2: { beginAtZero: true, position: 'right', grid: { display: false }, title: { display: true, text: 'ETP', font: { size: 10.5 } } } } } });
  let h = '<thead><tr><th>' + (AG === 'h' ? 'Heure' : 'Créneau') + ' (' + tzLbl + ')</th><th>Capa actes</th><th>Prévu (actes)</th><th>QE</th><th>Capa h log</th><th>Besoin (h)</th><th>ETP productif</th></tr></thead><tbody>';
  rows.forEach((r, i) => {
    const q = PR[i] > 0 ? totR[i] / PR[i] : null;
    h += `<tr><td>${r.lab}</td><td>${fmt1(totR[i])}</td><td>${fmt1(PR[i])}</td>` +
         `<td>${q == null ? '—' : (Math.round(q * 1000) / 10) + ' %'}</td>` +
         `<td>${fmt1(HR[i])}</td><td>${fmt1(BHR[i])}</td><td>${ETPR ? fmt1(ETPR[i]) : '—'}</td></tr>`;
  });
  h += `</tbody><tfoot><tr><td>Σ — ${lblC}</td><td>${fmt1(sumTot)}</td><td>${fmt1(sumP)}</td>` +
       `<td>${sumP > 0 ? (Math.round(sumTot / sumP * 1000) / 10) + ' %' : '—'}</td>` +
       `<td>${fmt1(sumH)}</td><td>${fmt1(BHR.reduce((a, b) => a + b, 0))}</td>` +
       `<td>${ETPR ? fmt1(Math.max(...ETPR)) + ' (max)' : '—'}</td></tr></tfoot>`;
  $('t1c').innerHTML = h;
  $('t1cPer').textContent = lblC + ' · ' + gfLbl();
  $('w1CSrc').textContent = 'Modèle RM : ' + (D.meta.rm2 || (R.meta && R.meta.file) || 'RM') + ' · ' + lblC +
    ' · ' + (AG === 'h' ? rows.length + ' heures pleines (2 créneaux)' : rows.length + ' créneaux 30 min') +
    ' · vision ' + tzLbl + (prevHas() && Object.keys(cre).length ? ' · poids créneaux : Prévision Webhelp' : ' · poids créneaux absents : répartition uniforme');
}

const kpi = (lbl, val, sub, bar) =>
  `<div class="kpi"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub || ''}</div>` +
  (bar != null ? `<div class="bar"><i style="width:${Math.min(100, bar)}%"></i></div>` : '') + '</div>';

/* =====================================================================
   RÉPARTITION JOURNALIÈRE DE LA CAPA HEBDO DU MODÈLE RM
   (poids journaliers de la prévision — helpers partagés par les sous-onglets
   Roadmap journalière / créneaux et l'Analyse capa)
   ===================================================================== */
function aggBy(dates, g) {                          // -> clés de période + index de regroupement
  const keys = [], idx = [];
  const kOf = d => g === 'jour' ? d : g === 'semaine' ? wLabY(d) : mKey(d);
  dates.forEach(d => { const k = kOf(d); const i = keys.indexOf(k); if (i < 0) { keys.push(k); idx.push(keys.length - 1); } else idx.push(i); });
  return { keys, idx };
}
/* ---------- Capacitaire : capa hebdo du modèle RM répartie par jour ----------
   Le modèle RM fournit la capa en actes / heures de log / heures de prod par semaine × activité.
   Répartition journalière : poids de la prévision Webhelp (normalisés sur les jours de CHAQUE semaine,
   donc Σ = 1 par semaine), repli sur le profil « hyper » du même canal, sinon répartition uniforme. */
function isoMonday(y, w) {                          // lundi de la semaine ISO (y, w)
  const f = new Date(Date.UTC(y, 0, 4));            // le 4 janv. est toujours en semaine 1
  const dn = (f.getUTCDay() + 6) % 7;
  const m = new Date(f); m.setUTCDate(m.getUTCDate() - dn + (w - 1) * 7);
  return m.toISOString().slice(0, 10);
}
function rmWeekDays(w) {                            // jours couverts par une semaine du modèle RM
  const s = /^\d{4}-\d{2}-\d{2}$/.test(w.start || '') ? w.start : isoMonday(w.y || +String(w.k || '').slice(-4), w.n);
  const n = Math.max(1, Math.min(7, w.days || 7));
  const out = []; for (let i = 0; i < n; i++) out.push(addDays(s, i));
  return out;
}
function rmDays() {                                 // union triée des jours couverts par le modèle RM
  if (!D.rm2 || !D.rm2.weeks || !D.rm2.weeks.length) return [];
  const out = new Set();
  D.rm2.weeks.forEach(w => rmWeekDays(w).forEach(d => out.add(d)));
  return [...out].sort();
}
function prevKeyOfAct(act) {                        // (canal 'a'|'m', clé du poids prévision) ou null
  const s = norm(act);
  if (s.includes('mail')) {
    for (const f of ['hyper', 'afr', 'drive', 'direct']) if (s.includes(f)) return ['m', f];
    return null;
  }
  if (s.includes('chat') || s.includes('borne') || s.includes('lsa')) return null;
  for (const f of ['hyper', 'c2e', 'afr', 'drive', 'sav', 'direct']) if (s.includes(f)) return ['a', f];
  return null;
}
function rmWeekRawW(d, pk) {                        // poids brut du jour (repli profil hyper du canal)
  const w = D.prev && D.prev.poidsJour ? D.prev.poidsJour[d] : null;
  if (!w || !pk) return 0;
  const x = (w[pk[0]] || {})[pk[1]];
  if (x > 0) return x;
  return (w[pk[0]] || {}).hyper > 0 ? w[pk[0]].hyper : 0;
}
function rmDaily(sec) {                             // matrice journalière d'une section hebdo du RM
  const out = { dates: rmDays(), by: {}, any: false };
  const S = D.rm2 && D.rm2.s ? D.rm2.s[sec] : null;
  if (!S) return out;
  const iOf = {}; out.dates.forEach((d, i) => iOf[d] = i);
  D.rm2.weeks.forEach((w, wi) => {
    const ds = rmWeekDays(w).filter(d => iOf[d] != null);
    if (!ds.length) return;
    Object.keys(S.a).forEach(k => {
      const v = (S.a[k] || [])[wi];
      if (v == null) return;
      if (!out.by[k]) out.by[k] = Array(out.dates.length).fill(null);
      const pk = prevKeyOfAct(k);
      const raw = ds.map(d => rmWeekRawW(d, pk));
      const sW = raw.reduce((x, y) => x + y, 0);
      ds.forEach((d, j) => {
        const wj = sW > 0 ? raw[j] / sW : 1 / ds.length;
        out.by[k][iOf[d]] = v * wj;
        out.any = true;
      });
    });
  });
  return out;
}
function rmDailySum(M, acts) {                      // somme journalière sur un périmètre d'activités
  const n = M.dates.length, out = Array(n).fill(0);
  (acts || Object.keys(M.by)).forEach(k => { const a = M.by[k]; if (!a) return;
    for (let i = 0; i < n; i++) if (a[i] != null) out[i] += a[i]; });
  return out;
}
function renderProdEd() {                           // hypothèses de productivité (actes / heure) par activité × canal
  const el = $('prodEd'); if (!el) return;
  const items = new Map();                          // clé norm(rmProdKey)|norm(chan) -> {a, c} (dédoublonné : Direct ≡ Direct (LAD), Hyper·MAIL ≡ Mail Hyper·MAIL)
  const add = (a, c) => { if (!a) return; const rk = norm(rmProdKey(a, c)) + '|' + norm(c);
    if (!items.has(rk)) items.set(rk, { a: String(a).trim(), c: String(c || 'PHONE').toUpperCase() }); };
  (D.plan && D.plan.acts || []).forEach(k => {      // combinaisons réellement planifiées (Skills)
    const i = k.indexOf('|'); if (i > 0) add(k.slice(0, i), k.slice(i + 1));
  });
  if (D.rm2 && D.rm2.acts) D.rm2.acts.forEach(x => { // activités du modèle RM
    const s = norm(x.k);
    add(x.k, s.startsWith('mail') ? 'MAIL' : (s.includes('chat') || s.includes('borne') || s.includes('lsa')) ? 'CHAT' : 'PHONE');
  });
  D.roadmap.forEach(r => add(r.a, chanOfAct(r.a)));
  D.planH.acts.forEach(a => add(a, 'PHONE'));
  el.innerHTML = items.size ? [...items.entries()].map(([rk, it]) => {
    const rm = rmHypOf(it.a, it.c);                 // hypothèse du modèle RM (moyenne hebdo)
    const v = manProdOf(it.a, it.c) ?? '';
    const src = v !== '' ? '<span class="psrc man">manuel — prioritaire</span>'
      : rm != null ? '<span class="psrc">modèle RM : ' + fmt1(rm) + ' actes/h</span>'
      : '<span class="psrc none">à renseigner</span>';
    return `<div class="pitem"><label>${it.a} · ${it.c}</label>` +
      `<input type="number" min="0" step="0.5" data-k="${rk}" value="${v}" placeholder="${rm != null ? 'RM : ' + fmt1(rm) : 'actes/h'}">` + src + '</div>';
  }).join('')
    : '<span class="hint">Aucune activité connue — importez le modèle RM ou le Planning heures.</span>';
  el.querySelectorAll('input').forEach(inp => inp.addEventListener('change', () => {
    const v = n2(inp.value);
    if (v > 0) D.prod.def[inp.dataset.k] = v; else delete D.prod.def[inp.dataset.k];
    D.prod.file = 'hypothèses manuelles';
    save(); renderProdEd(); r3();
  }));
}
/* =====================================================================
   P3 — ANALYSE CAPA (capa roadmap vs planif)
   Capa roadmap : modèle RM (capa en actes / heures de log) répartie par jour
                  selon les poids de la prévision — cf. rmDaily (onglet Roadmap).
   Capa planif  : Données DASHBOARD CAPA (feuille Planning + Skills) — capa en
                  heures de contrat = effectif planifié hors FIM × heure contrat
                  (8 h/jour · 40 h/semaine, 7 h si allaitement) × (1 − absentéisme
                  RM) → actes planifiés = capa heures × productivité (modèle RM,
                  repli : hypothèses saisies).
   Les jours sans données de planification sont exclus de l'analyse
   (pas de faux écarts sur l'affichage).
   ===================================================================== */
function r3() {
  const PL = D.plan, RM = D.rm2;
  const hasPlanA = !!(PL && PL.dates && PL.dates.length);
  if (!hasPlanA) {
    $('k3').innerHTML = '<div class="kpi"><div class="lbl">Aucune planification</div><div class="sub">Importez le fichier « Données DASHBOARD CAPA AUCHAN » (feuilles Planning + Skills) : la capa planif provient des heures planifiées hors FIM.</div></div>';
    $('t3').innerHTML = '';
    mkChart('c3a', { type: 'bar', data: { labels: [], datasets: [] } });
    mkChart('c3b', { type: 'bar', data: { labels: [], datasets: [] } });
    $('w3Src').textContent = 'Analyse capa : planification à importer';
    return;
  }
  const MCA = rmDaily('capa_a'), MCH = rmDaily('capa_hlog');
  if (!MCA.any && !MCH.any) {
    $('k3').innerHTML = '<div class="kpi"><div class="lbl">Capa absente du modèle RM</div><div class="sub">Importez le modèle RM (capa en actes / heures) — la comparaison porte sur capa roadmap vs capa planif.</div></div>';
    $('t3').innerHTML = '';
    mkChart('c3a', { type: 'bar', data: { labels: [], datasets: [] } });
    mkChart('c3b', { type: 'bar', data: { labels: [], datasets: [] } });
    return;
  }
  const g = GF.g;
  /* jours analysés = uniquement les jours couverts par la planification */
  const allDays = PL.dates.filter(d => inPer('p3', d));
  if (!allDays.length) { noPer('p3', 'k3', ['c3a', 'c3b'], 't3'); return; }
  const kOf = d => g === 'mois' ? mKey(d) : g === 'semaine' ? wLabY(d) : d;
  const keys = [], idxOf = {};
  allDays.forEach(d => { const k = kOf(d); if (!(k in idxOf)) { idxOf[k] = keys.length; keys.push(k); } });
  const z = () => Array(keys.length).fill(0);
  const pvA = z(), plA = z(), pvH = z(), plH = z(), hpB = z();
  const noAbs = new Set(), noProd = new Set(), noHrs = new Set(), manA = new Set();
  /* absentéisme & productivité du modèle RM (par semaine) */
  const actsRM = RM ? rmActsSel() : [];
  const absA = RM ? rmAggM('abs', actsRM) : null;
  const absOf = d => { const i = rmWeekOfDay(d);
    return i >= 0 && absA && absA[i] != null ? Math.min(.5, Math.max(0, absA[i])) : null; };
  const prodRMof = (act, wi) => {
    const S = RM && RM.s.prod_h, x = S && S.a[act] ? S.a[act][wi] : null;
    return x != null ? x : prodOf(act);
  };
  /* capa roadmap — même périmètre de jours que la planification (comparaison fidèle) */
  Object.keys(MCA.by).filter(k => gfPass(k)).forEach(k => {
    allDays.forEach(d => {
      const di = MCA.dates.indexOf(d); if (di < 0) return;
      const ca = MCA.by[k][di];
      if (ca == null) return;
      const k2 = idxOf[kOf(d)];
      pvA[k2] += ca;
      const hv = MCH.by[k] ? MCH.by[k][di] : null;
      if (hv != null) pvH[k2] += hv;
      else {
        const pr = prodRMof(k, rmWeekOfDay(d));
        if (pr) { pvH[k2] += ca / pr; noHrs.add(k); }
        else if (ca) noHrs.add(k);
      }
    });
  });
  /* capa planif — répartition skills par activité × canal */
  const combos = (PL.acts || []).filter(k => {
    const i = k.indexOf('|'); return gfPass(k.slice(0, i), k.slice(i + 1)); });
  allDays.forEach(d => {
    const k2 = idxOf[kOf(d)];
    const BA = PL.byAct && PL.byAct[d];
    if (k2 == null || !BA) return;
    const ab = absOf(d);
    if (ab == null) noAbs.add(d);
    const fAbs = ab != null ? 1 - ab : 1;
    let hpTot = 0;
    combos.forEach(k => { hpTot += BA[k] || 0; });
    hpB[k2] += hpTot;
    const hlog = hpTot * fAbs;
    plH[k2] += hlog;
    const wi = rmWeekOfDay(d);
    combos.forEach(k => {
      const h = BA[k] || 0; if (!h) return;
      const i2 = k.indexOf('|'), a = k.slice(0, i2), c = k.slice(i2 + 1);
      const pr = planProdOf(a, c, wi);                 // capa planif : productivité RM (canal précis) ou hypothèse manuelle
      if (pr == null) { noProd.add(a); return; }
      if (manProdOf(a, c) != null) manA.add(a);
      plA[k2] += h * fAbs * pr;
    });
  });
  const rd = a => a.map(v => Math.round(v));
  const TP = pvA.reduce((a, b) => a + b, 0), TL = plA.reduce((a, b) => a + b, 0);
  const TH = pvH.reduce((a, b) => a + b, 0), LH = plH.reduce((a, b) => a + b, 0);
  const HB = hpB.reduce((a, b) => a + b, 0);
  $('k3').innerHTML =
    kpi('Capa roadmap (actes)', fmt(Math.round(TP)), g + ' · ' + gfLbl() + ' · ' + allDays.length + ' j avec planif') +
    kpi('Capa planif (actes)', fmt(Math.round(TL)), 'capa heures contrat × productivité ' +
        (manA.size ? 'manuelle (' + [...manA].join(', ') + ')' : 'du modèle RM') +
        (noProd.size ? ' · manquante : ' + [...noProd].join(', ') : ''), TP ? Math.min(100, Math.abs(TL - TP) / TP * 100) : 0) +
    kpi('Écart (planif − roadmap)', fmt(Math.round(TL - TP)), TL - TP >= 0 ? 'sur-capacité' : 'sous-capacité',
        TP ? Math.min(100, Math.abs(TL - TP) / TP * 100) : 0) +
    kpi('Heures — roadmap / planif', fmt(Math.round(TH)) + ' / ' + fmt(Math.round(LH)),
        pctS(LH, TH) + ' des heures roadmap · capa contrat (hors FIM) ' + fmt(Math.round(HB)) + ' h' +
        (noAbs.size ? ' · absentéisme RM indisponible (' + noAbs.size + ' j)' : ''));
  mkChart('c3a', { type: 'bar', data: { labels: keys, datasets: [
      { label: 'Capa roadmap (actes)', data: rd(pvA), backgroundColor: '#3b5bdb', borderRadius: 3 },
      { label: 'Capa planif (actes)', data: rd(plA), backgroundColor: '#f59f00', borderRadius: 3 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt(c.parsed.y ?? 0) } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axisY('actes') } } });
  mkChart('c3b', { type: 'bar', data: { labels: keys, datasets: [
      { label: 'Capa roadmap (heures de log)', data: pvH.map(v => Math.round(v * 10) / 10), backgroundColor: '#7048e8', borderRadius: 3 },
      { label: 'Capa planif (h contrat × (1 − abs))', data: plH.map(v => Math.round(v * 10) / 10), backgroundColor: '#1098ad', borderRadius: 3 },
      { label: 'Capa contrat (hors FIM)', data: hpB.map(v => Math.round(v * 10) / 10), type: 'line', borderColor: '#868e96',
        borderWidth: 2, pointRadius: 1.5, tension: .3, borderDash: [5, 3] }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axisY('heures') } } });
  let h = '<thead><tr><th>Période</th><th>Capa roadmap (actes)</th><th>Capa planif (actes)</th><th>Écart actes</th><th>Couverture</th>' +
    '<th>Capa roadmap (h)</th><th>Capa planif (h)</th><th>Capa contrat (h)</th><th>Écart h</th></tr></thead><tbody>';
  keys.forEach((k, i) => {
    const eA = plA[i] - pvA[i], eH = plH[i] - pvH[i];
    h += `<tr><td>${k}</td><td>${fmt(pvA[i])}</td><td>${fmt(plA[i])}</td>` +
         `<td class="${eA < 0 ? 'neg' : 'pos'}">${fmt(eA)}</td><td>${pctS(plA[i], pvA[i])}</td>` +
         `<td>${fmt(pvH[i])}</td><td>${fmt(Math.round(plH[i]))}</td><td>${fmt(Math.round(hpB[i]))}</td>` +
         `<td class="${eH < 0 ? 'neg' : 'pos'}">${fmt(Math.round(eH))}</td></tr>`;
  });
  h += `</tbody><tfoot><tr><td>Total période</td><td>${fmt(Math.round(TP))}</td><td>${fmt(Math.round(TL))}</td>` +
       `<td class="${TL - TP < 0 ? 'neg' : 'pos'}">${fmt(Math.round(TL - TP))}</td><td>${pctS(TL, TP)}</td>` +
       `<td>${fmt(Math.round(TH))}</td><td>${fmt(Math.round(LH))}</td><td>${fmt(Math.round(HB))}</td>` +
       `<td class="${LH - TH < 0 ? 'neg' : 'pos'}">${fmt(Math.round(LH - TH))}</td></tr></tfoot>`;
  $('t3').innerHTML = h;
  $('w3Src').textContent = 'Capa roadmap : modèle RM (' + (D.meta.rm2 || (RM && RM.meta && RM.meta.file) || 'RM') + ') × poids de la prévision · Capa planif : ' +
    ((PL.meta && PL.meta.file) || 'planification') + ' (' + allDays.length + ' j)';
  renderProdEd();
}

/* =====================================================================
   P8 — PLANIFICATION (2 sous-onglets : journalière · créneaux 30 min)
   Capa en heures de contrat répartie par activité × canal selon la feuille
   Skills (HYPER/DRIVE 50/50 × MAIL/PHONE · ALL toutes activités et canaux ·
   SAV mono PHONE · CHAT mono CHAT) — cf. buildPlanExtras. Hors FIM.
   Contrat : 8 h/jour (40 h/semaine), 7 h si allaitement (colonne Planning).
   Présence par créneau = [Shift In, Shift Out) − pause repas.
   ===================================================================== */
function planEmpty() { return !D.plan || !D.plan.dates || !D.plan.dates.length; }
const P8V = { view: 'jour' };
function defSlotDay8() {                            // jour par défaut : le plus chargé
  const P = D.plan; if (!P || !P.dates || !P.dates.length) return;
  const cur = $('w8D').value;
  if (cur && P.dates.includes(cur)) { $('w8D').min = P.dates[0]; $('w8D').max = P.dates[P.dates.length - 1]; return; }
  let best = P.dates[0] || '', bv = -1;
  P.dates.forEach(d => { const t = (P.m.prod[d] || []).reduce((a, b) => a + b, 0); if (t > bv) { bv = t; best = d; } });
  $('w8D').value = best;
  $('w8D').min = P.dates[0]; $('w8D').max = P.dates[P.dates.length - 1];
}
function planCombos() {                             // combos activité|canal retenus par les filtres globaux
  const P = D.plan; if (!P || !P.acts) return [];
  return P.acts.filter(k => {
    const i = k.indexOf('|');
    return gfPass(k.slice(0, i), k.slice(i + 1));
  });
}
function r8() {
  const has = !planEmpty();
  $('p8vJour').style.display = has && P8V.view === 'jour' ? '' : 'none';
  $('p8vCre').style.display = has && P8V.view === 'cre' ? '' : 'none';
  $('p8empty').style.display = has ? 'none' : '';
  $('p8fJour').style.display = P8V.view === 'jour' ? '' : 'none';
  $('p8fCre').style.display = P8V.view === 'cre' ? '' : 'none';
  if (!has) {
    $('w8JSrc').textContent = 'Planification : à importer (fichier « Données DASHBOARD CAPA AUCHAN », feuilles Planning + Skills)';
    $('w8Src').textContent = '';
    return;
  }
  if (P8V.view === 'cre') r8Cre(); else r8Jour();
}

/* ---------- vue journalière ---------- */
function r8Jour() {
  const P = D.plan;
  const days = P.dates.filter(d => inPer('p8', d));
  if (!days.length) { noPer('p8', 'k8', ['c8a', 'c8b'], 't8');
    $('w8JSrc').textContent = 'Planification : aucun jour sur ' + rangeLbl(...perRange()); return; }
  const g = GF.g;
  const combos = planCombos();
  const actsU = [...new Set(combos.map(k => k.split('|')[0]))].filter(a => gfPass(a));
  /* KPIs de la période */
  const ags = new Set();
  days.forEach(d => (P.day[d].ag || []).forEach(a => ags.add(a)));
  const totPlan = days.reduce((s, d) => s + P.day[d].plan, 0);
  const totFimN = days.reduce((s, d) => s + P.day[d].fim, 0);
  const HP = days.reduce((s, d) => s + P.day[d].hp, 0);
  const FM = days.reduce((s, d) => s + P.day[d].fimh, 0);
  const RP = days.reduce((s, d) => s + P.day[d].repas, 0);
  const ctrOf = d => P.day[d].ctr != null ? P.day[d].ctr : Math.max(0, P.day[d].plan - P.day[d].fim) * 8; // repli anciennes données
  const CTR = days.reduce((s, d) => s + ctrOf(d), 0);
  const NAL = days.reduce((s, d) => s + (P.day[d].nal || 0), 0);
  /* heures de log réalisées (EXT_Agent) */
  const L = D.logR;
  const logOf = d => { if (!L || !L.dates) return null; const i = L.dates.indexOf(d); return i >= 0 ? L.h.tot[i] : null; };
  const LOG = days.map(logOf);
  const logAny = LOG.some(v => v != null && v > 0);
  const logTot = LOG.reduce((s, v) => s + (v || 0), 0);
  /* heures réparties par activité */
  const hBy = {};
  actsU.forEach(a => hBy[a] = days.map(() => 0));
  days.forEach((d, i) => {
    const BA = (P.byAct || {})[d] || {};
    combos.forEach(k => { const a = k.split('|')[0]; if (hBy[a]) hBy[a][i] += BA[k] || 0; });
  });
  const sumRep = days.map((_, i) => actsU.reduce((s, a) => s + hBy[a][i], 0));
  const iMax = CTR ? sumRep.indexOf(Math.max(...sumRep)) : 0;
  const domA = actsU.length ? actsU.reduce((b, a) => hBy[a][iMax] > hBy[b][iMax] ? a : b, actsU[0]) : '—';
  $('k8').innerHTML =
    kpi('Agents planifiés', fmt(ags.size), days.length + ' jour(s) sur la période') +
    kpi('Effectif planifié / jour', fmt1(totPlan / days.length), 'dont FIM hors prod ' + fmt1(totFimN / days.length) + ' / j' +
        (NAL ? ' · allaitement (7 h) : ' + fmt1(NAL / days.length) + ' / j' : '')) +
    kpi('Capa en heures (contrat)', fmt(Math.round(CTR)) + ' h',
        'effectif prod × 8 h/jour · 7 h si allaitement · réparties sur ' + actsU.length + ' activité(s)') +
    kpi('Heures planifiées (HP)', fmt(Math.round(HP)) + ' h', 'présence − pause repas · hors pause ' + fmt(Math.round(RP)) + ' h') +
    (logAny ? kpi('Heures de log réalisées', fmt(Math.round(logTot)) + ' h', 'EXT_Agent — Busy · Wrap Up · Hold · Chat · Panier') : '') +
    (CTR ? kpi('Activité dominante', domA, dShort(days[iMax]) + ' · ' + fmt1(hBy[domA] ? hBy[domA][iMax] : 0) + ' h') : '');
  /* graphique 1 : heures par activité (canaux fusionnés) + HP + log réalisé */
  const { keys, idx } = aggBy(days, g);
  const gN = keys.length, cnt = Array(gN).fill(0);
  days.forEach((d, j) => cnt[idx[j]]++);
  const isAvg = g !== 'jour';
  const div = a => a.map((v, i) => cnt[i] ? (isAvg ? v / cnt[i] : v) : v);
  const hByG = actsU.map(a => div(hBy[a].reduce((acc, v, j) => (acc[idx[j]] += v, acc), Array(gN).fill(0))));
  const hpG = div(days.reduce((acc, d, j) => (acc[idx[j]] += P.day[d].hp, acc), Array(gN).fill(0)));
  const ctrG = div(days.reduce((acc, d, j) => (acc[idx[j]] += ctrOf(d), acc), Array(gN).fill(0)));
  const repG = div(sumRep.reduce((acc, v, j) => (acc[idx[j]] += v, acc), Array(gN).fill(0)));
  const logG = L && L.dates ? div(days.reduce((acc, d, j) => {
    const i = L.dates.indexOf(d); if (i >= 0) acc[idx[j]] += L.h.tot[i] || 0; return acc; }, Array(gN).fill(0))) : null;
  mkChart('c8a', { type: 'bar', data: { labels: keys, datasets: [
      ...hByG.map((a, i) => ({ label: actsU[i], data: a.map(v => Math.round(v * 10) / 10),
        backgroundColor: PAL[i % PAL.length], stack: 's', borderRadius: 2 })),
      { label: 'Capa contrat (effectif × 8 h)', data: ctrG.map(v => Math.round(v)), type: 'line', borderColor: '#f76707',
        borderWidth: 2, pointRadius: 1.5, tension: .3, borderDash: [5, 3] },
      { label: 'HP (présence − repas)', data: hpG.map(v => Math.round(v)), type: 'line', borderColor: '#1b2440',
        borderWidth: 2, pointRadius: 1.5, tension: .3 },
      ...(logAny ? [{ label: 'Heures de log réalisées', data: logG.map(v => Math.round(v)), type: 'line',
        borderColor: '#0ca678', borderWidth: 2, pointRadius: 1.5, tension: .3, borderDash: [5, 3] }] : [])] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt1(c.parsed.y ?? 0) + ' h' } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 16 } },
                y: { stacked: true, beginAtZero: true, ...axisY('heures / ' + (isAvg ? 'jour (moy.)' : 'jour')) } } } });
  /* graphique 2 : personnes par jour (prod + FIM) */
  const prodB = keys.map(() => 0), fimB = keys.map(() => 0);
  days.forEach((d, j) => { prodB[idx[j]] += P.day[d].plan - P.day[d].fim; fimB[idx[j]] += P.day[d].fim; });
  const avgArr = a => a.map((v, i) => cnt[i] ? v / cnt[i] : 0);
  mkChart('c8b', { type: 'bar', data: { labels: keys, datasets: [
      { label: isAvg ? 'Planifiés prod (moy. / jour)' : 'Planifiés prod', data: avgArr(prodB).map(v => Math.round(v * 10) / 10), backgroundColor: '#3b5bdb', stack: 's', borderRadius: 2 },
      { label: isAvg ? 'FIM hors prod (moy. / jour)' : 'FIM hors prod', data: avgArr(fimB).map(v => Math.round(v * 10) / 10), backgroundColor: '#adb5bd', stack: 's', borderRadius: 2 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: 16 } },
                y: { stacked: true, beginAtZero: true, ...axisY('personnes') } } } });
  /* tableau détail par jour */
  let h = '<thead><tr><th>Date</th><th>Jour</th><th>Planifiés</th><th>dont FIM</th><th>Allait.</th><th>HP (h)</th><th>Capa contrat (h)</th>' +
    actsU.map(a => `<th>${a} (h)</th>`).join('') + '<th>Σ réparti (h)</th>' +
    (logAny ? '<th>Log réalisé (h)</th>' : '') + '<th>FIM (h)</th></tr></thead><tbody>';
  days.forEach((d, i) => {
    const D8 = P.day[d];
    h += `<tr><td>${dLab(d)}</td><td>${jJours(d)}</td><td>${D8.plan}</td><td>${D8.fim}</td><td>${D8.nal || 0}</td><td>${fmt1(D8.hp)}</td>` +
      `<td><b>${fmt1(ctrOf(d))}</b></td>` +
      actsU.map(a => `<td>${hBy[a][i] ? fmt1(hBy[a][i]) : '·'}</td>`).join('') +
      `<td>${fmt1(sumRep[i])}</td>` +
      (logAny ? `<td>${LOG[i] != null ? fmt1(LOG[i]) : '—'}</td>` : '') +
      `<td>${fmt1(D8.fimh)}</td></tr>`;
  });
  h += `</tbody><tfoot><tr><td colspan="2">Total période · moy. / jour</td><td>${fmt1(totPlan / days.length)} / j</td>` +
       `<td>${fmt1(totFimN / days.length)} / j</td><td>${fmt1(NAL / days.length)} / j</td><td>${fmt(Math.round(HP))}</td>` +
       `<td>${fmt(Math.round(CTR))}</td>` +
       actsU.map(a => `<td>${fmt(Math.round(hBy[a].reduce((x, y) => x + y, 0)))}</td>`).join('') +
       `<td>${fmt(Math.round(sumRep.reduce((x, y) => x + y, 0)))}</td>` +
       (logAny ? `<td>${fmt(Math.round(logTot))}</td>` : '') +
       `<td>${fmt(Math.round(FM))}</td></tr></tfoot>`;
  $('t8').innerHTML = h;
  $('w8JSrc').textContent = 'Planification : ' + ((P.meta && P.meta.file) || 'importée') + ' · ' + days.length + ' j · ' +
    (D.skills && D.skills.by ? Object.keys(D.skills.by).filter(k => k.startsWith('wd:')).length + ' compétences' : 'compétences : lots du Planning') +
    ' · ' + gfLbl();
}

/* ---------- vue par créneaux 30 min ---------- */
function r8Cre() {
  const P = D.plan;
  const days = P.dates.filter(d => inPer('p8', d));
  defSlotDay8();
  if (!days.length) { noPer('p8', 'k8c', ['c8c', 'c8d'], 't8m'); $('t8p').innerHTML = '';
    $('w8Src').textContent = 'Planification : aucun jour sur ' + rangeLbl(...perRange()); return; }
  const slots = P.slots;
  const combos = planCombos();
  const actsU = [...new Set(combos.map(k => k.split('|')[0]))].filter(a => gfPass(a));
  const v8 = $('w8V').value, d8 = $('w8D').value;
  const jourPrecis = v8 === 'jour' && P.m.prod[d8];
  const daysUse = jourPrecis ? [d8] : days;
  const nD = daysUse.length;
  /* personnes par créneau (prod / FIM) */
  const vec = jourPrecis ? P.m.prod[d8].slice() : slots.map((_, i) => days.reduce((s, d) => s + (P.m.prod[d][i] || 0), 0) / days.length);
  const fimV = jourPrecis ? (P.m.fim[d8] || []).slice() : slots.map((_, i) => days.reduce((s, d) => s + (P.m.fim[d][i] || 0), 0) / days.length);
  const iP = vec.indexOf(Math.max(...vec));
  /* heures par activité par créneau */
  const hS = {};
  actsU.forEach(a => hS[a] = slots.map(() => 0));
  daysUse.forEach(d => {
    const BS = (P.byActSlot || {})[d] || {};
    combos.forEach(k => {
      const a = k.split('|')[0], arr = BS[k];
      if (!arr || !hS[a]) return;
      arr.forEach((v, si) => hS[a][si] += v);
    });
  });
  if (!jourPrecis) actsU.forEach(a => hS[a] = hS[a].map(v => v / nD));
  const totS = slots.map((_, i) => actsU.reduce((s, a) => s + hS[a][i], 0));
  const totH = totS.reduce((a, b) => a + b, 0);
  const iHS = totS.indexOf(Math.max(...totS));
  const domC = actsU.length ? actsU.reduce((b, a) => hS[a][iHS] > hS[b][iHS] ? a : b, actsU[0]) : '—';
  const lblC = jourPrecis ? dShort(d8) + ' (' + jJours(d8) + ')' : 'moyenne période';
  $('k8c').innerHTML =
    kpi('Pointe personnes en prod', fmt1(vec[iP]), slots[iP] + ' · ' + lblC) +
    kpi('FIM hors prod à la pointe', fmt1(fimV[iP]), slots[iP]) +
    kpi('Heures / créneau', fmt1(totS[iHS]) + ' h', 'pointe à ' + slots[iHS] + ' · ' + lblC) +
    kpi('Activité dominante (pointe h)', domC, fmt1(hS[domC] ? hS[domC][iHS] : 0) + ' h à ' + slots[iHS]) +
    kpi('Σ heures ' + lblC.toLowerCase(), fmt(Math.round(totH)) + ' h', (jourPrecis ? 'jour précis' : 'moy. / jour') +
        ' · Σ créneaux = capa contrat (8 h/j, 7 h si allaitement)');
  mkChart('c8c', { type: 'bar', data: { labels: slots, datasets: [
      { label: 'Planifiés prod', data: vec.map(v => Math.round(v * 10) / 10), backgroundColor: '#3b5bdb', borderRadius: 2 },
      { label: 'FIM hors prod', data: fimV.map(v => Math.round(v * 10) / 10), backgroundColor: '#adb5bd', borderRadius: 2 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt1(c.parsed.y) } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
                y: { stacked: true, beginAtZero: true, ...axisY('personnes / créneau') } } } });
  mkChart('c8d', { type: 'bar', data: { labels: slots, datasets: [
      ...actsU.map((a, i) => ({ label: a, data: hS[a].map(v => Math.round(v * 100) / 100),
        backgroundColor: PAL[i % PAL.length], stack: 's', borderRadius: 2 }))] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt1(c.parsed.y ?? 0) + ' h' } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
                y: { stacked: true, beginAtZero: true, ...axisY('heures / créneau') } } } });
  /* matrice créneau × activité */
  let hm = '<thead><tr><th>Créneau</th>' + actsU.map(a => `<th>${a} (h)</th>`).join('') + '<th>Total (h)</th></tr></thead><tbody>';
  slots.forEach((s, i) => {
    hm += `<tr><td>${s}</td>` + actsU.map(a => `<td>${hS[a][i] ? fmt1(hS[a][i]) : '·'}</td>`).join('') +
      `<td><b>${fmt1(totS[i])}</b></td></tr>`;
  });
  hm += `</tbody><tfoot><tr><td>Σ ${lblC}</td>` + actsU.map(a => `<td>${fmt1(hS[a].reduce((x, y) => x + y, 0))}</td>`).join('') +
    `<td>${fmt1(totH)}</td></tr></tfoot>`;
  $('t8m').innerHTML = hm;
  /* matrice personnes par créneau × jour */
  let hp = '<thead><tr><th>Créneau</th>' + days.map(d => `<th>${dShort(d)}</th>`).join('') + '<th>Moy. / jour</th></tr></thead><tbody>';
  slots.forEach((s, i) => {
    const vals = days.map(d => (P.m.prod[d] || [])[i] || 0);
    hp += `<tr><td>${s}</td>` + vals.map(v => `<td>${v ? fmt1(v) : '·'}</td>`).join('') +
      `<td><b>${fmt1(vals.reduce((a, b) => a + b, 0) / days.length)}</b></td></tr>`;
  });
  hp += '</tbody>';
  $('t8p').innerHTML = hp;
  $('w8Src').textContent = 'Planification : ' + ((P.meta && P.meta.file) || 'importée') + ' · ' + lblC +
    ' · ' + slots[0] + ' → ' + slots[slots.length - 1] + ' · répartition Skills (heures de contrat)' + (gfLbl() !== 'Total' ? ' · ' + gfLbl() : '');
}
function bind8() {
  $('w8V').addEventListener('change', r8);
  $('w8D').addEventListener('change', r8);
  document.querySelectorAll('#p8subs button[data-v]').forEach(b => b.addEventListener('click', () => {
    P8V.view = b.dataset.v;
    document.querySelectorAll('#p8subs button[data-v]').forEach(x => x.classList.toggle('on', x === b));
    gfDisables(); r8();
  }));
  RENDERS.p8 = r8;
}

/* =====================================================================
   AMORÇAGE
   ===================================================================== */
/* =====================================================================
   P5 — ANALYSE RÉALISÉ (ex-Productivité — sections par canal selon les filtres globaux)
   Phone : EXT_Entrant (Données DASHBOARD CAPA) · Mail : EXT_Email · Chat : pas encore raccordé
   QS = traités/reçus · QP = reçus/prévision · QS<60s · QE si QP>115% · T/P
   DMT · Productivité = traités / heure de traitement · TO = traitement / heures planifiées
   (indicateurs spécifiques à définir avec l'équipe — rework prévu)
   ===================================================================== */
const tauxChip = t => t >= 65 ? 'g' : t >= 50 ? 'a' : 'r';   /* taux < 60 s (qualité) */
const tauxReal = t => t >= 95 ? 'g' : t >= 80 ? 'a' : 'r';   /* taux d'occupation / couverture */
function planHoursOf(act, d, chan) {                                // heures planifiées (par canal si précisé)
  const P = D.planH, ai = P.dates.indexOf(d);
  if (ai < 0) return 0;
  if (chan && P.fc) {
    let s = 0, any = false;
    Object.keys(P.fc).forEach(k => {
      const i = k.indexOf('|');
      if (norm(k.slice(0, i)) === norm(act)) { any = true; if (k.slice(i + 1) === chan) s += P.fc[k][ai] || 0; }
    });
    if (any) return s;
  }
  const k = P.acts.find(x => norm(x) === norm(act));
  return k ? (P.f[k] || [])[ai] || 0 : 0;
}
function ch5(canal) {                                               // adaptateur de données par canal
  if (canal === 'mail') {
    const M = D.mail, PM = prevMailMap();
    const prevOf = (f, d) => { const p = PM[norm(f)]; return p ? (p[d] || 0) : 0; };
    return {
      dates: M.dates, acts: M.flows, has: M.dates.length > 0,
      emptyMsg: ['Aucune donnée Mail.', 'Importez le fichier « Données DASHBOARD CAPA AUCHAN » (feuille EXT_Email — réalisé mail) via le bouton Importer.'],
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
      emptyMsg: ['Aucune donnée Phone.', 'Importez le fichier « Données DASHBOARD CAPA AUCHAN » (feuille EXT_Entrant — réalisé voix + DMT) via le bouton Importer.'],
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
    $('p5emptyT').textContent = 'Aucune donnée Analyse réalisé pour ce périmètre.';
    $('p5emptyS').textContent = 'Ajustez les filtres Flux / Channel / Activités, ou importez le fichier « Données DASHBOARD CAPA AUCHAN » (feuilles EXT_Entrant et EXT_Email).';
  }
  $('w5Src').textContent = sums.length ? sums.join(' · ') : 'Analyse réalisé : aucune donnée';
}
function r5Canal(canal) {                           // section d'un canal ; renvoie le résumé ou null
  const C = ch5(canal);
  const lbl = canal === 'phone' ? 'Phone' : canal === 'mail' ? 'Mail' : 'Chat';
  const div = document.createElement('div');
  $('p5body').appendChild(div);
  if (!C || !C.has) {
    const msg = canal === 'phone' ? ['Aucune donnée Phone.', 'Importez le fichier « Données DASHBOARD CAPA AUCHAN » (feuille EXT_Entrant — réalisé voix + DMT) via le bouton Importer.']
      : canal === 'mail' ? ['Aucune donnée Mail.', 'Importez le fichier « Données DASHBOARD CAPA AUCHAN » (feuille EXT_Email — réalisé mail) via le bouton Importer.']
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
    acts.forEach(a => { ph += planHoursOf(a, d, canal === 'mail' ? 'MAIL' : 'PHONE'); });
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
      const ph = planHoursOf(a, d, canal === 'mail' ? 'MAIL' : 'PHONE');
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
