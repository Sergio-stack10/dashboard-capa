'use strict';
/* =====================================================================
   Dashboard capacitaire – Roadmap Auchan
   Données : localStorage « capaData » sinon data/data.json (+ data/roadmap.json)
   Onglets : p1 Roadmap (besoin & capacité — modèle RM S46+) · p2 Capacitaire (actes & heures) ·
             p3 Capa prévu vs Capa réel (planning) · p5 Productivité (Phone/Mail/Chat) ·
             p6 DMT (Vonage) · p7 Mail (Export Mail)
   ===================================================================== */

/* ---------- constantes ---------- */
const LS = 'capaData';
const RFLOW = ['HYPER', 'C2E', 'AFR', 'DRIVE', 'SAV'];                       // flux du réalisé (DRM)
const RCOL  = { HYPER:'#3b5bdb', C2E:'#0ca678', AFR:'#f59f00', DRIVE:'#7048e8', SAV:'#e8590c' };
const PAL   = ['#3b5bdb','#0ca678','#f59f00','#7048e8','#e8590c','#1098ad','#d6336c','#74b816'];
const FLOWS8 = ['Voix Hyper','Voix C2E','Voix AFR','Voix Drive','Voix SAV','Mail Hyper','Mail AFR','Mail Drive'];
const MOIS  = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const JJ    = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];

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
           pmail: { file: '', maj: '', rows: [] } };
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
    bits.push('Planning : ' + (m.plan || D.planH.file || 'importé') + ' (' + D.planH.dates.length + ' j)');
  if (D.etp && D.etp.file) bits.push('ETP : ' + D.etp.file);
  if (D.real && D.real.dates && D.real.dates.length)
    bits.push('Réalisé : ' + (m.real || D.real.file || 'DRM') + ' (' + D.real.dates.length + ' j)');
  if (D.dmt && D.dmt.dates && D.dmt.dates.length)
    bits.push('DMT : ' + (m.dmt || D.dmt.file || 'Vonage') + ' (' + D.dmt.dates.length + ' j)');
  if (D.mail && D.mail.dates && D.mail.dates.length)
    bits.push('Mail : ' + (m.mail || D.mail.file || 'Export Mail') + ' (' + D.mail.dates.length + ' j)');
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
    try { setStatus('stPmail', impPmail(f.name, b), true); afterImport('p7'); }
    catch (err) { setStatus('stPmail', 'Erreur : ' + err.message, false); }
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
  /* p1 : périmètre + semaine analysée (modèle RM v2) */
  const R = D.rm2;
  const s1 = $('w1P'), sw = $('w1W');
  if (R && R.weeks && R.weeks.length) {
    const cur = s1.value;
    s1.innerHTML = '<option value="">Total</option>' +
      ['FO', 'BO', 'AU'].map(f => `<option value="fam:${f}">${RM_FAMLBL[f]}</option>`).join('') +
      R.acts.map(a => `<option value="act:${a.k}">${a.k}</option>`).join('');
    if ([...s1.options].some(o => o.value === cur)) s1.value = cur;
    const curW = sw.value;
    sw.innerHTML = R.weeks.map((w, i) => `<option value="${i}">${w.k} · du ${w.start ? dShort(w.start) : '?'} </option>`).join('');
    const t = new Date().toISOString().slice(0, 10);
    const defI = Math.max(0, R.weeks.findIndex(w => w.start && w.start >= t) >= 0
      ? R.weeks.findIndex(w => w.start && w.start >= t) : R.weeks.length - 1);
    sw.value = [...sw.options].some(o => o.value === curW) ? curW : String(defI);
  } else { s1.innerHTML = '<option value="">—</option>'; sw.innerHTML = ''; }
  /* p2 : activités capa */
  const s2 = $('s2F');
  s2.innerHTML = '<option value="">Toutes les activités</option>' +
    D.capa.flux.map((f, i) => `<option value="${i}">${f.k}</option>`).join('');
  /* p3 : activités = union capa + planning + réalisé */
  const set3 = new Set([
    ...D.capa.flux.map(f => f.a),
    ...D.planH.acts,
    ...RFLOW.map(f => f.charAt(0) + f.slice(1).toLowerCase())
  ].filter(Boolean));
  const s3 = $('s3F');
  s3.innerHTML = '<option value="">Toutes les activités</option>' + [...set3].sort().map(k => `<option value="${k}">${k}</option>`).join('');
  /* p5 : activités par canal */
  fill5Acts();
  /* sources */
  $('w1Src').textContent = R && R.weeks && R.weeks.length
    ? 'Modèle RM : ' + (D.meta.rm2 || (R.meta && R.meta.file) || 'RM') + ' · ' + R.weeks.length + ' sem.'
    : 'Modèle RM : à importer';
  $('w2Src').textContent = 'Capacitaire : ' + (D.capa.dates.length ? D.meta.capa : '—');
  $('w3Src').textContent = 'Planning : ' + (D.planH.dates.length ? D.planH.file : 'à importer') +
    (D.capa.dates.length ? ' · Capacitaire : ' + (D.meta.capa || 'importée') : '');
  $('w5Src').textContent = 'Phone : DRM + Vonage · Mail : Export Mail · Chat : —';
  $('w6Src').textContent = D.dmt.dates.length
    ? 'DMT : ' + (D.meta.dmt || D.dmt.file) + ' · ' + D.dmt.dates[0] + ' → ' + D.dmt.dates[D.dmt.dates.length - 1]
    : 'Export Vonage : à importer';
  $('w7Src').textContent = D.mail.dates.length
    ? 'Mail : ' + (D.meta.mail || D.mail.file) + ' · ' + D.mail.dates[0] + ' → ' + D.mail.dates[D.mail.dates.length - 1]
    : 'Export Mail : à importer';
  renderProdEd();
}

