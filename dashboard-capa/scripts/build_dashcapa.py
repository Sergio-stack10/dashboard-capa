# -*- coding: utf-8 -*-
"""
Génère work/app/data/dashcapa.json depuis « Données DASHBOARD CAPA AUCHAN.xlsx » :
  - plan   : agrégat planning (dates × créneaux 30 min) + lignes brutes prod (skills)
  - skills : correspondance agent -> compétence (feuille Skills)
  - logR   : heures de log réalisées (EXT_Agent) par jour × canal
  - real   : réalisé voix (EXT_Entrant : Reçus / Traité / Traité -60s) par jour × flux
  - dmt    : DMT (EXT_Entrant : communication + after-call) par jour × flux
  - mail   : réalisé mail (EXT_Email) par jour × file
Met aussi à jour data/meta dans data.json.
Cette script est la RÉFÉRENCE de la logique implémentée ensuite en JS (impDashCapa).
"""
import openpyxl, json, re, datetime
from collections import OrderedDict

SRC = "Données DASHBOARD CAPA AUCHAN.xlsx (fichier source à côté du script)"
OUT = "../data/dashcapa.json"
DATA = "../data/data.json"

# ---------- helpers (miroir du JS) ----------
def norm(s):
    if s is None: return ''
    s = str(s).lower()
    import unicodedata
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).strip()

def iso_d(v):
    if v is None or v == '': return ''
    if isinstance(v, datetime.datetime): return v.strftime('%Y-%m-%d')
    if isinstance(v, datetime.date): return v.strftime('%Y-%m-%d')
    if isinstance(v, (int, float)) and v > 20000:
        return (datetime.datetime(1899, 12, 30) + datetime.timedelta(days=int(v))).strftime('%Y-%m-%d')
    s = str(v).strip()
    m = re.match(r'^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})', s)
    if m: return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.match(r'^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$', s)
    if m:
        y = int(m.group(3));  y += 2000 if y < 100 else 0
        return f"{y:04d}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"
    return ''

def n2(v):
    if v is None: return 0.0
    if isinstance(v, (int, float)): return float(v)
    try: return float(str(v).replace(',', '.'))
    except Exception: return 0.0

def tmin(v):                       # -> minutes (float) ou None
    if v is None or v == '': return None
    if isinstance(v, datetime.datetime): return v.hour * 60 + v.minute + v.second / 60
    if isinstance(v, (int, float)):
        return round((v % 1) * 1440) if 0 <= v < 1 else None
    m = re.match(r'^(\d{1,2})[:hH](\d{2})(?::(\d{2}))?', str(v).strip())
    if not m: return None
    return int(m.group(1)) * 60 + int(m.group(2)) + (int(m.group(3)) / 60 if m.group(3) else 0)

def thrs(v):                       # durée -> heures
    if v is None or v == '': return 0.0
    if isinstance(v, datetime.datetime): return v.hour + v.minute / 60 + v.second / 3600
    if isinstance(v, datetime.time): return v.hour + v.minute / 60 + v.second / 3600
    if isinstance(v, (int, float)): return v * 24 if v <= 1.5 else v
    m = re.match(r'^(\d{1,2}):(\d{2})(?::(\d{2}))?', str(v).strip())
    if not m: return 0.0
    return int(m.group(1)) + int(m.group(2)) / 60 + (int(m.group(3)) / 3600 if m.group(3) else 0)

def ov(a1, b1, a2, b2): return max(0.0, min(b1, b2) - max(a1, a2))
def r2(v): return round(v, 2)
def r3(v): return round(v, 3)

# ---------- compétences ----------
LOT2SKILL = {'lot 1 & lot 2': 'HYPER/DRIVE', 'lot 3': 'SAV', 'lot 4': 'CHAT', 'lot unique': 'ALL'}
def lot_to_skill(lot):
    s = norm(lot)
    for k, v in LOT2SKILL.items():
        if s.startswith(k): return v
    return ''
def act_skill(acts):               # colonne « Activités » de la feuille Skills
    s = norm(acts)
    if 'all' in s: return 'ALL'
    if 'hyper' in s or 'drive' in s: return 'HYPER/DRIVE'
    if 'sav' in s: return 'SAV'
    if 'chat' in s: return 'CHAT'
    return ''

# répartition par compétence : [activité, canal, part]
CH_ACTS = {'PHONE': ['Hyper', 'C2E', 'AFR', 'Drive', 'SAV', 'Direct'],
           'MAIL': ['Hyper', 'AFR', 'Drive'], 'CHAT': ['Chat', 'Borne/LSA']}
