'use strict';
/* =====================================================================
   Dashboard capacitaire – Roadmap Auchan
   Données : localStorage « capaData » sinon data/data.json
   Onglets : p1 Prévu · p2 Capacité · p3 Prévu vs planifié ·
             p4 Planifié vs réalisé · p5 Réalisé (DRM) · p6 DMT (Vonage) · p7 Mail (Export Mail)
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

/* normalisation d'un flux saisi (plan) vers les clés capa « Voix Hyper » … */
function normFlux(v) {
  const s = norm(v); if (!s) return '';
  const ch = /mail/.test(s) ? 'Mail' : 'Voix';
  for (const a of ['hyper', 'c2e', 'afr', 'drive', 'sav'])
    if (s.includes(a)) return ch + ' ' + a.charAt(0).toUpperCase() + a.slice(1);
  return String(v).trim();
}

/* ---------- état ---------- */
let D = null;                                        // données complètes
let PAGE = 'p1';
const CH = {};                                       // instances Chart.js

function emptyData() {
  return { meta: { maj: new Date().toISOString().slice(0, 10) },
           roadmap: [], capa: { dates: [], flux: [] },
           plan: { file: '', rows: [] },
           real: { maj: '', file: '', flows: RFLOW.slice(), dates: [], sem: [], jours: [],
                   f: Object.fromEntries(RFLOW.map(f => [f, { t: [], r: [], s: [] }])) },
           dmt: { file: '', maj: '', dates: [], flows: [], f: {} },
           mail: { file: '', maj: '', dates: [], flows: [], f: {} },
           pmail: { file: '', maj: '', rows: [] } };
}
function ensure() {
  if (!D.meta) D.meta = {};
  if (!D.roadmap) D.roadmap = [];
  if (!D.capa) D.capa = { dates: [], flux: [] };
  if (!D.plan) D.plan = { file: '', rows: [] };
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
  if (m.roadmap) bits.push('Roadmap : ' + m.roadmap);
  if (m.capa) bits.push('Capacité : ' + m.capa);
  if (D.plan && D.plan.rows && D.plan.rows.length) bits.push('Plan : ' + (m.plan || D.plan.file || 'importé') + ' (' + D.plan.rows.length + ' lignes)');
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

/* ---- Roadmap : onglet AUCHAN, repère S1__2026 (ligne 3), ACTS 3 col/activité ---- */
const ACTS = [['Hyper','Voix'],['C2E','Voix'],['AFR','Voix'],['Drive','Voix'],['SAV','Voix'],
              ['Hyper','Mail'],['AFR','Mail'],['Drive','Mail'],['Chat','Autres'],['Borne/LSA','Autres']];
function impRoadmap(name, buf) {
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames.find(n => norm(n) === 'auchan') || 0];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  let mr = -1, mc = -1;                                            // repère S1__2026
  aoa.forEach((row, ri) => (row || []).forEach((v, ci) => {
    if (ri <= 6 && mr < 0 && norm(v).startsWith('s1') && norm(v).includes('2026')) { mr = ri; mc = ci; }
  }));
  if (mr < 0) throw new Error('Repère S1__2026 introuvable (onglet AUCHAN)');
  const acts = [];
  for (let i = 0; i < ACTS.length; i++) {
    const [a, c] = ACTS[i], b = mc + 3 * i;
    const grab = off => Array.from({ length: 52 }, (_, w) => n2((aoa[mr] || [])[b + off + w] ?? 0));
    acts.push({ a, c, prev: grab(0), etp: grab(1), capa: grab(2) });
  }
  D.roadmap = acts;
  D.meta.roadmap = name;
  return acts.length + ' activités × ' + acts[0].prev.length + ' semaines';
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
  /* blocs de flux : repérer les lignes « Capacitaire en actes », flux = en-tête de bloc au-dessus */
  let cur = '';
  const flux = [];
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    for (let c = 0; c < 4; c++) {
      const v = row[c]; if (v != null && String(v).trim() !== '') cur = normFlux(v) || cur;
    }
    const lab = norm(row[3]);
    if (lab.includes('capacitaire en actes')) {
      const key = FLOWS8.find(k => norm(k) === norm(cur)) || cur;
      if (!flux.some(f => f.k === key)) flux.push({ k: key, c: key.startsWith('Mail') ? 'Mail' : 'Voix', a: key.split(' ')[1] || key });
      const last = flux[flux.length - 1];
      last.prev = []; last.contr = []; last.capa = [];
      for (let c = 4; c < dates.length + 4; c++) {                 // offsets -2/-1/0
        last.prev.push(n2(row[c - 2])); last.contr.push(n2(row[c - 1])); last.capa.push(n2(row[c]));
      }
    }
  }
  if (!flux.length) throw new Error('Lignes « Capacitaire en actes » introuvables');
  D.capa = { dates: dates.filter(Boolean), flux };
  D.meta.capa = name;
  return flux.length + ' flux × ' + n + ' jours';
}