/* =====================================================================
   FILTRES DE PÉRIODE (un jeu de contrôles par onglet)
   ===================================================================== */
const PERIOD_P = { p2: ['d2A','d2B','d2P'], p3: ['d3A','d3B','d3P'],
                   p5: ['d5A','d5B','d5P'], p6: ['d6A','d6B','d6P'],
                   p7: ['d7A','d7B','d7P'] };
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
    case 'p6': { const d = D.dmt.dates; return d.length ? [d[0], d[d.length - 1]] : []; }
    case 'p7': { const d = D.mail.dates; return d.length ? [d[0], d[d.length - 1]] : []; }
  }
  return [];
}
function perRange(p) {
  const ids = PERIOD_P[p] || [];
  return [ids[0] && $(ids[0]) ? $(ids[0]).value || '' : '', ids[1] && $(ids[1]) ? $(ids[1]).value || '' : ''];
}
function inPer(p, d) { const [a, b] = perRange(p); return (!a || d >= a) && (!b || d <= b); }
function setPreset(p) {
  const ids = PERIOD_P[p], bd = perBounds(p);
  const mx = bd[1] || new Date().toISOString().slice(0, 10);
  const v = $(ids[2]).value;
  if (v === 'custom') return;
  let a = '', b = '';
  if (v === 'last') { a = mx.slice(0, 7) + '-01'; b = mx; }
  else if (v === 'prev') {
    const pm = new Date(mx.slice(0, 7) + '-01T00:00:00'); pm.setMonth(pm.getMonth() - 1);
    const nx = new Date(pm); nx.setMonth(nx.getMonth() + 1); nx.setDate(0);
    a = pm.toISOString().slice(0, 10); b = nx.toISOString().slice(0, 10);
  }
  else if (v === 'd7')  { a = addDays(mx, -6);  b = mx; }
  else if (v === 'd30') { a = addDays(mx, -29); b = mx; }
  $(ids[0]).value = a; $(ids[1]).value = b;
}
function bindPeriod(p, fn) {
  const ids = PERIOD_P[p];
  $(ids[2]).addEventListener('change', () => { setPreset(p); fn(); });
  $(ids[0]).addEventListener('change', () => { $(ids[2]).value = 'custom'; fn(); });
  $(ids[1]).addEventListener('change', () => { $(ids[2]).value = 'custom'; fn(); });
}
function noPer(p, elK, charts, tbl) {                              // affichage « période vide » générique
  $(elK).innerHTML = '<div class="kpi"><div class="lbl">Aucune donnée sur la période</div><div class="sub">\u00c9largissez le filtre de période.</div></div>';
  (charts || []).forEach(c => mkChart(c, { type: 'bar', data: { labels: [], datasets: [] } }));
  if (tbl) $(tbl).innerHTML = '';
}

/* =====================================================================
   P1 — ROADMAP (besoin & capacité — modèle RM S46+, hebdo)
   9 blocs : heures log/prod · actes · ETP · effectif · SLA/QE · DMT · TO · absentéisme · congés
   ===================================================================== */
