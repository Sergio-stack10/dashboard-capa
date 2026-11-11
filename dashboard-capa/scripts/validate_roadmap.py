#!/usr/bin/env python3
"""Valide roadmap.json contre les valeurs de référence du Dashboard RM (S45__2026)."""
import json

D = json.load(open("/home/z/my-project/work/app/data/roadmap.json"))
weeks = D["weeks"]
ki = next(i for i, w in enumerate(weeks) if w["k"] == "S45__2026")
S = D["s"]

def g(sec, key, fam=None):
    d = S[sec]
    arr = d["a"].get(key) if fam is None else d["fam"].get(fam)
    return None if arr is None else arr[ki]

print("=== S45__2026 (index", ki, ") — attendu = Dashboard RM ===")
checks = [
    ("pfin total", S["pfin"]["t"][ki], 20277.5625),
    ("pfin FO", g("pfin", None, "FO"), 10698.6465),
    ("pfin BO", g("pfin", None, "BO"), 2695.7161),
    ("pfin Autres", g("pfin", None, "AU"), 6883.2),
    ("pfin Hyper", g("pfin", "Hyper"), 3659.5059),
    ("pfin Chat", g("pfin", "Chat"), 3824),
    ("bes_etp total", S["bes_etp"]["t"][ki], 65.0792),
    ("bes_etp FO", g("bes_etp", None, "FO"), 43.1537),
    ("eff_prod total", S["eff_prod"]["t"][ki], 59.3212),
    ("eff_prod FO", g("eff_prod", None, "FO"), 37.6671),
    ("delta_etp total", S["delta_etp"]["t"][ki], -0.4152),
    ("delta_etp FO", g("delta_etp", None, "FO"), -3.5),
    ("bes_hlog total", S["bes_hlog"]["t"][ki], None),
    ("bes_hprod Hyper", g("bes_hprod", "Hyper"), None),
    ("capa_hlog total", S["capa_hlog"]["t"][ki], None),
    ("capa_a total", S["capa_a"]["t"][ki], None),
    ("dmt Hyper", g("dmt", "Hyper"), 441.4464),
    ("occ Hyper", g("occ", "Hyper"), 0.6967),
    ("abs total", S["abs"]["t"][ki], 0.10),
    ("abs Hyper", g("abs", "Hyper"), 0.10),
    ("conges Hyper", g("conges", "Hyper"), 0.05),
    ("prod_h Hyper", g("prod_h", "Hyper"), 5.6813),
    ("eff total (saisie)", S["eff"]["t"][ki], None),
    ("conges_etp total", S["conges_etp"]["t"][ki] if "conges_etp" in S else None, None),
]
for name, got, exp in checks:
    if exp is None:
        print(f"  {name:22s} = {got}")
    else:
        ok = got is not None and abs(got - exp) < max(0.02, abs(exp) * 0.001)
        print(f"  {name:22s} = {got}   attendu {exp}   {'✓' if ok else '⚠ ÉCART'}")

# QE global pondéré par pfin (contrôle vs Dashboard 0.9764 / FO 0.9474 / BO 1.2495)
fam_of = {a["k"]: a["fam"] for a in D["acts"]}
def qe_w(fam=None):
    num_s = den = 0.0
    for a in D["acts"]:
        if fam and fam_of[a["k"]] != fam:
            continue
        v = g("sla", a["k"]); p = g("pfin", a["k"])
        if v is not None and p:
            num_s += v * p; den += p
    return num_s / den if den else None
print(f"\nQE global pondéré pfin = {qe_w():.4f}  (Dashboard: 0.9764)")
print(f"QE FO pondéré          = {qe_w('FO'):.4f}  (Dashboard: 0.9474)")
print(f"QE BO pondéré          = {qe_w('BO'):.4f}  (Dashboard: 1.2495)")
print(f"QE FO ligne fichier    = {g('sla', None, 'FO'):.4f}")
print(f"QE BO ligne fichier    = {g('sla', None, 'BO'):.4f}")
print(f"QE Hyper fichier       = {g('sla', 'Hyper'):.4f}  (Dashboard Appels Hyper/Super: 0.8626)")
print(f"Cible Hyper            = {g('cible', 'Hyper')}")
# S46 (semaine suivante)
ki46 = ki + 1
print(f"\nS46__2026: pfin={S['pfin']['t'][ki46]:.0f}  bes_etp={S['bes_etp']['t'][ki46]:.1f}  eff_prod={S['eff_prod']['t'][ki46]:.1f}  dmt Hyper={g('dmt','Hyper') if False else S['dmt']['a']['Hyper'][ki46]:.0f}s")
