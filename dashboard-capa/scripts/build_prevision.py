# -*- coding: utf-8 -*-
"""Construit data/prevision.json depuis le classeur Webhelp (04_Webhelp_2026.xlsx).

Sources :
  - onglet « 2026 »    : prévus mensuels par flux (appels / mails, colonnes janv.→déc.)
  - onglet « Poids »   : poids journaliers par flux (Appel B-F, Mail J-L), poids par jour
                         de semaine (Chat, O-P) et créneaux 30 min (col. R : 730 = 07:30,
                         profils « Lundi au samedi » / « Dimanche » par flux, S..AA)
  - onglet « Prévision » : date du dernier snapshot (info, colonne A)

Sortie : work/app/data/prevision.json
  { meta, mois, poidsJour, poidsChat, creneaux }
Les poids sont normalisés (Σ = 1) par mois × canal × flux et par mois × flux × profil,
ce qui garantit la réconciliation exacte jour→mois et créneau→jour.

Usage : python scripts/build_prevision.py "chemin/04_Webhelp_2026.xlsx" [data/prevision.json]
"""
import sys, json
from datetime import datetime, date

PACTS = ['hyper', 'c2e', 'afr', 'drive', 'sav', 'direct']
WDS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']
WDS_IDX = {0: 'lundi', 1: 'mardi', 2: 'mercredi', 3: 'jeudi', 4: 'vendredi', 5: 'samedi', 6: 'dimanche'}
# colonnes (0-based) des créneaux dans l'onglet Poids : R=créneau, puis hyper LS/T…, SAV=AA
SLOTMAP = [('hyper', 'ls', 18), ('hyper', 'dim', 19), ('c2e', 'ls', 20), ('afr', 'ls', 21),
           ('afr', 'dim', 22), ('drive', 'ls', 23), ('drive', 'dim', 24), ('direct', 'ls', 25), ('sav', 'ls', 26)]


def nd(v):
    """nombre flottant tolérant (None -> 0)"""
    try:
        if v is None: return 0.0
        if isinstance(v, (int, float)): return float(v)
        return float(str(v).replace(',', '.').replace(' ', ''))
    except Exception:
        return 0.0


def dstr(v):
    if isinstance(v, datetime): return v.strftime('%Y-%m-%d')
    if isinstance(v, date): return v.strftime('%Y-%m-%d')
    return ''


