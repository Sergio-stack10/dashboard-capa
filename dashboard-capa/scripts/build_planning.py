#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Génère data/planning.json depuis la feuille « Planning » de Planning AUCHAN.xlsx.
Algorithme (identique à celui implémenté dans app.js impPlanning) :
  - lignes Statut = « Planifié » uniquement
  - présence par créneau 30 min = recouvrement [Shift In, Shift Out) − recouvrement [Pause repas)
  - FIM (Compétences = FIM ou Total FIM ≥ HP) = hors prod → compté à part, 0 en prod
  - allaitement déduit proportionnellement : facteur (HP − allaitement) / HP
  - HP déjà hors pause repas ; heures prod = HP − Total FIM − Allaitement
"""
import openpyxl, json, re, datetime, math
from collections import defaultdict

import sys
XLSX = sys.argv[1] if len(sys.argv) > 1 else 'Planning AUCHAN.xlsx'
OUT  = sys.argv[2] if len(sys.argv) > 2 else 'data/planning.json'

def norm(s):
    if s is None: return ''
    s = str(s).lower()
    s = ''.join(c for c in __import__('unicodedata').normalize('NFD', s) if __import__('unicodedata').category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).strip()

def tomin(v):
    """valeur temps -> minutes (float) ou None"""
    if v is None: return None
    if isinstance(v, datetime.time):  return v.hour * 60 + v.minute + v.second / 60
    if isinstance(v, datetime.datetime): return v.hour * 60 + v.minute + v.second / 60
    if isinstance(v, (int, float)):
        if 0 <= v < 1: t = round((v % 1) * 1440); return t
        return None
    s = str(v).strip()
    m = re.match(r'^(\d{1,2})[:hH](\d{2})(?::(\d{2}))?$', s)
    if m: return int(m.group(1)) * 60 + int(m.group(2)) + (int(m.group(3)) if m.group(3) else 0) / 60
    return None

def toH(v):
    """durée -> heures (float) ; 0 si vide"""
    if v is None or v == '': return 0.0
    if isinstance(v, datetime.time): return v.hour + v.minute / 60 + v.second / 3600
    if isinstance(v, datetime.datetime): return v.hour + v.minute / 60 + v.second / 3600
    if isinstance(v, (int, float)): return v * 24 if v <= 1.5 else float(v)
    m = re.match(r'^(\d{1,2}):(\d{2})(?::(\d{2}))?$', str(v).strip())
    if m: return int(m.group(1)) + int(m.group(2)) / 60 + (int(m.group(3)) if m.group(3) else 0) / 3600
    return 0.0

def isod(v):
    if isinstance(v, datetime.datetime): return v.strftime('%Y-%m-%d')
    if isinstance(v, datetime.date): return v.strftime('%Y-%m-%d')
    s = str(v or '').strip()
    m = re.match(r'^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})', s)
    if m: return '%s-%02d-%02d' % (m.group(1), int(m.group(2)), int(m.group(3)))
    return ''

def ov(a, b, s, e):
    """recouvrement (min) entre [a,b) et [s,e)"""
    return max(0.0, min(b, e) - max(a, s))

wb = openpyxl.load_workbook(XLSX, data_only=True)
sn = next((n for n in wb.sheetnames if norm(n) == 'planning'), None)
ws = wb[sn]
rows = list(ws.iter_rows(values_only=True))
hdr = [(str(x).strip().lower() if x is not None else '') for x in rows[0]]
idx = {h: i for i, h in enumerate(hdr) if h}

def g(r, name):
    i = idx.get(name)
    return r[i] if i is not None else None

parsed, skipped = [], 0
for r in rows[1:]:
    if r is None or all(x is None for x in r): continue
    if norm(g(r, 'nice id')) in ('template📌', 'template'): continue
    if norm(g(r, 'statut')) != 'planifie': skipped += 1; continue
    d = isod(g(r, 'date'))
    sin, sout = tomin(g(r, 'shift in')), tomin(g(r, 'shift out'))
    if not d or sin is None or sout is None: skipped += 1; continue
    if sout <= sin: sout += 24 * 60                      # shift à cheval sur minuit
    r1, r2 = tomin(g(r, 'debut pause repas')), tomin(g(r, 'fin pause repas'))
    hp, alla, fim = toH(g(r, 'hp')), toH(g(r, 'allaitement')), toH(g(r, 'total fim'))
    comp = norm(g(r, 'competences'))
    fimrow = (comp == 'fim') or (fim > 0 and hp > 0 and fim >= hp - 0.01)
    repmin = (r2 - r1) if (r1 is not None and r2 is not None and r2 > r1) else 0
    if abs((sout - sin - repmin) - hp * 60) > 3:
        print('WARN hp != shift - repas :', d, g(r, 'log vonage'),
              'shift', round((sout - sin - repmin) / 60, 2), 'hp', hp)
    parsed.append(dict(d=d, ag=str(g(r, 'log vonage') or ''), fimrow=fimrow,
                       sin=sin, sout=sout, r1=r1, r2=r2, hp=hp, alla=alla, fim=fim))

print('lignes planifiées :', len(parsed), '| ignorées :', skipped)
dates = sorted(set(r['d'] for r in parsed))
g0 = math.floor(min(r['sin'] for r in parsed) / 30) * 30
g1 = math.ceil(max(r['sout'] for r in parsed) / 30) * 30
slots = list(range(g0, g1, 30))
print('dates :', dates[0], '->', dates[-1], '| créneaux :', len(slots), '(', '%02d:%02d' % (g0 // 60, g0 % 60), '->', '%02d:%02d' % (g1 // 60, g1 % 60), ')')

byday = defaultdict(list)
for r in parsed: byday[r['d']].append(r)

mprod, mfim, mpres, dayd = {}, {}, {}, {}
for d in dates:
    prod = [0.0] * len(slots); fim = [0.0] * len(slots); pres = [0.0] * len(slots)
    hpS = allaS = fimhS = repS = 0.0; n = nF = 0; ags = []
    for r in byday[d]:
        rep = ov(r['r1'], r['r2'], 0, 24 * 60) if (r['r1'] is not None and r['r2'] is not None and r['r2'] > r['r1']) else 0.0
        repS += rep / 60; hpS += r['hp']; allaS += r['alla']; fimhS += r['fim']
        n += 1; ags.append(r['ag'])
        if r['fimrow']: nF += 1
        factor = max(0.0, (r['hp'] - r['alla']) / r['hp']) if r['hp'] > 0 else 1.0
        for i, s in enumerate(slots):
            x = ov(s, s + 30, r['sin'], r['sout']) - ov(s, s + 30, r['r1'], r['r2'] if r['r2'] is not None else 0)
            if x <= 0: continue
            w = x / 30
            pres[i] += w
            if r['fimrow']: fim[i] += w
            else: prod[i] += w * factor
    hprod = max(0.0, hpS - fimhS - allaS)
    # validation : Σ créneaux prod × 0,5 h ≈ heures prod (1 créneau = 0,5 h)
    if abs(sum(prod) / 2 - hprod) > 0.05:
        print('WARN', d, 'Σ prod', round(sum(prod), 2), '≠ hprod', round(hprod, 2))
    mprod[d] = [round(v, 3) for v in prod]
    mfim[d]  = [round(v, 3) for v in fim]
    mpres[d] = [round(v, 3) for v in pres]
    dayd[d] = dict(plan=n, fim=nF, hp=round(hpS, 2), hprod=round(hprod, 2), alla=round(allaS, 2),
                   fimh=round(fimhS, 2), repas=round(repS, 2), ag=ags)

out = dict(meta=dict(file='Planning AUCHAN.xlsx', maj='2026-11-11', agents=len(set(r['ag'] for r in parsed)),
                     grid=['%02d:%02d' % (s // 60, s % 60) for s in [slots[0], slots[-1] + 30]]),
           dates=dates,
           slots=['%02d:%02d' % (s // 60, s % 60) for s in slots],
           m=dict(prod=mprod, fim=mfim, pres=mpres), day=dayd)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print('écrit', OUT, len(json.dumps(out)), 'octets')

# aperçu contrôle
d0 = dates[0]
print('\nContrôle', d0, ':', dayd[d0]['plan'], 'planifiés dont', dayd[d0]['fim'], 'FIM | HP', dayd[d0]['hp'], 'h | prod', dayd[d0]['hprod'], 'h | alla', dayd[d0]['alla'], 'h')
top = max(range(len(slots)), key=lambda i: mprod[d0][i])
print('pointe', d0, ':', out['slots'][top], '=', mprod[d0][top], 'personnes (prod)')
tot = [round(sum(mprod[d][i] for d in dates) / len(dates), 2) for i in range(len(slots))]
ti = max(range(len(slots)), key=lambda i: tot[i])
print('pointe moyenne période :', out['slots'][ti], '=', tot[ti])
