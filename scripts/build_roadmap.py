#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_roadmap.py — extrait les données Roadmap du classeur RM Auchan (S46+) vers data/roadmap.json.

Source : feuille AUCHAN (sections empilées, colonnes hebdo S1__2025 → …) + feuille Congés (ETP).
Chaque section → { t: total|None, fam: {FO,BO,AU}|None, a: {activité: [...]}, row: ligne Excel }.
Activités implicites : les lignes « --- » portant des valeurs sont C2E (après Appels Hyper/Super),
Direct (LAD) (après Appels AFR) et Mail Direct (LAD) (après Mail AFR).

Usage : python3 build_roadmap.py [fichier.xlsm] [sortie.json]
"""
import json
import math
import re
import sys
import unicodedata

import openpyxl
from openpyxl.utils import get_column_letter

SRC_DEFAULT = "/home/z/my-project/upload/Copie de RM_Auchan_S46.xlsm"
OUT_DEFAULT = "/home/z/my-project/work/app/data/roadmap.json"

WEEK_RE = re.compile(r"^S(\d{1,2})__(\d{4})$", re.IGNORECASE)

def norm(s):
    s = str(s or "").lower().strip()
    s = s.replace("\u2019", "'").replace("\u00a0", " ")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"\s+", " ", s)
    return s

def num(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.replace(",", ".").strip()
        if not v:
            return None
        try:
            v = float(v)
        except ValueError:
            return None
    if isinstance(v, (int, float)) and math.isfinite(v):
        return float(v)
    return None

def r4(v):
    return None if v is None else round(v, 4)

# ---------------------------------------------------------------- activités
ACT_MAP = [  # (contient, famille, clé canonique)
    ("hyper", "FO", "Hyper"), ("hyper", "BO", "Mail Hyper"),
    ("afr", "FO", "AFR"), ("afr", "BO", "Mail AFR"),
    ("drive", "FO", "Drive"), ("drive", "BO", "Mail Drive"),
    ("sav", "FO", "SAV"),
    ("chat", "AU", "Chat"),
    ("borne", "AU", "Borne/LSA"),
]
FAM_LABELS = {"front office": "FO", "back office": "BO", "autres": "AU"}
# « --- » implicites : (famille, activité précédente) -> clé
IMPLICIT = {("FO", "Hyper"): "C2E", ("FO", "AFR"): "Direct (LAD)", ("BO", "Mail AFR"): "Mail Direct (LAD)"}

ACT_ORDER = ["Hyper", "C2E", "AFR", "Direct (LAD)", "Drive", "SAV",
             "Mail Hyper", "Mail AFR", "Mail Direct (LAD)", "Mail Drive", "Chat", "Borne/LSA"]
ACT_FAM = {"Hyper": "FO", "C2E": "FO", "AFR": "FO", "Direct (LAD)": "FO", "Drive": "FO", "SAV": "FO",
           "Mail Hyper": "BO", "Mail AFR": "BO", "Mail Direct (LAD)": "BO", "Mail Drive": "BO",
           "Chat": "AU", "Borne/LSA": "AU"}

SECTIONS = [  # (clé JSON, titre normalisé exact de la ligne de section, colonne du titre)
    ("sla",       "sla / qe",                  4),
    ("prev",      "previsions",                4),
    ("cible",     "cible",                     4),
    ("qp",        "qp / backlog",              4),
    ("pfin",      "previsions finales",        4),
    ("bes_hlog",  "besoin en heures de log",   4),
    ("bes_hprod", "besoin en heures de prod",  4),
    ("bes_etp",   "besoin en etp",             4),
    ("capa_hprod", "capa en heures de prod",   4),
    ("capa_hlog", "capa en heures de log",     4),
    ("capa_a",    "capa en actes",             4),
    ("delta_h",   "delta en heures",           4),
    ("delta_etp", "delta en etp",              4),
    ("dmt",       "dmt",                       4),
    ("prod_h",    "productivite",              4),
    ("occ",       "occupation",                4),
    ("conges",    "conges",                    4),
    ("abs",       "absenteisme",               4),
    ("eff",       "effectif",                  4),
    ("eff_prod",  "effectif productif",        4),
]

# étiquettes (col E) qui terminent la section courante même si non extraites
BOUNDARIES = {"base de planification", "effectif (saisie manuelle)", "cc hors prod",
              "to", "config", "retraits", "hypothese", "hypotheses"}

RATE_SECTIONS = {"sla", "cible", "qp", "occ", "abs", "conges"}   # valeurs en ratio (0-2)


def read_auchan(ws):
    """Lit les colonnes hebdo + les sections de la feuille AUCHAN."""
    grid = []
    for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=ws.max_column, values_only=True):
        grid.append(list(row))
    nr = len(grid)

    # 1) colonnes hebdo : ligne dont toutes les étiquettes collent à S<n>__<année>
    hdr = None
    for ri in range(0, min(nr, 10)):
        cells = [str(v).strip() for v in grid[ri] if v is not None and str(v).strip()]
        if len(cells) >= 40 and sum(1 for c in cells if WEEK_RE.match(c)) >= 40:
            hdr = ri
            break
    if hdr is None:
        raise SystemExit("Ligne d'en-têtes semaines (S1__2025…) introuvable")
    weeks = []  # (idx_col, label, start, end, days)
    for ci, v in enumerate(grid[hdr]):
        if v is None:
            continue
        m = WEEK_RE.match(str(v).strip())
        if not m:
            continue
        start = end = None
        days = None
        if hdr + 1 < nr and ci < len(grid[hdr + 1]):
            d = grid[hdr + 1][ci]
            start = d.date().isoformat() if hasattr(d, "date") else str(d)[:10]
        if hdr + 2 < nr and ci < len(grid[hdr + 2]):
            d = grid[hdr + 2][ci]
            end = d.date().isoformat() if hasattr(d, "date") else str(d)[:10]
        if hdr + 3 < nr and ci < len(grid[hdr + 3]):
            days = num(grid[hdr + 3][ci])
        weeks.append({"col": ci, "k": f"S{int(m.group(1))}__{m.group(2)}", "n": int(m.group(1)),
                      "y": int(m.group(2)), "start": start, "end": end, "days": int(days) if days else None})
    if not weeks:
        raise SystemExit("Aucune colonne hebdo détectée")
    NW = len(weeks)
    print(f"Semaines : {NW} ({weeks[0]['k']} → {weeks[-1]['k']})")

    # 2) repérage des sections (col E = index 4, exact)
    found = []
    for ri in range(nr):
        lab = norm(grid[ri][4] if len(grid[ri]) > 4 else None)
        if not lab:
            continue
        for key, title, _ in SECTIONS:
            if lab == title and all(k != key for k, _ in found):
                found.append((key, ri))
                break
    found.sort(key=lambda x: x[1])
    missing = [s[0] for s in SECTIONS if all(s[0] != kk for kk, _ in found)]
    if missing:
        print("⚠ sections introuvables :", ", ".join(missing))
    print("Sections :", ", ".join(f"{k}@L{r + 1}" for k, r in found))

    # 3) extraction section par section
    out = {}
    for si, (key, ri) in enumerate(found):
        end_r = found[si + 1][1] if si + 1 < len(found) else nr
        cur_fam = None
        prev_act = None
        sec = {"row": ri + 1, "t": [None] * NW, "fam": {"FO": [None] * NW, "BO": [None] * NW, "AU": [None] * NW},
               "a": {}}
        for r in range(ri, end_r):
            row = grid[r]
            lab_raw = row[4] if len(row) > 4 else None
            lab = norm(lab_raw)
            if r != ri and lab in BOUNDARIES:
                break                                   # section suivante non extraite
            if not lab or lab in {"---", "-"}:
                lab = "---"
            vals = [num(row[w["col"]]) if len(row) > w["col"] else None for w in weeks]
            if r == ri:                                   # ligne de titre = total
                sec["t"] = [r4(v) for v in vals]
                continue
            if lab in FAM_LABELS:                         # sous-total famille
                cur_fam = FAM_LABELS[lab]
                prev_act = None
                if any(v is not None for v in vals):
                    sec["fam"][cur_fam] = [r4(v) for v in vals]
                continue
            if lab == "---":                              # activité implicite ou padding
                if cur_fam and prev_act and any(v is not None and v != 0 for v in vals):
                    imp = IMPLICIT.get((cur_fam, prev_act))
                    if imp:
                        sec["a"][imp] = [r4(v) for v in vals]
                        prev_act = imp
                continue
            act = None
            if "mail" in lab:                            # variantes Mail : d'abord, pour éviter Hyper→Mail Hyper
                for frag, fam, key_a in (("afr", "BO", "Mail AFR"), ("drive", "BO", "Mail Drive"),
                                         ("hyper", "BO", "Mail Hyper")):
                    if frag in lab:
                        act, cur_fam = key_a, fam
                        break
            elif "direct" in lab and "lad" in lab:
                act, cur_fam = ("Mail Direct (LAD)", "BO") if cur_fam == "BO" else ("Direct (LAD)", "FO")
            else:
                for frag, fam, key_a in ACT_MAP:
                    if frag in lab:
                        if fam == cur_fam:
                            act = key_a
                        else:
                            act, cur_fam = key_a, fam
                        break
            if act is None and "---" not in lab and cur_fam:
                # étiquette inconnue : on ne l'associe pas
                pass
            if act:
                sec["a"][act] = [r4(v) for v in vals]
                prev_act = act
        out[key] = sec

    # 4) totaux manquants = somme des activités
    #    abs / conges : familles pondérées (rates) — congés : total du fichier en ETP → ignoré
    for key, sec in out.items():
        acts = [a for a in ACT_ORDER if a in sec["a"]]
        if key in ("sla", "cible", "qp", "occ", "dmt", "prod_h", "abs", "conges"):
            if key == "conges":
                sec["t"] = [None] * NW          # total fichier en ETP ≠ taux des activités
            continue                             # l'UI calcule familles/totaux en pondéré
        if all(v is None for v in sec["t"]) and acts:
            sec["t"] = [r4(sum(filter(None, (sec["a"][a][i] for a in acts)))) or 0 for i in range(NW)]
            sec["t_calc"] = True
        for fam in ("FO", "BO", "AU"):
            fam_acts = [a for a in acts if ACT_FAM[a] == fam]
            if all(v is None for v in sec["fam"][fam]) and fam_acts:
                sec["fam"][fam] = [r4(sum(filter(None, (sec["a"][a][i] for a in fam_acts)))) or 0
                                   for i in range(NW)]
                sec.setdefault("fam_calc", []).append(fam)
    return weeks, out


def read_conges_etp(wb, weeks):
    """Feuille Congés : congés hebdo en ETP par activité (alignés par libellé de semaine)."""
    if "Congés" not in wb.sheetnames:
        return None
    ws = wb["Congés"]
    grid = [list(r) for r in ws.iter_rows(values_only=True)]
    # colonnes semaines : ligne 3 (index 2) = labels
    lab_row = None
    for ri in range(min(6, len(grid))):
        hits = sum(1 for v in grid[ri] if v is not None and WEEK_RE.match(str(v).strip()))
        if hits >= 10:
            lab_row = ri
            break
    if lab_row is None:
        return None
    colmap = {}
    for ci, v in enumerate(grid[lab_row]):
        if v is None:
            continue
        m = WEEK_RE.match(str(v).strip())
        if m:
            colmap[f"S{int(m.group(1))}__{m.group(2)}"] = ci
    idx = {w["k"]: i for i, w in enumerate(weeks)}
    sec = {"row": lab_row + 1, "t": [None] * len(weeks),
           "fam": {"FO": [None] * len(weeks), "BO": [None] * len(weeks), "AU": [None] * len(weeks)},
           "a": {}}
    cur_fam = None
    prev_act = None
    for ri in range(lab_row + 1, len(grid)):
        row = grid[ri]
        lab = norm(row[1] if len(row) > 1 else None)
        if not lab:
            continue
        def get(ci):
            if ci is None or ci >= len(row):
                return None
            return num(row[ci])
        if lab in FAM_LABELS:
            cur_fam = FAM_LABELS[lab]
            prev_act = None
            continue
        if lab == "---":
            if cur_fam and prev_act:
                imp = IMPLICIT.get((cur_fam, prev_act))
                if imp and imp not in sec["a"]:
                    sec["a"][imp] = [r4(get(colmap.get(w["k"]))) for w in weeks]
                    prev_act = imp
            continue
        act = None
        for frag, fam, key_a in ACT_MAP:
            if frag in lab:
                act, cur_fam = key_a, fam
                break
        else:
            if lab == "conges":
                sec["t"] = [r4(get(colmap.get(w["k"]))) for w in weeks]
                continue
        if act:
            sec["a"][act] = [r4(get(colmap.get(w["k"]))) for w in weeks]
            prev_act = act
    # sous-totaux familles manquants
    for fam in ("FO", "BO", "AU"):
        fam_acts = [a for a in ACT_ORDER if a in sec["a"] and ACT_FAM[a] == fam]
        if fam_acts and all(v is None for v in sec["fam"][fam]):
            sec["fam"][fam] = [r4(sum(filter(None, (sec["a"][a][i] for a in fam_acts)))) or 0
                               for i in range(len(weeks))]
            sec.setdefault("fam_calc", []).append(fam)
    if all(v is None for v in sec["t"]):
        acts = [a for a in ACT_ORDER if a in sec["a"]]
        sec["t"] = [r4(sum(filter(None, (sec["a"][a][i] for a in acts)))) or 0 for i in range(len(weeks))]
        sec["t_calc"] = True
    return sec


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    out = sys.argv[2] if len(sys.argv) > 2 else OUT_DEFAULT
    wb = openpyxl.load_workbook(src, data_only=True, read_only=True)
    weeks, sections = read_auchan(wb["AUCHAN"])
    conges_etp = read_conges_etp(wb, weeks)
    if conges_etp:
        sections["conges_etp"] = conges_etp
        print("Feuille Congés : extraite (ETP/semaine/activité)")
    wb.close()

    # bornes des semaines utiles
    NW = len(weeks)
    def has_data(i):
        for s in ("pfin", "bes_hlog", "capa_a", "sla"):
            sec = sections.get(s)
            if not sec:
                continue
            for a in sec["a"]:
                v = sec["a"][a][i]
                if v is not None and v != 0:
                    return True
        return False
    used = [i for i in range(NW) if has_data(i)]
    i0, i1 = (used[0], used[-1] + 1) if used else (0, NW)
    if i0 > 0 or i1 < NW:
        print(f"Fenêtre utile : {weeks[i0]['k']} → {weeks[i1 - 1]['k']} (troncature de {NW - (i1 - i0)} colonnes vides)")

    weeks_out = [{k: w[k] for k in ("k", "n", "y", "start", "end", "days")} for w in weeks[i0:i1]]

    trimmed = {}
    for key, sec in sections.items():
        t = {"row": sec["row"],
             "t": [v if v is None else round(v, 4) for v in sec["t"][i0:i1]],
             "fam": {f: [v if v is None else round(v, 4) for v in sec["fam"][f][i0:i1]] for f in ("FO", "BO", "AU")},
             "a": {a: [v if v is None else round(v, 4) for v in sec["a"][a][i0:i1]] for a in sec["a"]}}
        if sec.get("t_calc"):
            t["t_calc"] = True
        if sec.get("fam_calc"):
            t["fam_calc"] = sec["fam_calc"]
        trimmed[key] = t

    doc = {"v": 2,
           "meta": {"file": src.split("/")[-1], "maj": __import__("datetime").date.today().isoformat(),
                    "weeks": len(weeks_out)},
           "acts": [{"k": a, "fam": ACT_FAM[a]} for a in ACT_ORDER], "weeks": weeks_out, "s": trimmed}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    import os
    print(f"Écrit : {out} ({os.path.getsize(out) / 1024:.0f} Ko, {len(weeks_out)} semaines)")

    # ------------------------- validations
    print("\n=== VALIDATION (dernière semaine) ===")
    w = weeks_out[-1]
    i = len(weeks_out) - 1
    print(f"Semaine : {w['k']} (du {w['start']})")
    for key in ("pfin", "prev", "capa_a", "bes_hlog", "bes_hprod", "bes_etp", "capa_hlog", "capa_hprod",
                "eff", "eff_prod", "delta_etp", "dmt", "occ", "abs", "conges"):
        sec = trimmed.get(key)
        if not sec:
            continue
        tot = sec["t"][i]
        ssum = sum(filter(None, (sec["a"][a][i] for a in sec["a"] if sec["a"][a][i] is not None)))
        flag = ""
        if tot is not None and ssum and abs(tot - ssum) > max(1, abs(tot) * 0.02):
            flag = f"  ⚠ total {tot:,.0f} ≠ Σ actes {ssum:,.0f}"
        print(f"  {key:10s} total={tot if tot is None else format(tot, ',.1f')} Σactes={ssum:,.1f}{flag}")


if __name__ == "__main__":
    main()