def build(src, dst):
    import openpyxl
    wb = openpyxl.load_workbook(src, data_only=True, read_only=False)
    names = {n.strip().lower(): n for n in wb.sheetnames}

    # ---------- onglet 2026 : prévus mensuels par flux ----------
    w26 = wb[[n for n in wb.sheetnames if n.strip().lower() == '2026'][0]]
    rows = list(w26.iter_rows(values_only=True))

    def norm(s):
        return ' '.join(str(s).split()).lower() if s is not None else ''

    hI = next(i for i, r in enumerate(rows) if 'volume contacts retours' in norm(r[0] if r else ''))
    months = []                                     # [{c: col_index, k: '2026-01'}]
    for c in range(2, len(rows[hI])):
        d = dstr(rows[hI][c])
        if d: months.append({'c': c, 'k': d[:7]})
    if len(months) < 12:
        raise SystemExit(f'ERREUR : {len(months)} mois trouvés dans la ligne d\'en-têtes (12 attendus)')

    mois = {}
    cur = ''
    labels_direct = {
        'appels prevus afr': ('afr', 'appels'), 'mails prevus afr': ('afr', 'mails'),
        'appels prevus drive': ('drive', 'appels'), 'mails prevus drive': ('drive', 'mails'),
        'appels prevus sav': ('sav', 'appels'), 'mails prevus sav': ('sav', 'mails'),
        'appels prevus direct': ('direct', 'appels'), 'mails prevus direct': ('direct', 'mails'),
    }
    chk = {}
    for r in rows[hI + 1:]:
        lab = norm(r[0] if r else '')
        if not lab: continue
        if 'volume contacts hyper' in lab: cur = 'hyper'; continue
        if 'volume contacts c2e' in lab: cur = 'c2e'; continue
        if 'volume contacts' in lab: cur = ''; continue
        if cur in ('hyper', 'c2e') and lab in ('voix', 'mails'):
            k = 'appels' if lab == 'voix' else 'mails'
            for mc in months:
                o = mois.setdefault(mc['k'], {'appels': {}, 'mails': {}})
                o[k][cur] = round(nd(r[mc['c']]), 2)
            continue
        hit = labels_direct.get(lab)
        if hit:
            f, k = hit
            for mc in months:
                o = mois.setdefault(mc['k'], {'appels': {}, 'mails': {}})
                o[k][f] = round(nd(r[mc['c']]), 2)
            continue
        if lab in ('appels prevus hyper/c2e', 'mails prevus hyper/c2e'):
            k = 'appels' if lab.startswith('appels') else 'mails'
            for mc in months:
                chk.setdefault(mc['k'], {})[k] = nd(r[mc['c']])
    if not mois:
        raise SystemExit('ERREUR : aucun prévu mensuel lu dans l\'onglet 2026')

    # contrôle : Hyper + C2E = prévu combiné
    for mk, o in sorted(mois.items()):
        for k in ('appels', 'mails'):
            ref = chk.get(mk, {}).get(k)
            if ref is not None:
                delta = abs((o[k].get('hyper', 0) + o[k].get('c2e', 0)) - ref)
                if delta > max(1.0, ref * 0.002):
                    print(f'  ⚠ {mk} {k} : Hyper+C2E={o[k].get("hyper", 0) + o[k].get("c2e", 0):.1f} ≠ combiné {ref:.1f} (Δ {delta:.1f})')

    # ---------- onglet Poids : poids journaliers + chat + créneaux ----------
    wP = wb[[n for n in wb.sheetnames if n.strip().lower() == 'poids'][0]]
    jours, chat, cre = {}, {}, {}
    for row in wP.iter_rows(values_only=True):
        d = dstr(row[0] if row else None)
        if not d or row[1] is None or len(row) < 12: continue
        jours[d] = {'a': {'hyper': nd(row[1]), 'c2e': nd(row[2]), 'afr': nd(row[3]), 'drive': nd(row[4]), 'sav': nd(row[5]), 'direct': 0},
                    'm': {'hyper': nd(row[9]), 'c2e': 0, 'afr': nd(row[10]), 'drive': nd(row[11]), 'sav': 0, 'direct': 0}}
        mk = d[:7]
        # poids chat par jour de semaine (O-P)
        if len(row) > 15:
            wl = norm(row[14])
            if wl in WDS and row[15] is not None:
                chat.setdefault(mk, {}).setdefault(wl, nd(row[15]))
        # créneaux 30 min (R..AA)
        if len(row) > 26:
            sv = row[17]
            if isinstance(sv, (int, float)) and float(sv).is_integer() and 100 <= sv <= 2359:
                t = str(int(sv))
                for f, p, c in SLOTMAP:
                    cre.setdefault(mk, {}).setdefault(f, {}).setdefault(p, {})[t] = nd(row[c])

    if not jours:
        raise SystemExit('ERREUR : aucun poids journalier lu dans l\'onglet Poids')

    # sommes brutes (contrôle) puis normalisation Σ = 1
    raw = {}
    for d, w in jours.items():
        mk = d[:7]
        for c in ('a', 'm'):
            for f in PACTS:
                raw[(mk, c, f)] = raw.get((mk, c, f), 0) + w[c][f]
    print('Sommes brutes des poids journaliers par mois (appels) :')
    mks = sorted({d[:7] for d in jours})
    for mk in mks:
        vals = [f'{f}={raw.get((mk, "a", f), 0):.3f}' for f in PACTS]
        print(f'  {mk} : ' + ' '.join(vals))
    for (mk, c, f), s in raw.items():
        if s > 0:
            for d in jours:
                if d.startswith(mk):
                    jours[d][c][f] = round(jours[d][c][f] / s, 6)
    # repli : flux prévu > 0 mais sans poids (ex. C2E juil.-déc.) -> profil « hyper » du mois
    for mk in mks:
        for c in ('a', 'm'):
            for f in PACTS:
                if raw.get((mk, c, f), 0) > 0: continue
                if (mois.get(mk, {}).get('appels' if c == 'a' else 'mails', {}).get(f, 0) or 0) > 0 \
                   and raw.get((mk, c, 'hyper'), 0) > 0:
                    for d in jours:
                        if d.startswith(mk): jours[d][c][f] = jours[d][c]['hyper']
                    print(f'  ℹ {mk} {("appels" if c == "a" else "mails")} {f} : poids absents -> profil « hyper » appliqué')
    for mk, fs in cre.items():
        for f, ps in fs.items():
            for p, sl in ps.items():
                s = sum(sl.values())
                if s > 0:
                    for t in sl: sl[t] = round(sl[t] / s, 6)

    # ---------- onglet Prévision : date du dernier snapshot ----------
    snap = ''
    if any(n.strip().lower() == 'prévision' or n.strip().lower() == 'prevision' for n in wb.sheetnames):
        wPr = wb[[n for n in wb.sheetnames if n.strip().lower() in ('prévision', 'prevision')][0]]
        for row in wPr.iter_rows(values_only=True):
            d = dstr(row[0] if row else None)
            if d > snap: snap = d

    out = {'meta': {'file': src.split('/')[-1].split('\\')[-1],
                    'maj': date.today().strftime('%Y-%m-%d'), 'snapshot': snap},
           'mois': mois, 'poidsJour': jours, 'poidsChat': chat, 'creneaux': cre}

    with open(dst, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))

    # ---------- rapport ----------
    nb_slots = sum(len(sl) for fs in cre.values() for ps in fs.values() for sl in ps.values())
    print(f'\nOK {dst}')
    print(f'  mois prévus : {len(mois)} ({min(mois)} → {max(mois)}) · jours pondérés : {len(jours)} ({min(jours)} → {max(jours)})')
    print(f'  créneaux : {nb_slots} valeurs sur {len(cre)} mois · snapshot : {snap or "—"}')
    ex = mois.get('2026-11') or mois[max(mois)]
    mkx = '2026-11' if '2026-11' in mois else max(mois)
    print(f'  exemple {mkx} : appels hyper={ex["appels"].get("hyper", 0):.0f} · c2e={ex["appels"].get("c2e", 0):.0f} · '
          f'afr={ex["appels"].get("afr", 0):.0f} · drive={ex["appels"].get("drive", 0):.0f} · sav={ex["appels"].get("sav", 0):.0f}')


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else '/home/z/my-project/upload/04_Webhelp_2026.xlsx'
    dst = sys.argv[2] if len(sys.argv) > 2 else '/home/z/my-project/work/app/data/prevision.json'
    build(src, dst)
