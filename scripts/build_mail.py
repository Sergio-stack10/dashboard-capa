# -*- coding: utf-8 -*-
"""Injecte un Export Mail (canal mail) dans data/data.json.

Usage :
    python scripts/build_mail.py "Export Mail.xlsx" [data/data.json]

Agrégat par jour × activité :
    rec  = toutes les lignes (courriels reçus/acceptés)
    tr   = lignes avec Statut = 1 (traités)
    t60  = traités avec Délai de traitement < 60 s
    del  = somme des délais de traitement (secondes)

Les mêmes paires jour/activité sont remplacées (les exports se cumulent,
comme côté interface). Le data.json reste valable pour l'app statique.
"""
import json, re, sys, datetime, unicodedata
import openpyxl

RFLOW = ['HYPER', 'C2E', 'AFR', 'DRIVE', 'SAV']

snorm = lambda s: unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().strip().lower()

src = sys.argv[1]
dst = sys.argv[2] if len(sys.argv) > 2 else 'data/data.json'

wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
sh = wb[wb.sheetnames[0]]
rows = list(sh.iter_rows(values_only=True))

# --- localiser l'en-tête (1re ligne contenant « Personnalisé ») ---
hi = None
for i, r in enumerate(rows[:8]):
    if r and any(snorm(c).startswith('personnalis') for c in r):
        hi = i
        break
if hi is None:
    sys.exit('En-tête « Personnalisé » introuvable')
head = [snorm(c) for c in rows[hi]]
cF = next(i for i, h in enumerate(head) if h.startswith('personnalis'))
cS = head.index('statut') if 'statut' in head else None
cD = next(i for i, h in enumerate(head) if 'acceptation' in h)
cDel = next((i for i, h in enumerate(head) if 'delai de traitement' in h), None)

def iso(v):
    if isinstance(v, datetime.datetime):
        return v.strftime('%Y-%m-%d')
    if isinstance(v, datetime.date):
        return v.strftime('%Y-%m-%d')
    s = str(v).strip()
    m = re.match(r'^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})', s)
    return '%04d-%02d-%02d' % (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else ''

agg = {}
tot = 0
for r in rows[hi + 1:]:
    if r is None or all(c is None for c in r):
        continue
    d = iso(r[cD]) if cD < len(r) else ''
    f = str(r[cF]).strip() if cF < len(r) and r[cF] is not None else ''
    if not d or not f:
        continue
    a = agg.setdefault((d, f), [0, 0, 0, 0])
    a[0] += 1
    st = float(r[cS]) if cS is not None and cS < len(r) and isinstance(r[cS], (int, float)) else 1.0
    if round(st) == 1:
        a[1] += 1
        dl = float(r[cDel] or 0) if cDel is not None and cDel < len(r) else 0.0
        a[3] += dl
        if 0 < dl < 60:
            a[2] += 1
    tot += 1

if not agg:
    sys.exit('Aucune ligne exploitable')

dates = sorted({k[0] for k in agg})
rank = lambda f: (RFLOW.index(f.upper()) if f.upper() in RFLOW else 9, f)
flows = sorted({k[1] for k in agg}, key=rank)

mail = {'file': src.split('/')[-1].split('\\')[-1],
        'maj': datetime.date.today().isoformat(),
        'dates': dates, 'flows': flows, 'f': {}}
for f in flows:
    mail['f'][f] = {'rec': [], 'tr': [], 't60': [], 'del': []}
    for d in dates:
        rec, tr, t60, dele = agg.get((d, f), [0, 0, 0, 0])
        mail['f'][f]['rec'].append(rec)
        mail['f'][f]['tr'].append(tr)
        mail['f'][f]['t60'].append(t60)
        mail['f'][f]['del'].append(round(dele))

with open(dst, encoding='utf-8') as fh:
    data = json.load(fh)
data['mail'] = mail
data.setdefault('meta', {})['mail'] = mail['file']
data['meta']['maj'] = datetime.date.today().isoformat()
with open(dst, 'w', encoding='utf-8') as fh:
    json.dump(data, fh, ensure_ascii=False)

del_tot = sum(a[3] for a in agg.values())
tr_tot = sum(a[1] for a in agg.values())
t60_tot = sum(a[2] for a in agg.values())
print('%d courriels · %d jours · %d activités' % (tot, len(dates), len(flows)))
print('traités %d · <60s %d · Σ délais %d s (%.1f h) · DMT %.1f s' %
      (tr_tot, t60_tot, round(del_tot), del_tot / 3600, del_tot / tr_tot if tr_tot else 0))
print('activités :', ', '.join('%s %d' % (f, sum(agg[k][0] for k in agg if k[1] == f)) for f in flows))