def skill_weights(sk):
    if sk == 'HYPER/DRIVE':
        return [['Hyper', 'PHONE', .25], ['Drive', 'PHONE', .25], ['Hyper', 'MAIL', .25], ['Drive', 'MAIL', .25]]
    if sk == 'SAV':      return [['SAV', 'PHONE', 1]]
    if sk == 'CHAT':     return [['Chat', 'CHAT', 1]]
    if sk == 'ALL':
        combos = [[a, c] for c in ['PHONE', 'MAIL', 'CHAT'] for a in CH_ACTS[c]]
        w = round(1 / len(combos), 6)
        return [[a, c, w] for a, c in combos]
    return []

# ---------- ouverture ----------
wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
TODAY = '2026-11-12'

# ================= SKILLS =================
skills_by = {}
ws = wb['Skills']
for row in ws.iter_rows(min_row=2, max_col=7, values_only=True):
    lot, wd, paie, nom, pre, odigo, acts = row
    sk = act_skill(acts) or lot_to_skill(lot)
    if not sk: continue
    info = {'sk': sk, 'lot': str(lot or '')}
    if wd is not None and str(wd).strip(): skills_by['wd:' + str(wd).strip()] = info
    if odigo: skills_by['io:' + norm(odigo)] = info
print('Skills :', len([k for k in skills_by if k.startswith('wd:')]), 'agents')

# ================= PLANNING =================
ws = wb['Planning']
head = None
for row in ws.iter_rows(min_row=1, max_row=1, max_col=25, values_only=True):
    head = [norm(v) for v in row]
def col(nm, alts=()):
    if nm in head: return head.index(nm)
    for a in alts:
        if a in head: return head.index(a)
    return -1
cD, cSt, cAg, cCp, cWd = col('date'), col('statut'), col('log vonage', ['agent']), col('competences'), col('workday')
cSI, cSO = col('shift in', ['debut de shift']), col('fin de shift', ['shift out'])
cR1, cR2, cHP, cFm = col('debut pause repas'), col('fin pause repas'), col('hp'), col('total fim')

rows_all, prod_rows = [], []
for row in ws.iter_rows(min_row=2, max_col=25, values_only=True):
    row = tuple(row) + (None,) * (25 - len(row))
    d = iso_d(row[cD])
    sin, sout = tmin(row[cSI] if cSI >= 0 else None), tmin(row[cSO] if cSO >= 0 else None)
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', d) or sin is None or sout is None: continue
    if norm(row[cSt] if cSt >= 0 else '') != 'planifie': continue
    if sout <= sin: sout += 1440
    hp = thrs(row[cHP] if cHP >= 0 else 0); fim = thrs(row[cFm] if cFm >= 0 else 0)
    comp = norm(row[cCp] if cCp >= 0 else '')
    wd = str(row[cWd]).strip() if row[cWd] is not None else ''
    ag = str(row[cAg] if cAg >= 0 else '') or ''
    mio = re.search(r'web_pst42_\d+', norm(ag))
    sk = (skills_by.get('wd:' + wd) or {}).get('sk') or \
         (skills_by.get('io:' + mio.group(0)) if mio else None) and skills_by['io:' + mio.group(0)]['sk'] or \
         lot_to_skill(comp)
    fimrow = comp == 'fim' or (fim > 0 and hp > 0 and fim >= hp - 0.01)
    r = {'d': d, 'ag': ag, 'wd': wd, 'lot': comp, 'sk': sk, 'fimrow': fimrow,
         'sin': sin, 'sout': sout, 'r1': tmin(row[cR1] if cR1 >= 0 else None),
         'r2': tmin(row[cR2] if cR2 >= 0 else None), 'hp': r2(hp), 'fim': r2(fim)}
    rows_all.append(r)
    if not fimrow: prod_rows.append(r)