function rmActsOf(per) {
  if (!D.rm2) return [];
  if (!per) return D.rm2.acts.map(a => a.k);
  if (per.startsWith('fam:')) { const f = per.slice(4); return D.rm2.acts.filter(a => a.fam === f).map(a => a.k); }
  return [per.slice(4)];
}
function rmAgg(sec, per) {                        // série hebdo complète du périmètre
  const R = D.rm2, S = R.s[sec], W = R.weeks.length;
  if (!S) return null;
  const direct = (!per && sec === 'conges') ? null                    // total fichier en ETP ≠ taux
    : !per ? S.t : per.startsWith('fam:') ? S.fam[per.slice(4)] : S.a[per.slice(4)];
  const acts = rmActsOf(per), rate = RM_RATE.has(sec);
  const wsrc = D.rm2.s[RM_WBY[sec] || 'pfin'];
  const out = Array(W).fill(null);
  for (let i = 0; i < W; i++) {
    const d = direct ? direct[i] : null;
    if (d != null && d !== 0) { out[i] = d; continue; }
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
    else out[i] = d != null ? d : null;
  }
  return out;
}
function rmQE(per, i) {                           // QE = Σ capacité actes / Σ prévision finale
  let c = 0, p = 0;
  rmActsOf(per).forEach(k => {
    const CA = D.rm2.s.capa_a, PF = D.rm2.s.pfin;
    const ca = CA && CA.a[k] ? CA.a[k][i] : null, pf = PF && PF.a[k] ? PF.a[k][i] : null;
    if (ca != null) c += ca;
    if (pf != null) p += pf;
  });
  return p > 0 ? c / p : null;
}
function rmPerLbl(per) {
  if (!per) return 'Total';
  if (per.startsWith('fam:')) return RM_FAMLBL[per.slice(4)];
  return per.slice(4);
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
  const per = $('w1P').value;
  const W = R.weeks.length;
  const saI = Math.min(W - 1, Math.max(0, +($('w1W').value || 0) || 0));
  const win = rmWindow(saI);
  if (!win.length) { blank(); return; }
  const showY = new Set(win.map(i => R.weeks[i].y)).size > 1;
  const labels = win.map(i => { const w = R.weeks[i]; return 'S' + w.n + (showY ? ' ' + String(w.y).slice(2) : ''); });
  const ttip = win.map(i => { const w = R.weeks[i];
    return w.k + (w.start ? ' · du ' + dShort(w.start) + (w.end ? ' au ' + dShort(w.end) : '') : ''); });
  const secs = ['pfin', 'prev', 'capa_a', 'bes_hlog', 'capa_hlog', 'bes_hprod', 'capa_hprod', 'bes_etp',
    'eff_prod', 'delta_etp', 'dmt', 'occ', 'abs', 'conges', 'conges_etp', 'eff', 'cible'];
  const F = { qe: Array(W).fill(null) };
  secs.forEach(s => { F[s] = rmAgg(s, per) || Array(W).fill(null); });
  for (let i = 0; i < W; i++) F.qe[i] = rmQE(per, i);
  const pI = saI > 0 ? saI - 1 : null;
  const dPts = (a, b) => a != null && b != null ? ' · Δ ' + (a - b >= 0 ? '+' : '') + (Math.round((a - b) * 1000) / 10) + ' pts' : '';
  const dPct = (a, b) => a != null && b != null && b !== 0 ? ' · Δ ' + (a >= b ? '+' : '') + (Math.round((a / b - 1) * 1000) / 10) + ' %' : '';
  const pc1 = v => v == null ? '—' : (Math.round(v * 1000) / 10) + ' %';
  const wSA = R.weeks[saI];
  const perLbl = rmPerLbl(per);
  const acts = rmActsOf(per);

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
      ...(per === '' ? [{ label: 'Effectif saisi (fichier)', data: win.map(i => R.s.eff ? R.s.eff.t[i] : null),
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
  if (per === '') notes.push('« Effectif saisi » = ligne Effectif du fichier (têtes) ; les barres = somme des ETP répartis par activité.');
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
  const g = $('s2G').value, fsel = $('s2F').value, u = $('s2U').value;    // u : 'a' = actes, 'h' = heures
  const keep = C.dates.map((d, i) => [d, i]).filter(([d]) => inPer('p2', d)).map(([, i]) => i);
  if (!keep.length) { noPer('p2', 'k2', ['c2a'], 't2'); return; }
  const fD = keep.map(i => C.dates[i]);
  const { keys, idx } = aggBy(fD, g);
  const zero = () => Array(keys.length).fill(0);
  const flux = fsel === '' ? C.flux : [C.flux[+fsel]];
  const acc = flux.map(() => zero());
  const tPrev = zero(), tContr = zero();
  let convUsed = false, hMissing = false;
  flux.forEach((f, fi) => {
    keep.forEach((oi, k) => {
      const ca = f.capa[oi] || 0, pv = f.prev[oi] || 0, ct = f.contr[oi] || 0;
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
    kpi('Prévu total', fmt(Math.round(P)), 'couverture ' + pctS(tCapa, P)) +
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
  const g = $('s3G').value, fsel = $('s3F').value;
  const days = [...new Set([...C.dates, ...P.dates])].filter(d => inPer('p3', d)).sort();
  if (!days.length) { noPer('p3', 'k3', ['c3a', 'c3b'], 't3'); $('p3Hint').textContent = ''; return; }
  const kOf = d => g === 'mois' ? mKey(d) : g === 'semaine' ? wLab(d) : d;
  const keys = [], idxOf = {};
  days.forEach(d => { const k = kOf(d); if (!(k in idxOf)) { idxOf[k] = keys.length; keys.push(k); } });
  const z = () => Array(keys.length).fill(0);
  const pvA = z(), rlA = z(), pvH = z(), plH = z(), reD = z();
  const missProd = new Set(), noHrs = new Set();
  const fSel = a => !fsel || norm(a) === norm(fsel);
  /* capa prévue (actes + heures) */
  C.flux.forEach(f => {
    if (!fSel(f.a)) return;
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
    if (!fSel(a)) return;
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
      if (fsel && norm(f) !== norm(fsel) && norm(f.charAt(0) + f.slice(1).toLowerCase()) !== norm(fsel)) return;
      reD[k] += R.f[f].t[di] || 0;
    });
  });
  const rd = a => a.map(v => Math.round(v));
  const TP = pvA.reduce((a, b) => a + b, 0), TRl = rlA.reduce((a, b) => a + b, 0);
  const TH = pvH.reduce((a, b) => a + b, 0), LH = plH.reduce((a, b) => a + b, 0), RD = reD.reduce((a, b) => a + b, 0);
  $('k3').innerHTML =
    kpi('Capa prévue (actes)', fmt(TP), g + (fsel ? ' · ' + fsel : ' · toutes activités')) +
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
  bindPeriod('p2', r2); bindPeriod('p3', r3);
  bindPeriod('p5', r5);
  ['w1P', 'w1W', 'w1F', 's1U'].forEach(id => $(id).addEventListener('change', r1));
  $('s2G').addEventListener('change', r2); $('s2F').addEventListener('change', r2); $('s2U').addEventListener('change', r2);
  $('s3G').addEventListener('change', r3); $('s3F').addEventListener('change', r3);
  RENDERS.p1 = r1; RENDERS.p2 = r2; RENDERS.p3 = r3;
  bind5();
  bind6();
  bind7();
  boot2();
}
function boot2() { /* complété en partie 3 (page 5) */ }

/* =====================================================================
   P5 — PRODUCTIVITÉ (Phone / Mail / Chat, par activité)
   QS = traités/reçus · QP = reçus/prévision · QS<60s · QE si QP>115% · T/P
   DMT · Productivité = traités / heure de traitement · TO = traitement / heures planifiées
   ===================================================================== */
const tauxChip = t => t >= 65 ? 'g' : t >= 50 ? 'a' : 'r';   /* taux < 60 s (qualité) */
const tauxReal = t => t >= 95 ? 'g' : t >= 80 ? 'a' : 'r';   /* taux d'occupation / couverture */

function fill5Acts() {                                              // activités du sélecteur selon le canal
  const c = $('s5C').value;
  let acts = [];
  if (c === 'phone') acts = [...new Set([...RFLOW, ...(D.dmt.flows || [])])];
  else if (c === 'mail') acts = (D.mail.flows || []).slice();
  $('s5F').innerHTML = '<option value="">Toutes les activités</option>' +
    acts.map(a => `<option value="${a}">${a}</option>`).join('');
}
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
        const rm = D.roadmap.find(x => norm(x.a) === norm(f) && norm(x.c) === 'voix');
        return rm ? (rm.prev[isoWeek(d) - 1] || 0) / 7 : 0;          // prévision hebdo répartie / jour
      },
      dmt: v => v.n ? v.h * 3600 / v.n : null
    };
  }
  return null;                                                      // chat : pas encore de source
}
function r5() {
  const canal = $('s5C').value;
  const C = ch5(canal);
  if (!C || !C.has) {
    $('p5body').style.display = 'none';
    const em = $('p5empty'); em.style.display = '';
    $('p5emptyT').textContent = canal === 'chat' ? 'Canal Chat — pas encore de source raccordée.' : (C ? C.emptyMsg[0] : 'Aucune donnée.');
    $('p5emptyS').textContent = canal === 'chat'
      ? 'Les exports nécessaires (plateforme de chat) ne sont pas encore définis. Les indicateurs QS, QP, QE, DMT, productivité et taux d\'occupation s\'afficheront dès le raccordement.'
      : (C ? C.emptyMsg[1] : '');
    $('w5Src').textContent = canal === 'phone' ? 'Phone : à importer (DRM · Vonage)' : canal === 'mail' ? 'Mail : à importer (Export Mail)' : 'Chat : —';
    ['c5a', 'c5b', 'c5c'].forEach(c => mkChart(c, { type: 'bar', data: { labels: [], datasets: [] } }));
    return;
  }
  $('p5body').style.display = ''; $('p5empty').style.display = 'none';
  const fsel = $('s5F').value;
  const acts = fsel ? C.acts.filter(a => norm(a) === norm(fsel)) : C.acts;
  const idx = C.dates.map((d, i) => [d, i]).filter(([d]) => inPer('p5', d)).map(([, i]) => i);
  if (!idx.length) { noPer('p5', 'k5', ['c5a', 'c5b', 'c5c']); $('k5b').innerHTML = ''; $('t5').innerHTML = '';
    $('w5Src').textContent = 'Aucun jour sur ' + rangeLbl(...perRange('p5')); return; }
  const rl = rangeLbl(...perRange('p5'));
  const canalLbl = canal === 'phone' ? 'Phone' : 'Mail';
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

  /* KPIs — indicateurs */
  $('k5').innerHTML =
    kpi('QS — qualité de service', QS == null ? '—' : QS + ' %', 'traités / reçus · ' + rl) +
    kpi('QP — qualité de production', QP == null ? '—' : QP + ' %', PV ? 'reçus / prévision' : 'prévision non disponible') +
    kpi('QE — efficacité', QE == null ? '—' : QE + ' %', QP != null && QP > 115 ? 'QP > 115 % : (traités / prévision) × 92 %' : 'applicable si QP > 115 %') +
    kpi('DMT', DMTp == null ? '—' : sec(DMTp) + ' s', canal === 'phone' ? 'communication + after-call / appel' : 'délai moyen par traité') +
    kpi('Productivité', PRODp ? fmt1(PRODp) + ' actes/h' : '—', 'traités / heure de traitement') +
    kpi("Taux d'occupation", TOp == null ? '—' : TOp + ' %', PH ? 'temps de traitement / heures planifiées' : 'heures planifiées non importées', TOp != null ? Math.min(100, TOp) : 0);

  /* KPIs — nombres */
  $('k5b').innerHTML =
    kpi('Contacts traités', fmt(TR), idx.length + ' jour' + (idx.length > 1 ? 's' : '') + (fsel ? ' · ' + fsel : ' · toutes activités')) +
    kpi('Contacts reçus', fmt(REC), canal === 'mail' ? 'courriels acceptés' : 'contacts reçus (DRM)') +
    kpi('Prévision de contacts', PV ? fmt(Math.round(PV)) : '—',
        canal === 'phone' ? 'Roadmap (prévision hebdo ÷ 7)' : canal === 'mail' ? ((D.pmail && D.pmail.rows.length) ? (D.meta.pmail || D.pmail.file) : 'import « Prévision Mail »') : '—') +
    kpi('Heures de traitement', hhDur(H * 3600), 'somme des temps de traitement');

  /* graphique : journalier reçus / traités / prévision */
  mkChart('c5a', { type: 'bar', data: { labels, datasets: [
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
  mkChart('c5b', { type: 'line', data: { labels, datasets: [
      ln('QS', qsJ, '#0ca678'), ln('QS < 60 s', q60J, '#3b5bdb'),
      ln('QP', qpJ, '#f59f00', true), ln('T/P', tpJ, '#7048e8')] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => c.parsed.y == null ? null : ' ' + c.dataset.label + ' : ' + Math.round(c.parsed.y) + ' %' } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axP5 } } });

  /* graphique : répartition par activité (traités) */
  const byA = acts.map(a => { let s = 0; idx.forEach(i => s += C.get(a, i).tr); return s; });
  mkChart('c5c', { type: 'doughnut',
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
  h += '</tbody><tfoot><tr><td colspan="3">Total période' + (fsel ? ' · ' + fsel : '') + '</td>' +
       `<td>${fmt(REC)}</td><td>${fmt(TR)}</td><td>${PV ? fmt(Math.round(PV)) : '—'}</td>` +
       `<td>${QS == null ? '—' : QS + ' %'}</td><td>${QP == null ? '—' : QP + ' %'}</td>` +
       `<td>${QS60 == null ? '—' : QS60 + ' %'}</td><td>${TPp == null ? '—' : TPp + ' %'}</td>` +
       `<td>${QE == null ? '—' : QE + ' %'}</td>` +
       `<td>${H ? hhDur(H * 3600) : '—'}</td>` +
       `<td>${DMTp == null ? '—' : sec(DMTp) + ' s'}</td>` +
       `<td>${PRODp ? fmt1(PRODp) : '—'}</td>` +
       `<td>${TOp == null ? '—' : TOp + ' %'}</td></tr></tfoot>`;
  $('t5').innerHTML = h;
  $('w5Src').textContent = canalLbl + ' : ' + idx.length + ' j · ' + rl + (fsel ? ' · ' + fsel : ' · toutes activités');
}

function bind5() {
  $('s5C').addEventListener('change', () => { fill5Acts(); r5(); });
  $('s5F').addEventListener('change', r5);
  bindPeriod('p5', r5);
  RENDERS.p5 = r5;
}

/* =====================================================================
   P6 — DMT (Export Vonage Call : durée moyenne de traitement par jour × activité)
   DMT = (communication + after-call work) / appels répondus
   ===================================================================== */
function r6() {
  const M = D.dmt;
  const has = M.dates.length > 0;
  $('p6body').style.display = has ? '' : 'none';
  $('p6empty').style.display = has ? 'none' : '';
  if (!has) { $('w6Src').textContent = 'Export Vonage : à importer'; return; }
  const idx = M.dates.map((d, i) => [d, i]).filter(([d]) => inPer('p6', d)).map(([, i]) => i);
  if (!idx.length) { noPer('p6', 'k6', ['c6a', 'c6b'], 't6');
    $('w6Src').textContent = 'DMT : aucun jour sur ' + rangeLbl(...perRange('p6')); return; }
  const rl = rangeLbl(...perRange('p6'));
  const fsel = $('s6F').value;
  const flows = fsel ? [fsel] : M.flows;
  const durOf = (f, i) => (M.f[f].com[i] || 0) + (M.f[f].acw[i] || 0);

  /* séries journalières */
  const labels = idx.map(i => M.dates[i].slice(8, 10) + '/' + M.dates[i].slice(5, 7));
  const per = f => idx.map(i => M.f[f].n[i] > 0 ? durOf(f, i) / M.f[f].n[i] : null);
  const globAll = idx.map(i => { let n = 0, dur = 0;
    M.flows.forEach(f => { n += M.f[f].n[i]; dur += durOf(f, i); }); return n ? dur / n : null; });

  /* agrégats de période */
  let N = 0, COM = 0, ACW = 0;
  flows.forEach(f => idx.forEach(i => { N += M.f[f].n[i]; COM += M.f[f].com[i]; ACW += M.f[f].acw[i]; }));
  const dmtG = N ? (COM + ACW) / N : 0;
  const avg = M.flows.map(f => { let n = 0, dur = 0; idx.forEach(i => { n += M.f[f].n[i]; dur += durOf(f, i); }); return n ? dur / n : 0; });
  const slowI = avg.indexOf(Math.max(...avg));
  let GN = 0, GDUR = 0;
  M.flows.forEach(f => idx.forEach(i => { GN += M.f[f].n[i]; GDUR += durOf(f, i); }));
  const dmtAll = GN ? GDUR / GN : 0;

  /* KPIs */
  $('k6').innerHTML =
    kpi('DMT moyenne', sec(dmtG) + ' s', rl + (fsel ? ' · ' + fsel : ' · toutes activités') + ' · secondes / appel') +
    kpi('Communication moy.', sec(N ? COM / N : 0) + ' s', 'temps de conversation') +
    kpi('After-call moy.', sec(N ? ACW / N : 0) + ' s', 'tâches après appel') +
    kpi('Appels répondus', fmt(N), idx.length + ' jour' + (idx.length > 1 ? 's' : '') + ' d\'activité') +
    (fsel ? '' : kpi('Activité la plus lente', M.flows[slowI] || '—', 'DMT moy. ' + sec(avg[slowI]) + ' s'));

  /* graphique : DMT par jour × activité */
  const axisSec = { beginAtZero: true, grid: GRID, ticks: { precision: 0 }, title: { display: true, text: 'secondes' } };
  mkChart('c6a', { type: 'line', data: { labels, datasets: [
      ...flows.map(f => ({ label: f, data: per(f),
        borderColor: RCOL[f] || PAL[M.flows.indexOf(f) % PAL.length], backgroundColor: 'transparent',
        borderWidth: 2, pointRadius: 2, tension: .3, spanGaps: true })),
      ...(fsel ? [] : [{ label: 'Global', data: globAll, borderColor: '#1b2440', backgroundColor: 'transparent',
        borderWidth: 2.5, borderDash: [6, 4], pointRadius: 0, tension: .3, spanGaps: true }])] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => c.parsed.y == null ? null : ' ' + c.dataset.label + ' : ' + sec(c.parsed.y) + ' s' } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axisSec } } });

  /* graphique : moyenne période par activité (communication + after-call empilés) */
  const comA = M.flows.map(f => { let n = 0, c = 0; idx.forEach(i => { n += M.f[f].n[i]; c += M.f[f].com[i]; }); return n ? c / n : 0; });
  const acwA = M.flows.map(f => { let n = 0, a = 0; idx.forEach(i => { n += M.f[f].n[i]; a += M.f[f].acw[i]; }); return n ? a / n : 0; });
  mkChart('c6b', { type: 'bar', data: { labels: M.flows, datasets: [
      { label: 'Communication', data: comA, backgroundColor: '#3b5bdb', borderRadius: 3 },
      { label: 'After-call work', data: acwA, backgroundColor: '#f59f00', borderRadius: 3 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + sec(c.parsed.x) + ' s' } } },
      scales: { x: { stacked: true, grid: GRID, ticks: { precision: 0 }, title: { display: true, text: 'secondes' } },
                y: { stacked: true, grid: { display: false } } } } });

  /* tableau : jour × activité */
  let h = '<thead><tr><th>Date</th><th>Jour</th>' + M.flows.map(f => `<th>${f}</th>`).join('') + '<th>Global</th></tr></thead><tbody>';
  idx.forEach((i, j) => {
    const d = M.dates[i];
    h += `<tr><td>${dLab(d)}</td><td>${jJours(d)}</td>` +
      M.flows.map(f => { const n = M.f[f].n[i]; return `<td>${n ? sec(durOf(f, i) / n) : '—'}</td>`; }).join('') +
      `<td><b>${globAll[j] != null ? sec(globAll[j]) : '—'}</b></td></tr>`;
  });
  h += '</tbody><tfoot><tr><td colspan="2">Moyenne période</td>' +
    avg.map(a => `<td>${a ? sec(a) : '—'}</td>`).join('') +
    `<td>${dmtAll ? sec(dmtAll) : '—'}</td></tr></tfoot>`;
  $('t6').innerHTML = h;

  $('w6Src').textContent = 'DMT : ' + (D.meta.dmt || M.file) + ' · ' + idx.length + ' j · ' + rl;
}

function bind6() {
  $('s6F').addEventListener('change', r6);
  bindPeriod('p6', r6);
  RENDERS.p6 = r6;
}

/* =====================================================================
   P7 — MAIL (Export Mail : réalisé du canal mail, par jour × activité)
   QS = traités/reçus · QP = reçus/prévision · QS<60s = traités<60s/reçus
   QE = si QP>115% : (traités/prévision)×92% · T/P = traités/prévision
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
function r7() {
  const M = D.mail;
  const has = M.dates.length > 0;
  $('p7body').style.display = has ? '' : 'none';
  $('p7empty').style.display = has ? 'none' : '';
  if (!has) { $('w7Src').textContent = 'Export Mail : à importer'; return; }
  const idx = M.dates.map((d, i) => [d, i]).filter(([d]) => inPer('p7', d)).map(([, i]) => i);
  if (!idx.length) { noPer('p7', 'k7', ['c7a', 'c7b'], 't7'); $('k7b').innerHTML = '';
    $('w7Src').textContent = 'Mail : aucun jour sur ' + rangeLbl(...perRange('p7')); return; }
  const rl = rangeLbl(...perRange('p7'));
  const fsel = $('s7F').value;
  const flows = fsel ? [fsel] : M.flows;
  const PM = prevMailMap();
  const prevOf = (f, d) => { const p = PM[norm(f)]; return p ? (p[d] || 0) : 0; };

  /* séries journalières */
  const labels = idx.map(i => M.dates[i].slice(8, 10) + '/' + M.dates[i].slice(5, 7));
  const recJ = idx.map(i => flows.reduce((s, f) => s + (M.f[f].rec[i] || 0), 0));
  const trJ  = idx.map(i => flows.reduce((s, f) => s + (M.f[f].tr[i] || 0), 0));
  const t60J = idx.map(i => flows.reduce((s, f) => s + (M.f[f].t60[i] || 0), 0));
  const pvJ  = idx.map(i => flows.reduce((s, f) => s + prevOf(f, M.dates[i]), 0));
  const q = (a, b) => b ? Math.round(a / b * 100) : null;          // ratio en % ou null
  const qsJ  = trJ.map((v, j) => q(v, recJ[j]));
  const q60J = t60J.map((v, j) => q(v, recJ[j]));
  const qpJ  = pvJ.map((v, j) => q(recJ[j], v));
  const tpJ  = pvJ.map((v, j) => q(trJ[j], v));

  /* agrégats de période */
  let REC = 0, TR = 0, T60 = 0, DEL = 0, PV = 0;
  flows.forEach(f => idx.forEach(i => { REC += M.f[f].rec[i] || 0; TR += M.f[f].tr[i] || 0;
    T60 += M.f[f].t60[i] || 0; DEL += M.f[f].del[i] || 0; PV += prevOf(f, M.dates[i]); }));
  const QS = q(TR, REC), QS60 = q(T60, REC), QP = q(REC, PV), TP = q(TR, PV);
  const QE = (QP != null && QP > 115) ? Math.round(TR / PV * 92) : null;

  /* perdus file -50s : colonne SLA-50 de l'Export Vonage (via l'import DMT) */
  const L = D.dmt; let lost = null;
  if (L.dates && L.dates.length) {
    lost = 0;
    idx.forEach(i => { const li = L.dates.indexOf(M.dates[i]); if (li < 0) return;
      L.flows.forEach(f => { if (fsel && norm(f) !== norm(fsel)) return;
        lost += (L.f[f].lost && L.f[f].lost[li]) || 0; }); });
  }

  /* KPIs — indicateurs de performance */
  $('k7').innerHTML =
    kpi('QS — qualité de service', QS == null ? '—' : QS + ' %', 'traités / reçus · ' + rl + (fsel ? ' · ' + fsel : '')) +
    kpi('QP — qualité de production', QP == null ? '—' : QP + ' %', PV ? 'reçus / prévision' : 'reçus / prévision · prévision non importée') +
    kpi('QS < 60 s', QS60 == null ? '—' : QS60 + ' %', 'traités < 60 s / reçus') +
    kpi('QE — efficacité', QE == null ? '—' : QE + ' %', QP != null && QP > 115 ? 'QP > 115 % : (traités / prévision) × 92 %' : 'applicable si QP > 115 %') +
    kpi('T/P — traités / prévision', TP == null ? '—' : TP + ' %', PV ? 'production vs prévision' : 'prévision non importée');

  /* KPIs — nombres */
  $('k7b').innerHTML =
    kpi('Contacts traités', fmt(TR), idx.length + ' jour' + (idx.length > 1 ? 's' : '') + (fsel ? ' · ' + fsel : ' · toutes activités')) +
    kpi('Contacts reçus', fmt(REC), 'courriels acceptés') +
    kpi('Prévision de contacts', PV ? fmt(PV) : '—', (D.pmail && D.pmail.rows.length) ? (D.meta.pmail || D.pmail.file) : 'import « Prévision Mail »') +
    kpi('Perdus file -50s', lost == null ? '—' : fmt(lost), 'colonne SLA-50 (Export Vonage)') +
    kpi('Heures de traitement', hhDur(DEL), 'somme des délais de traitement') +
    kpi('DMT', TR ? sec(DEL / TR) + ' s' : '—', 'délai moyen par traité');

  /* graphique : journalier reçus / traités / prévision */
  mkChart('c7a', { type: 'bar', data: { labels, datasets: [
      { label: 'Reçus', data: recJ, backgroundColor: '#3b5bdb', borderRadius: 3 },
      { label: 'Traités', data: trJ, backgroundColor: '#0ca678', borderRadius: 3 },
      ...(PV ? [{ label: 'Prévision', data: pvJ, type: 'line', borderColor: '#f59f00',
        borderDash: [5, 4], borderWidth: 2, pointRadius: 0, tension: .3 }] : [])] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt(c.parsed.y ?? c.parsed) } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axisY('courriels') } } });

  /* graphique : qualité journalière (%) */
  const axP7 = { beginAtZero: true, grid: GRID, ticks: { callback: v => v + ' %' } };
  const ln = (lab, data, col, dash) => ({ label: lab, data, borderColor: col, backgroundColor: 'transparent',
    borderDash: dash ? [5, 4] : [], borderWidth: 2, pointRadius: 1.5, tension: .3, spanGaps: true });
  mkChart('c7b', { type: 'line', data: { labels, datasets: [
      ln('QS', qsJ, '#0ca678'), ln('QS < 60 s', q60J, '#3b5bdb'),
      ln('QP', qpJ, '#f59f00', true), ln('T/P', tpJ, '#7048e8')] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => c.parsed.y == null ? null : ' ' + c.dataset.label + ' : ' + Math.round(c.parsed.y) + ' %' } } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axP7 } } });

  /* tableau : jour × activité — tous les indicateurs */
  let h = '<thead><tr><th>Date</th><th>Jour</th><th>Activité</th><th>Reçus</th><th>Traités</th><th>Prévision</th>' +
          '<th>QS</th><th>QP</th><th>QS &lt; 60 s</th><th>T/P</th><th>QE</th><th>Heures</th><th>DMT</th></tr></thead><tbody>';
  idx.forEach(i => { const d = M.dates[i];
    flows.forEach(f => {
      const rec = M.f[f].rec[i] || 0, tr = M.f[f].tr[i] || 0, t60 = M.f[f].t60[i] || 0, del = M.f[f].del[i] || 0;
      const pv = prevOf(f, d);
      if (!rec && !tr && !pv) return;
      const qp = q(rec, pv), tp = q(tr, pv), qe = (qp != null && qp > 115) ? Math.round(tr / pv * 92) : null;
      h += `<tr><td>${dLab(d)}</td><td>${jJours(d)}</td><td>${f}</td><td>${rec ? fmt(rec) : '—'}</td>` +
           `<td>${tr ? fmt(tr) : '—'}</td><td>${pv ? fmt(pv) : '—'}</td>` +
           `<td>${pctS(tr, rec)}</td><td>${qp == null ? '—' : qp + ' %'}</td>` +
           `<td>${pctS(t60, rec)}</td><td>${tp == null ? '—' : tp + ' %'}</td>` +
           `<td>${qe == null ? '—' : qe + ' %'}</td>` +
           `<td>${del ? fmt1(del / 3600) + ' h' : '—'}</td><td>${tr ? sec(del / tr) + ' s' : '—'}</td></tr>`;
    });
  });
  h += '</tbody><tfoot><tr><td colspan="3">Total période</td>' +
       `<td>${fmt(REC)}</td><td>${fmt(TR)}</td><td>${PV ? fmt(PV) : '—'}</td>` +
       `<td>${QS == null ? '—' : QS + ' %'}</td><td>${QP == null ? '—' : QP + ' %'}</td>` +
       `<td>${QS60 == null ? '—' : QS60 + ' %'}</td><td>${TP == null ? '—' : TP + ' %'}</td>` +
       `<td>${QE == null ? '—' : QE + ' %'}</td>` +
       `<td>${DEL ? fmt1(DEL / 3600) + ' h' : '—'}</td><td>${TR ? sec(DEL / TR) + ' s' : '—'}</td></tr></tfoot>`;
  $('t7').innerHTML = h;

  $('w7Src').textContent = 'Mail : ' + (D.meta.mail || M.file) + ' · ' + idx.length + ' j · ' + rl +
    ((D.pmail && D.pmail.rows.length) ? ' · prévision : ' + (D.meta.pmail || D.pmail.file) : '');
}

function bind7() {
  $('s7F').addEventListener('change', r7);
  bindPeriod('p7', r7);
  RENDERS.p7 = r7;
}

boot();