/* ---- Planifié : colonnes date,creneau,flux,prevu,planifie,realise ---- */
function impPlan(name, buf) {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  let hi = aoa.findIndex(r => r && r.some(v => norm(v) === 'date'));
  if (hi < 0) hi = 0;
  const head = (aoa[hi] || []).map(v => norm(v));
  const col = n => head.findIndex(h => h === n || h.endsWith(n));
  const cD = col('date'), cC = col('creneau'), cF = col('flux'),
        cP = col('prevu'), cL = col('planifie'), cR = col('realise');
  if (cD < 0 || cF < 0) throw new Error('Colonnes date / flux introuvables');
  const rows = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i] || []; const d = isoD(r[cD]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    rows.push([d, hhmm(cC >= 0 ? r[cC] : ''), normFlux(cF >= 0 ? r[cF] : ''),
               n2(cP >= 0 ? r[cP] : 0), n2(cL >= 0 ? r[cL] : 0), n2(cR >= 0 ? r[cR] : 0)]);
  }
  if (!rows.length) throw new Error('Aucune ligne exploitable');
  D.plan = { file: name, rows };
  D.meta.plan = name;
  return rows.length + ' lignes';
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

/* ---- modèle plan (.xlsx) ---- */
function dlModele() {
  const aoa = [['date','creneau','flux','prevu','planifie','realise'],
               [isoD(new Date()), '08:00', 'Voix Hyper', 120, 118, 109],
               [isoD(new Date()), '08:30', 'Voix Hyper', 120, 122, 115],
               [isoD(new Date()), '08:00', 'Voix Drive', 200, 195, 190]];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'PLAN');
  XLSX.writeFile(wb, 'modele-plan.xlsx');
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
  $('fPlan').addEventListener('change', e => readFile(e.target, (f, b) => {
    try { setStatus('stPlan', impPlan(f.name, b), true); afterImport('p3'); }
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
  base.meta = { roadmap: 'Démo RM', capa: 'Démo CAPA', plan: 'Démo PLAN', maj: new Date().toISOString().slice(0, 10) };
  base.roadmap = ACTS.map(([a, c], i) => ({
    a, c,
    prev: Array.from({ length: 52 }, (_, w) => Math.round(600 + 380 * Math.sin(w / 6 + i) + 120 * Math.cos(w / 3))),
    etp:  Array.from({ length: 52 }, (_, w) => Math.max(1, Math.round(14 + 6 * Math.sin(w / 5 + i)))),
    capa: Array.from({ length: 52 }, (_, w) => Math.round(700 + 360 * Math.sin(w / 6 + i + .6)))
  }));
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
  const rows = [];
  const past = dates.filter(d => d <= new Date().toISOString().slice(0, 10));
  past.forEach(d => FLOWS8.forEach((f, fi) => {
    for (let c = 0; c < 22; c++) {
      const cr = String(8 + Math.floor(c / 2)).padStart(2, '0') + ':' + (c % 2 ? '30' : '00');
      const pv = Math.round(14 + 8 * Math.sin(c / 3 + fi));
      const pl = Math.round(pv * (0.9 + 0.2 * Math.random()));
      const re = d < new Date().toISOString().slice(0, 10) ? Math.round(pl * (0.85 + 0.25 * Math.random())) : 0;
      rows.push([d, cr, f, pv, pl, re]);
    }
  }));
  base.plan = { file: 'Démo PLAN', rows };
  /* DMT démo cohérente : (com + acw) par flux × jour */
  const M = base.dmt; M.file = 'Démo Vonage'; M.maj = new Date().toISOString().slice(0, 10);
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
  const ML = base.mail; ML.file = 'Démo Export Mail'; ML.maj = new Date().toISOString().slice(0, 10);
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
  base.pmail = { file: 'Démo Prévision Mail', maj: new Date().toISOString().slice(0, 10), rows: [] };
  past.forEach(d => ML.flows.forEach((f, fi) =>
    base.pmail.rows.push([d, f, Math.round(30 + 22 * Math.sin(+d.slice(8) / 5 + fi))])));
  /* réalisé démo cohérent avec le plan (agrégat jour × flux voix) */
  const R = base.real; R.file = 'Démo DRM'; R.maj = new Date().toISOString().slice(0, 10);
  rows.forEach(([d, , f, , , re]) => {
    if (!f.startsWith('Voix')) return;
    const ix = R.dates.indexOf(d);
    if (ix < 0) { R.dates.push(d); R.sem.push(isoWeek(d)); R.jours.push(jJours(d));
      RFLOW.forEach(fl => ['t','r','s'].forEach(k => R.f[fl][k].push(0))); }
    const j = R.dates.indexOf(d), fl = f.split(' ')[1].toUpperCase();
    R.f[fl].r[j] += Math.round(re * 1.08); R.f[fl].t[j] += re; R.f[fl].s[j] += Math.round(re * 0.6);
  });
  D = base; ensure();
  renderHead(); fillSelects(); go('p5');
}

/* =====================================================================
   SÉLECTEURS COMMUNS
   ===================================================================== */
function fillSelects() {
  /* p1 : activités roadmap */
  const s1 = $('w1Act');
  s1.innerHTML = '<option value="">Toutes les activités</option>' +
    D.roadmap.map((r, i) => `<option value="${i}">${r.a} — ${r.c}</option>`).join('');
  /* p2 : flux capa */
  const s2 = $('s2F');
  s2.innerHTML = '<option value="">Tous les flux</option>' +
    D.capa.flux.map((f, i) => `<option value="${i}">${f.k}</option>`).join('');
  /* p3 : flux = union capa + plan */
  const set3 = new Set([...D.capa.flux.map(f => f.k), ...D.plan.rows.map(r => r[2])].filter(Boolean));
  const s3 = $('s3F');
  s3.innerHTML = '<option value="">Tous les flux</option>' + [...set3].sort().map(k => `<option value="${k}">${k}</option>`).join('');
  /* p4 : flux = plan */
  const set4 = new Set(D.plan.rows.map(r => r[2]).filter(Boolean));
  const s4 = $('s4F');
  s4.innerHTML = '<option value="">Tous les flux</option>' + [...set4].sort().map(k => `<option value="${k}">${k}</option>`).join('');
  /* p5 : flux DRM */
  $('s5F').innerHTML = '<option value="">Tous les flux</option>' +
    RFLOW.map(f => `<option value="${f}">${f}</option>`).join('');
  /* p6 : activités DMT */
  $('s6F').innerHTML = '<option value="">Toutes les activités</option>' +
    (D.dmt.flows || []).map(f => `<option value="${f}">${f}</option>`).join('');
  /* p7 : activités mail */
  $('s7F').innerHTML = '<option value="">Toutes les activités</option>' +
    (D.mail.flows || []).map(f => `<option value="${f}">${f}</option>`).join('');
  /* sources */
  const src = t => (D.meta[t] || D[t] && D[t].file || '—');
  $('w1Src').textContent = 'Roadmap : ' + (D.roadmap.length ? D.meta.roadmap : '—');
  $('w2Src').textContent = 'Capacité : ' + (D.capa.dates.length ? D.meta.capa : '—');
  $('w3Src').textContent = 'Plan : ' + (D.plan.rows.length ? D.plan.file : 'à importer');
  $('w4Src').textContent = 'Plan : ' + (D.plan.rows.length ? D.plan.file : 'à importer');
  $('w5Src').textContent = D.real.dates.length
    ? 'Réalisé : ' + (D.meta.real || D.real.file) + ' · ' + D.real.dates[0] + ' → ' + D.real.dates[D.real.dates.length - 1]
    : 'Réalisé : à importer';
  $('w6Src').textContent = D.dmt.dates.length
    ? 'DMT : ' + (D.meta.dmt || D.dmt.file) + ' · ' + D.dmt.dates[0] + ' → ' + D.dmt.dates[D.dmt.dates.length - 1]
    : 'Export Vonage : à importer';
  $('w7Src').textContent = D.mail.dates.length
    ? 'Mail : ' + (D.meta.mail || D.mail.file) + ' · ' + D.mail.dates[0] + ' → ' + D.mail.dates[D.mail.dates.length - 1]
    : 'Export Mail : à importer';
}

/* =====================================================================
   FILTRES DE PÉRIODE (un jeu de contrôles par onglet)
   ===================================================================== */
const PERIOD_P = { p1: ['d1A','d1B','d1P'], p2: ['d2A','d2B','d2P'], p3: ['d3A','d3B','d3P'],
                   p4: ['d4A','d4B','d4P'], p5: ['d5A','d5B','d5P'], p6: ['d6A','d6B','d6P'],
                   p7: ['d7A','d7B','d7P'] };
function perBounds(p) {                                            // bornes de données de l'onglet
  switch (p) {
    case 'p1': { const W = Math.max(1, ...D.roadmap.map(a => a.prev.length));
                 return [mondayOfW(1), addDays(mondayOfW(W), 6)]; }
    case 'p2': { const d = D.capa.dates; return d.length ? [d[0], d[d.length - 1]] : []; }
    case 'p3': case 'p4': { const d = D.plan.rows.map(r => r[0]).sort();
                 return d.length ? [d[0], d[d.length - 1]] : []; }
    case 'p5': { const d = D.real.dates; return d.length ? [d[0], d[d.length - 1]] : []; }
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
   P1 — PRÉVU (roadmap hebdo)
   ===================================================================== */
function r1() {
  const all = D.roadmap;
  if (!all.length) { $('k1').innerHTML = '<div class="kpi"><div class="lbl">Aucune roadmap</div><div class="sub">Importez le fichier Roadmap (.xlsm, onglet AUCHAN).</div></div>'; mkChart('c1a', { type: 'bar', data: { labels: [], datasets: [] } }); mkChart('c1b', { type: 'bar', data: { labels: [], datasets: [] } }); return; }
  const sel = $('w1Act').value;
  const acts = sel === '' ? all : [all[+sel]];
  const W = Math.max(...acts.map(a => a.prev.length));
  const [pa, pb] = perRange('p1');                                 // filtre : semaines intersectant la période
  const wk = [];
  for (let w = 1; w <= W; w++) {
    const mo = mondayOfW(w);
    if ((!pa || addDays(mo, 6) >= pa) && (!pb || mo <= pb)) wk.push(w);
  }
  if (!wk.length) { noPer('p1', 'k1', ['c1a', 'c1b']); return; }
  const labels = wk.map(w => 'S' + w);
  const sum = key => wk.map(w => acts.reduce((acc, a) => (acc[wk.indexOf(w)] || 0) + (a[key][w - 1] || 0), 0));
  const prev = sum('prev'), capa = sum('capa'), etp = sum('etp');
  const tPrev = prev.reduce((a, b) => a + b, 0), tCapa = capa.reduce((a, b) => a + b, 0);
  let maxGap = 0, maxW = 0;
  prev.forEach((v, w) => { const g = Math.abs(capa[w] - v); if (g > maxGap) { maxGap = g; maxW = w; } });
  $('k1').innerHTML =
    kpi('Prévu total', fmt(tPrev), 'somme ' + (sel === '' ? 'toutes activités' : acts[0].a + ' ' + acts[0].c) + ' · ' + wk.length + ' sem. (' + labels[0] + ' → ' + labels[labels.length - 1] + ')') +
    kpi('Capacité total', fmt(tCapa), pctS(tCapa, tPrev) + ' du prévu') +
    kpi('ETP moyen / sem.', fmt1(etp.reduce((a, b) => a + b, 0) / wk.length), 'pic à ' + fmt1(Math.max(...etp)) + ' ETP') +
    kpi('Écart max (capa − prévu)', fmt(maxGap), 'semaine ' + labels[maxW], Math.abs(maxGap));
  mkChart('c1a', { type: 'line', data: { labels, datasets: [
      { label: 'Prévu', data: prev, borderColor: '#3b5bdb', backgroundColor: 'rgba(59,91,219,.08)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0 },
      { label: 'Capacité', data: capa, borderColor: '#0ca678', backgroundColor: 'transparent', borderDash: [5, 4], tension: .3, borderWidth: 2, pointRadius: 0 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } }, scales: { x: { grid: { display: false } }, y: axisY('contacts / sem.') } } });
  mkChart('c1b', { type: 'bar', data: { labels, datasets: [
      { label: 'ETP requis', data: etp, backgroundColor: '#7048e8', borderRadius: 3 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 13 } }, y: axisY('ETP') } } });
}
const kpi = (lbl, val, sub, bar) =>
  `<div class="kpi"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub || ''}</div>` +
  (bar != null ? `<div class="bar"><i style="width:${Math.min(100, bar)}%"></i></div>` : '') + '</div>';

/* =====================================================================
   P2 — CAPACITÉ (jour / semaine / mois)
   ===================================================================== */
function aggBy(dates, g) {                          // -> clés de période + index de regroupement
  const keys = [], idx = [];
  const kOf = d => g === 'jour' ? d : g === 'semaine' ? wLab(d) : mKey(d);
  dates.forEach(d => { const k = kOf(d); const i = keys.indexOf(k); if (i < 0) { keys.push(k); idx.push(keys.length - 1); } else idx.push(i); });
  return { keys, idx };
}
function r2() {
  const C = D.capa;
  if (!C.dates.length) { $('k2').innerHTML = '<div class="kpi"><div class="lbl">Aucune capacité</div><div class="sub">Importez le fichier Capacité (onglet DAILY VISION).</div></div>'; $('t2').innerHTML = ''; mkChart('c2a', { type: 'bar', data: { labels: [], datasets: [] } }); return; }
  const g = $('s2G').value, fsel = $('s2F').value;
  const keep = C.dates.map((d, i) => [d, i]).filter(([d]) => inPer('p2', d)).map(([, i]) => i);
  if (!keep.length) { noPer('p2', 'k2', ['c2a'], 't2'); return; }
  const fD = keep.map(i => C.dates[i]);
  const { keys, idx } = aggBy(fD, g);
  const zero = () => Array(keys.length).fill(0);
  const flux = fsel === '' ? C.flux : [C.flux[+fsel]];
  const acc = flux.map(() => zero());
  const tPrev = zero(), tContr = zero();
  flux.forEach((f, fi) => {
    keep.forEach((oi, k) => {
      acc[fi][idx[k]] += f.capa[oi] || 0;
      tPrev[idx[k]] += f.prev[oi] || 0;
      tContr[idx[k]] += f.contr[oi] || 0;
    });
  });
  const capaTot = acc.reduce((a, s) => s.map((v, i) => v + a[i]), zero());
  const tCapa = capaTot.reduce((a, b) => a + b, 0), P = tPrev.reduce((a, b) => a + b, 0), K = tContr.reduce((a, b) => a + b, 0);
  $('k2').innerHTML =
    kpi('Capacité totale', fmt(tCapa), keys[0] + ' → ' + keys[keys.length - 1]) +
    kpi('Prévu total', fmt(P), 'couverture ' + pctS(tCapa, P)) +
    kpi('Contractuel total', fmt(K), pctS(K, tCapa) + ' de la capacité') +
    kpi('Moyenne / période', fmt(tCapa / keys.length), keys.length + ' périodes');
  mkChart('c2a', { type: 'bar', data: { labels: keys, datasets: [
      ...acc.map((s, i) => ({ label: flux[i].k, data: s, backgroundColor: PAL[i % PAL.length], stack: 'c', borderRadius: 2 })),
      { label: 'Prévu', data: tPrev, type: 'line', borderColor: '#1b2440', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, tension: .3 },
      { label: 'Contractuel', data: tContr, type: 'line', borderColor: '#e8590c', borderWidth: 2, pointRadius: 0, tension: .3 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axisY('contacts') } } });
  /* tableau */
  let h = '<thead><tr><th>Période</th><th>Capacité</th><th>Prévu</th><th>Contractuel</th><th>Capa − Prévu</th><th>Couverture</th></tr></thead><tbody>';
  keys.forEach((k, i) => {
    const e = capaTot[i] - tPrev[i];
    h += `<tr><td>${k}</td><td>${fmt(capaTot[i])}</td><td>${fmt(tPrev[i])}</td><td>${fmt(tContr[i])}</td>` +
         `<td class="${e < 0 ? 'neg' : 'pos'}">${fmt(e)}</td><td>${pctS(capaTot[i], tPrev[i])}</td></tr>`;
  });
  $('t2').innerHTML = h + '</tbody>';
}

/* =====================================================================
   P3 — PRÉVU VS PLANIFIÉ
   ===================================================================== */
function prevOfActivity(act, canal, weekIdx, source) {
  const r = D.roadmap.find(x => norm(x.a) === norm(act) && norm(x.c) === norm(canal));
  if (!r) return null;
  return (source === 'contr' ? r.prev : r.capa)[weekIdx] ?? null;
}
function r3() {
  const rowsAll = D.plan.rows;
  if (!rowsAll.length) { $('k3').innerHTML = '<div class="kpi"><div class="lbl">Plan non importé</div><div class="sub">Importez le fichier planifié (date, creneau, flux, prevu, planifie, realise) pour comparer au prévu.</div></div>'; $('t3').innerHTML = ''; mkChart('c3a', { type: 'bar', data: { labels: [], datasets: [] } }); return; }
  const rows = rowsAll.filter(r => inPer('p3', r[0]));
  if (!rows.length) { noPer('p3', 'k3', ['c3a'], 't3'); return; }
  const g = $('s3G').value, source = $('s3S').value, fsel = $('s3F').value;
  const kOf = d => g === 'mois' ? mKey(d) : g === 'semaine' ? wLab(d) : d;
  const keys = [], map = {};
  rows.forEach(r => {
    if (fsel && r[2] !== fsel) return;
    const k = kOf(r[0]);
    if (!(k in map)) { keys.push(k); map[k] = { pl: 0, pv: 0 }; }
    map[k].pl += r[4]; map[k].pv += r[3];
  });
  /* prévu par période : capacitaire journalier ou roadmap hebdo répartie */
  const prevK = keys.map(k => {
    let s = 0;
    rows.forEach(r => {
      if (fsel && r[2] !== fsel) return;
      if (kOf(r[0]) !== k) return;
      const f = D.capa.flux.find(x => x.k === r[2]);
      const a = r[2].split(' ')[1] || r[2], c = r[2].startsWith('Mail') ? 'Mail' : 'Voix';
      if (source === 'capa' && f) {
        const di = D.capa.dates.indexOf(r[0]);
        if (di >= 0) s += f.capa[di] || 0;
      } else {                                        // contractuel : valeur hebdo / 7
        const rm = D.roadmap.find(x => norm(x.a) === norm(a) && norm(x.c) === norm(c));
        if (rm) s += (rm.prev[isoWeek(r[0]) - 1] || 0) / 7;
      }
    });
    return Math.round(s);
  });
  const plK = keys.map(k => Math.round(map[k].pl)), pvK = keys.map(k => Math.round(map[k].pv));
  const TP = prevK.reduce((a, b) => a + b, 0), TL = plK.reduce((a, b) => a + b, 0);
  $('k3').innerHTML =
    kpi('Prévu (' + (source === 'capa' ? 'capacité' : 'contractuel') + ')', fmt(TP), g + (fsel ? ' · ' + fsel : ' · tous flux')) +
    kpi('Planifié', fmt(TL), pctS(TL, TP) + ' du prévu') +
    kpi('Écart planifié − prévu', fmt(TL - TP), TL - TP >= 0 ? 'sur-couverture' : 'sous-couverture', Math.abs(TP) ? Math.abs(TL - TP) / Math.abs(TP) * 100 : 0) +
    kpi('Prévu (fichier plan)', fmt(pvK.reduce((a, b) => a + b, 0)), 'colonne prevu du plan');
  mkChart('c3a', { type: 'bar', data: { labels: keys, datasets: [
      { label: 'Prévu', data: prevK, backgroundColor: '#3b5bdb', borderRadius: 3 },
      { label: 'Planifié', data: plK, backgroundColor: '#f59f00', borderRadius: 3 },
      { label: 'Prévu (plan)', data: pvK, type: 'line', borderColor: '#94a3d8', borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, tension: .3 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 16 } }, y: axisY('contacts') } } });
  let h = '<thead><tr><th>Période</th><th>Prévu</th><th>Planifié</th><th>Écart</th><th>Planifié / prévu</th></tr></thead><tbody>';
  keys.forEach((k, i) => {
    const e = plK[i] - prevK[i];
    h += `<tr><td>${k}</td><td>${fmt(prevK[i])}</td><td>${fmt(plK[i])}</td>` +
         `<td class="${e < 0 ? 'neg' : 'pos'}">${fmt(e)}</td><td>${pctS(plK[i], prevK[i])}</td></tr>`;
  });
  $('t3').innerHTML = h + '</tbody>';
}

/* =====================================================================
   P4 — PLANIFIÉ VS RÉALISÉ (plan : jour/créneau)
   ===================================================================== */
function r4() {
  const rowsAll = D.plan.rows;
  const hint = $('p4Hint');
  hint.textContent = 'Réalisation issue du fichier planifié (colonne « realise » par créneau). '
    + 'Pour le réalisé journalier officiel (DRM), voir l\'onglet « Réalisé » qui recoupe ce planifié.';
  if (!rowsAll.length) { $('k4').innerHTML = '<div class="kpi"><div class="lbl">Plan non importé</div><div class="sub">Importez le fichier planifié pour comparer planifié vs réalisé par créneau.</div></div>'; $('t4').innerHTML = ''; mkChart('c4a', { type: 'bar', data: { labels: [], datasets: [] } }); return; }
  const rows = rowsAll.filter(r => inPer('p4', r[0]));
  if (!rows.length) { noPer('p4', 'k4', ['c4a'], 't4'); return; }
  const g = $('s4G').value, fsel = $('s4F').value;
  const kOf = r => g === 'mois' ? mKey(r[0]) : g === 'semaine' ? wLab(r[0]) : g === 'jour' ? r[0] : r[0] + ' ' + (r[1] || '');
  const keys = [], map = {};
  rows.forEach(r => {
    if (fsel && r[2] !== fsel) return;
    const k = kOf(r);
    if (!(k in map)) { keys.push(k); map[k] = { pl: 0, re: 0, pv: 0 }; }
    map[k].pl += r[4]; map[k].re += r[5]; map[k].pv += r[3];
  });
  keys.sort((a, b) => a < b ? -1 : 1);
  const plK = keys.map(k => Math.round(map[k].pl)), reK = keys.map(k => Math.round(map[k].re)), pvK = keys.map(k => Math.round(map[k].pv));
  const TL = plK.reduce((a, b) => a + b, 0), TR = reK.reduce((a, b) => a + b, 0);
  const taux = keys.map((k, i) => map[k].pl ? Math.round(map[k].re / map[k].pl * 100) : 0);
  const minT = Math.min(...taux), minI = taux.indexOf(minT);
  $('k4').innerHTML =
    kpi('Planifié', fmt(TL), g + (fsel ? ' · ' + fsel : ' · tous flux')) +
    kpi('Réalisé', fmt(TR), pctS(TR, TL) + ' du planifié') +
    kpi('Écart réalisé − planifié', fmt(TR - TL), TR - TL >= 0 ? 'au-dessus du plan' : 'en-deçà du plan', Math.abs(TL) ? Math.abs(TR - TL) / Math.abs(TL) * 100 : 0) +
    kpi('Taux min. sur période', minT + ' %', (keys[minI] || '').slice(0, 16), minT);
  mkChart('c4a', { type: 'bar', data: { labels: keys, datasets: [
      { label: 'Planifié', data: plK, backgroundColor: '#f59f00', borderRadius: 3 },
      { label: 'Réalisé', data: reK, backgroundColor: '#0ca678', borderRadius: 3 },
      { label: 'Prévu', data: pvK, type: 'line', borderColor: '#94a3d8', borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, tension: .3 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' } },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 18, autoSkip: true } }, y: axisY('contacts') } } });
  let h = '<thead><tr><th>Période</th><th>Prévu</th><th>Planifié</th><th>Réalisé</th><th>Écart</th><th>Taux</th></tr></thead><tbody>';
  keys.forEach((k, i) => {
    const e = reK[i] - plK[i];
    const chip = taux[i] >= 90 ? 'g' : taux[i] >= 75 ? 'a' : 'r';
    h += `<tr><td>${k}</td><td>${fmt(pvK[i])}</td><td>${fmt(plK[i])}</td><td>${fmt(reK[i])}</td>` +
         `<td class="${e < 0 ? 'neg' : 'pos'}">${fmt(e)}</td><td><span class="chip ${chip}">${taux[i]} %</span></td></tr>`;
  });
  $('t4').innerHTML = h + '</tbody>';
}
/* ouverture p4 pré-réglée depuis p5 */
function openP4(date) {
  $('s4G').value = 'jour';
  $('s4F').value = '';
  go('p4');
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
  bindPeriod('p1', r1); bindPeriod('p2', r2); bindPeriod('p3', r3);
  bindPeriod('p4', r4); bindPeriod('p5', r5);
  $('w1Act').addEventListener('change', r1);
  $('s2G').addEventListener('change', r2); $('s2F').addEventListener('change', r2);
  $('s3G').addEventListener('change', r3); $('s3S').addEventListener('change', r3); $('s3F').addEventListener('change', r3);
  $('s4G').addEventListener('change', r4); $('s4F').addEventListener('change', r4);
  RENDERS.p1 = r1; RENDERS.p2 = r2; RENDERS.p3 = r3; RENDERS.p4 = r4;
  bind5();
  bind6();
  bind7();
  boot2();
}
function boot2() { /* complété en partie 3 (page 5) */ }

/* =====================================================================
   P5 — RÉALISÉ (DRM : Traités / Reçus / Traités 60s par flux, par jour)
   ===================================================================== */
const tauxChip = t => t >= 65 ? 'g' : t >= 50 ? 'a' : 'r';   /* taux < 60 s (qualité) */
const tauxReal = t => t >= 95 ? 'g' : t >= 80 ? 'a' : 'r';   /* réalisé / planifié */
const tauxCls  = t => t >= 65 ? 'good' : t >= 50 ? 'warn' : 'bad';

function r5() {
  const R = D.real;
  const has = R.dates.length > 0;
  $('p5body').style.display = has ? '' : 'none';
  $('p5empty').style.display = has ? 'none' : '';
  if (!has) { $('w5Src').textContent = 'Réalisé : à importer'; return; }

  const fl = $('s5F').value;                                     // '' = tous
  const idx = R.dates.map((d, i) => [d, i]).filter(([d]) => inPer('p5', d)).map(([, i]) => i);
  if (!idx.length) { noPer('p5', 'k5', ['c5a', 'c5b', 'c5c'], 't5'); $('t5rel').innerHTML = ''; $('t5note').textContent = '';
    $('w5Src').textContent = 'Réalisé : aucun jour sur ' + rangeLbl(...perRange('p5')); return; }
  const rl = rangeLbl(...perRange('p5'));

  const serie = k => idx.map(i => fl ? R.f[fl][k][i] : RFLOW.reduce((s, f) => s + R.f[f][k][i], 0));
  const rec = serie('r'), tr = serie('t'), s60 = serie('s');
  const tR = rec.reduce((a, b) => a + b, 0), tT = tr.reduce((a, b) => a + b, 0), tS = s60.reduce((a, b) => a + b, 0);
  const taux = tT ? Math.round(tS / tT * 100) : 0;
  const days = idx.length;
  let lastJ = idx.length - 1;
  for (let j = idx.length - 1; j >= 0; j--) if (tr[j] > 0 || rec[j] > 0) { lastJ = j; break; }

  /* ----- KPIs ----- */
  $('k5').innerHTML =
    kpi('Reçus', fmt(tR), rl + ' · moy. ' + fmt(tR / days) + ' / jour' + (fl ? ' · ' + fl : ' · tous flux')) +
    kpi('Traités', fmt(tT), 'couverture ' + pctS(tT, tR) + ' des reçus',
        tR ? Math.min(100, tT / tR * 100) : 0) +
    kpi('Traités < 60 s', fmt(tS), pctS(tS, tT) + ' des traités') +
    `<div class="kpi ${tauxCls(taux)}"><div class="lbl">Taux &lt; 60 s</div><div class="val">${taux} %</div>` +
    `<div class="sub">objectif indicatif 65 %</div><div class="bar"><i style="width:${taux}%;background:${taux >= 65 ? '#2f9e44' : taux >= 50 ? '#f59f00' : '#e03131'}"></i></div></div>` +
    kpi('Écart reçus − traités', fmt(tR - tT), 'non traités / restes sur la période');

  /* ----- graphique journalier ----- */
  const lbls = idx.map(i => { const dt = new Date(R.dates[i] + 'T00:00:00'); return dt.getDate(); });
  const tJour = tr.map((t, j) => t ? Math.round(s60[j] / t * 100) : 0);
  mkChart('c5a', { data: { labels: lbls, datasets: [
      { type: 'bar', label: 'Reçus', data: rec, backgroundColor: 'rgba(59,91,219,.35)', borderRadius: 3 },
      { type: 'bar', label: 'Traités', data: tr, backgroundColor: '#3b5bdb', borderRadius: 3 },
      { type: 'line', label: 'Taux < 60 s', data: tJour, yAxisID: 'y1', borderColor: '#e8590c',
        backgroundColor: 'transparent', borderWidth: 2, pointRadius: 2, tension: .3 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => c.dataset.label === 'Taux < 60 s'
          ? ' Taux < 60 s : ' + c.parsed.y + ' %' : ' ' + c.dataset.label + ' : ' + fmt(c.parsed.y) } } },
      scales: { x: { grid: { display: false }, title: { display: true, text: rl, font: { size: 10.5 } } },
                y: axisY('contacts / jour'), y1: axisP() } } });

  /* ----- cumulé du mois ----- */
  const cRec = cum(rec), cTr = cum(tr);
  mkChart('c5b', { type: 'line', data: { labels: lbls, datasets: [
      { label: 'Reçus cumulés', data: cRec, borderColor: '#7048e8', backgroundColor: 'rgba(112,72,232,.08)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0 },
      { label: 'Traités cumulés', data: cTr, borderColor: '#0ca678', backgroundColor: 'rgba(12,166,120,.08)', fill: true, tension: .3, borderWidth: 2, pointRadius: 0 },
      { label: '< 60 s cumulés', data: cum(s60), borderColor: '#f59f00', backgroundColor: 'transparent', borderDash: [5, 4], tension: .3, borderWidth: 2, pointRadius: 0 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom' },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmt(c.parsed.y) } } },
      scales: { x: { grid: { display: false }, title: { display: true, text: 'Cumulé — ' + rl, font: { size: 10.5 } } },
                y: axisY('cumul') } } });

  /* ----- répartition par flux ----- */
  const byFlux = RFLOW.map(f => idx.reduce((s, i) => s + R.f[f].t[i], 0));
  mkChart('c5c', { type: 'doughnut',
    data: { labels: RFLOW, datasets: [{ data: byFlux, backgroundColor: RFLOW.map(f => RCOL[f]), borderWidth: 2, borderColor: '#fff' }] },
    options: { maintainAspectRatio: false, cutout: '58%',
      plugins: { legend: { position: 'right' },
        tooltip: { callbacks: { label: c => ' ' + c.label + ' : ' + fmt(c.parsed) + ' (' + pctS(c.parsed, byFlux.reduce((a, b) => a + b, 0)) + ')' } } } } });

  /* ----- relation avec l'onglet Planifié vs réalisé ----- */
  const day = $('s5Day').value;
  if (!day || !idx.includes(R.dates.indexOf(day))) {
    $('s5Day').value = R.dates[idx[lastJ]];
  }
  render5rel();
  $('w5Src').textContent = 'Réalisé : ' + (D.meta.real || R.file) + ' · ' + R.dates[0] + ' → ' + R.dates[R.dates.length - 1] + ' (' + R.dates.length + ' j)';

  /* ----- tableau journalier ----- */
  let h = '<thead><tr><th>Sem.</th><th>Jour</th><th>Date</th><th>Reçus</th><th>Traités</th><th>&lt; 60 s</th><th>Taux &lt; 60 s</th><th>Écart</th></tr></thead><tbody>';
  idx.forEach((i, j) => {
    const d = R.dates[i], t = tr[j];
    const todo = t === 0 && rec[j] === 0;
    const tx = t ? Math.round(s60[j] / t * 100) : 0;
    const e = rec[j] - t;
    h += `<tr data-d="${d}" class="${todo ? 'todo' : ''}${d === $('s5Day').value ? ' sel' : ''}">` +
         `<td>S${R.sem[i] || isoWeek(d)}</td><td>${jJours(d)}</td><td>${dLab(d)}</td>` +
         `<td>${fmt(rec[j])}</td><td>${fmt(t)}</td><td>${fmt(s60[j])}</td>` +
         `<td><span class="chip ${tauxChip(tx)}">${t ? tx + ' %' : '—'}</span></td>` +
         `<td class="${e < 0 ? 'neg' : 'pos'}">${fmt(e)}</td></tr>`;
  });
  h += `</tbody><tfoot><tr><td colspan="3">Total période${fl ? ' · ' + fl : ''} (${days} j)</td><td>${fmt(tR)}</td><td>${fmt(tT)}</td><td>${fmt(tS)}</td><td>${tT ? taux + ' %' : '—'}</td><td>${fmt(tR - tT)}</td></tr></tfoot>`;
  $('t5').innerHTML = h;
}

/* ----- bloc « Planifié vs Réalisé » du jour sélectionné ----- */
function render5rel() {
  const R = D.real, day = $('s5Day').value;
  $('s5Day').value = day;
  if (!day) { $('t5rel').innerHTML = ''; $('t5note').textContent = ''; return; }
  const planRows = (D.plan.rows || []).filter(r => r[0] === day);
  const planSum = {};                                             // flux -> planifié du jour
  planRows.forEach(r => planSum[r[2]] = (planSum[r[2]] || 0) + r[4]);
  const rows = [];
  RFLOW.forEach(f => {
    const ix = R.dates.indexOf(day);
    const t = ix >= 0 ? R.f[f].t[ix] : 0, r = ix >= 0 ? R.f[f].r[ix] : 0;
    const pk = 'Voix ' + f.charAt(0) + f.slice(1).toLowerCase();  // HYPER -> Voix Hyper
    const pl = planSum[pk] || 0;
    delete planSum[pk];
    if (!pl && !t && !r) return;
    rows.push([f, pl, t, r]);
  });
  Object.entries(planSum).forEach(([k, pl]) => {                  // flux planifiés sans réalisé DRM (Mail…)
    if (pl > 0) rows.push([k, pl, null, null]);
  });
  rows.sort((a, b) => (b[1] + b[2]) - (a[1] + a[2]));
  let h = '<thead><tr><th>Flux</th><th>Planifié</th><th>Réalisé (DRM)</th><th>Écart</th><th>Taux</th></tr></thead><tbody>';
  let tp = 0, tt = 0;
  rows.forEach(([f, pl, t]) => {
    const real = t == null ? '—' : fmt(t);
    const e = t == null ? null : t - pl;
    const tx = (t != null && pl > 0) ? Math.round(t / pl * 100) : null;
    if (t != null) { tp += pl; tt += t; }
    h += `<tr><td><span class="dot" style="background:${t != null ? RCOL[f] || '#94a3d8' : '#c8cee0'}"></span>${f}</td>` +
         `<td>${fmt(pl)}</td><td>${real}</td>` +
         `<td class="${e == null ? '' : e < 0 ? 'neg' : 'pos'}">${e == null ? '—' : fmt(e)}</td>` +
         `<td>${tx == null ? '—' : `<span class="chip ${tauxReal(Math.min(100, tx))}">${tx} %</span>`}</td></tr>`;
  });
  if (!rows.length) h += '<tr><td colspan="5" style="text-align:center;color:#6b7594">Aucune donnée ce jour</td></tr>';
  h += '</tbody>';
  if (rows.some(r => r[2] != null)) h += `<tfoot><tr><td>Total voix</td><td>${fmt(tp)}</td><td>${fmt(tt)}</td><td class="${tt - tp < 0 ? 'neg' : 'pos'}">${fmt(tt - tp)}</td><td>${tp ? Math.round(tt / tp * 100) + ' %' : '—'}</td></tr></tfoot>`;
  $('t5rel').innerHTML = h;

  $('t5note').textContent = D.plan.rows.length
    ? 'Planifié = somme des créneaux du fichier plan pour ce jour · Réalisé = traités du DRM. '
      + 'Le détail par créneau du réalisé planifié se trouve dans l\'onglet « Planifié vs réalisé ».'
    : 'Importez le fichier planifié (plan) pour activer la comparaison Planifié vs Réalisé de cette journée.';
  /* surligner la ligne du tableau journalier */
  document.querySelectorAll('#t5 tbody tr').forEach(tr => tr.classList.toggle('sel', tr.dataset.d === day));
}

function bind5() {
  $('s5F').addEventListener('change', r5);
  $('s5Day').addEventListener('change', render5rel);
  $('b5Go4').addEventListener('click', () => openP4($('s5Day').value));
  $('t5').addEventListener('click', e => {
    const trE = e.target.closest('tr[data-d]');
    if (!trE) return;
    $('s5Day').value = trE.dataset.d;
    render5rel();
  });
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