# --- agrégat planning (miroir planAgg) ---
pr = rows_all
dates = sorted(set(r['d'] for r in pr))
g0 = int(min(r['sin'] for r in pr) // 30) * 30
g1 = -(-int(max(r['sout'] for r in pr) // 30)) * 30
slots = list(range(g0, g1, 30))
slot_lab = lambda t: f"{t//60:02d}:{t%60:02d}"
by = {}
for r in pr: by.setdefault(r['d'], []).append(r)
m, day = {'prod': {}, 'fim': {}, 'pres': {}}, {}
for d in dates:
    prod = [0.0] * len(slots); fim = [0.0] * len(slots); pres = [0.0] * len(slots)
    hp = fimh = rep = 0.0; n = nf = 0; ags = []
    for r in by[d]:
        has_rep = r['r1'] is not None and r['r2'] is not None and r['r2'] > r['r1']
        rep += (ov(r['r1'], r['r2'], 0, 1440) / 60) if has_rep else 0
        hp += r['hp']; fimh += r['fim']; n += 1; ags.append(r['ag'])
        if r['fimrow']: nf += 1
        for i, s in enumerate(slots):
            x = ov(s, s + 30, r['sin'], r['sout']) - (ov(s, s + 30, r['r1'], r['r2']) if has_rep else 0)
            if x <= 0: continue
            w = x / 30
            pres[i] += w
            if r['fimrow']: fim[i] += w
            else: prod[i] += w
    m['prod'][d] = [r3(v) for v in prod]; m['fim'][d] = [r3(v) for v in fim]; m['pres'][d] = [r3(v) for v in pres]
    day[d] = {'plan': n, 'fim': nf, 'hp': r2(hp), 'hprod': r2(max(0, hp - fimh)), 'fimh': r2(fimh),
              'repas': r2(rep), 'ag': ags}
plan = {'meta': {'file': 'Données DASHBOARD CAPA AUCHAN.xlsx', 'maj': TODAY,
                 'agents': len(set(r['ag'] for r in pr))},
        'dates': dates, 'slots': [slot_lab(t) for t in slots], 'm': m, 'day': day,
        'rows': prod_rows}
fim_agents = set(r['ag'] for r in pr if r['fimrow'])
print('Planning :', len(dates), 'jours', len(slots), 'créneaux', len(set(r['ag'] for r in pr)), 'agents',
      '| HP Σ =', r2(sum(day[d]['hp'] for d in dates)), 'h | hors FIM =', r2(sum(day[d]['hprod'] for d in dates)), 'h',
      '| agents FIM exclus du réalisé :', len(fim_agents))

# ================= EXT_AGENT -> logR =================
PROD_ACT = lambda s: s.startswith('busy') or s in ('wrap up', 'hold', 'chat', 'panier', 'transfer in', 'fintecture', 'courrier')
ws = wb['EXT_Agent']
lr_dates, lr = {}, {'PHONE': {}, 'CHAT': {}}
skipped = 0
for row in ws.iter_rows(min_row=2, max_col=10, values_only=True):
    row = tuple(row) + (None,) * (10 - len(row))   # lignes courtes
    d = iso_d(row[1]); act = norm(row[6]); chan = norm(row[9]).upper()
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', d) or not PROD_ACT(act): continue
    ag = str(row[2] or '')
    if ag in fim_agents: skipped += 1; continue      # agents FIM = hors prod Auchan
    h = thrs(row[5])                                # Duration (col 5) : fraction, time ou texte
    if chan not in ('PHONE', 'CHAT'): chan = 'PHONE'
    lr_dates[d] = 1
    lr[chan][d] = lr[chan].get(d, 0) + h
print('EXT_Agent : lignes FIM ignorées =', skipped)
lr_dates = sorted(lr_dates)
logR = {'meta': {'file': 'Données DASHBOARD CAPA AUCHAN.xlsx', 'maj': TODAY}, 'dates': lr_dates,
        'h': {'PHONE': [r2(lr['PHONE'].get(d, 0)) for d in lr_dates],
              'CHAT': [r2(lr['CHAT'].get(d, 0)) for d in lr_dates]}}
logR['h']['tot'] = [r2(a + b) for a, b in zip(logR['h']['PHONE'], logR['h']['CHAT'])]
print('logR :', len(lr_dates), 'jours | total', r2(sum(logR['h']['tot'])), 'h (PHONE',
      r2(sum(logR['h']['PHONE'])), '/ CHAT', r2(sum(logR['h']['CHAT'])), ')')

# ================= EXT_ENTRANT -> real + dmt =================
def flux_of(q):
    s = norm(q).upper()
    mm = re.match(r'^V\s+([A-Z0-9]+)', s)
    tok = mm.group(1) if mm else (re.sub(r'-\d+$', '', s).strip() or '')
    if tok.startswith('BARCELONE'): return 'BCN'
    return tok or 'AUTRE'
ws = wb['EXT_Entrant']
r_dates, flows = set(), {}
for row in ws.iter_rows(min_row=2, max_col=27, values_only=True):
    row = tuple(row) + (None,) * (27 - len(row))
    q = row[1] or row[2]
    if not q: continue
    d = iso_d(row[14])                     # Date de création
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', d): continue
    fl = flux_of(q)
    rep = norm(row[4]) == 'vrai'
    t60 = n2(row[5])
    com = n2(row[13]); acw = n2(row[9])
    rec = n2(row[26]); tra = n2(row[25])
    r_dates.add(d)
    F = flows.setdefault(fl, {'r': {}, 't': {}, 's': {}, 'n': {}, 'com': {}, 'acw': {}})
    F['r'][d] = F['r'].get(d, 0) + (rec if rec else (1 if rep else 0))
    F['t'][d] = F['t'].get(d, 0) + tra
    F['s'][d] = F['s'].get(d, 0) + t60
    if rep:
        F['n'][d] = F['n'].get(d, 0) + 1
        F['com'][d] = F['com'].get(d, 0) + com
        F['acw'][d] = F['acw'].get(d, 0) + acw
rd = sorted(r_dates)
rank = {f: i for i, f in enumerate(['HYPER', 'C2E', 'AFR', 'DRIVE', 'SAV'])}
fl_order = sorted(flows, key=lambda f: (rank.get(f, 9), f))
real = {'meta': {'file': 'Données DASHBOARD CAPA AUCHAN.xlsx', 'maj': TODAY},
        'dates': rd, 'flows': fl_order,
        'f': {f: {'t': [flows[f]['t'].get(d, 0) for d in rd], 'r': [flows[f]['r'].get(d, 0) for d in rd],
                  's': [flows[f]['s'].get(d, 0) for d in rd]} for f in fl_order}}
dmt = {'meta': {'file': 'Données DASHBOARD CAPA AUCHAN.xlsx', 'maj': TODAY},
       'dates': rd, 'flows': fl_order,
       'f': {f: {'n': [flows[f]['n'].get(d, 0) for d in rd], 'com': [r2(flows[f]['com'].get(d, 0)) for d in rd],
                 'acw': [r2(flows[f]['acw'].get(d, 0)) for d in rd], 'lost': [0] * len(rd)} for f in fl_order}}
print('real/dmt :', len(rd), 'jours ·', fl_order, '| traités Σ =',
      {f: sum(real['f'][f]['t']) for f in fl_order})

# ================= EXT_EMAIL -> mail =================
ws = wb['EXT_Email']
m_dates, mflows = set(), {}
for row in ws.iter_rows(min_row=2, max_col=8, values_only=True):
    row = tuple(row) + (None,) * (8 - len(row))
    fl = row[4]
    if not fl: continue
    d = iso_d(row[6]) or iso_d(row[7])
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', d): continue
    st = norm(row[1]); dele = n2(row[2])
    m_dates.add(d)
    F = mflows.setdefault(str(fl), {'rec': {}, 'tr': {}, 't60': {}, 'del': {}})
    F['rec'][d] = F['rec'].get(d, 0) + 1
    if st.startswith('ferm') or n2(st) == 1:
        F['tr'][d] = F['tr'].get(d, 0) + 1
        F['del'][d] = F['del'].get(d, 0) + dele
        if 0 < dele < 60: F['t60'][d] = F['t60'].get(d, 0) + 1
md = sorted(m_dates)
mfl = sorted(mflows, key=lambda f: (rank.get(norm(f).replace('répartition ', '').replace('auchan ', '').upper(), 9), f))
mail = {'meta': {'file': 'Données DASHBOARD CAPA AUCHAN.xlsx', 'maj': TODAY},
        'dates': md, 'flows': mfl,
        'f': {f: {'rec': [mflows[f]['rec'].get(d, 0) for d in md], 'tr': [mflows[f]['tr'].get(d, 0) for d in md],
                  't60': [mflows[f]['t60'].get(d, 0) for d in md], 'del': [mflows[f]['del'].get(d, 0) for d in md]}
              for f in mfl}}
print('mail :', len(md), 'jours ·', mfl, '| reçus Σ =', {f: sum(mail['f'][f]['rec']) for f in mfl})

wb.close()

# ================= écriture =================
out = {'plan': plan, 'skills': {'meta': {'file': 'Données DASHBOARD CAPA AUCHAN.xlsx', 'maj': TODAY}, 'by': skills_by},
       'logR': logR, 'real': real, 'dmt': dmt, 'mail': mail}
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print('\nécrit', OUT)

# data.json : meta seule (le reste se reconstruit au boot)
try:
    dj = json.load(open(DATA))
except Exception:
    dj = {}
dj['meta'] = {'maj': TODAY, 'rm2': 'RM_Auchan_S46.xlsm', 'plan': 'Données DASHBOARD CAPA AUCHAN.xlsx',
              'prev': '04_Webhelp_2026.xlsx', 'real': 'Données DASHBOARD CAPA AUCHAN.xlsx',
              'dmt': 'Données DASHBOARD CAPA AUCHAN.xlsx', 'mail': 'Données DASHBOARD CAPA AUCHAN.xlsx'}
json.dump(dj, open(DATA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('écrit', DATA, '->', dj['meta'])
