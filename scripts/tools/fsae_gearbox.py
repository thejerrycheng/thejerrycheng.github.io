#!/usr/bin/env python3
"""Check the FSAE 4:1 planetary gearbox capstone against its own numbers.

Four analyses, all from quantities stated in the report (assets/pdf/projects/
Capstone_Project-2.pdf) plus the FSAE 2021 rulebook the report cites as [1]:

  1. chain wrap geometry -- how much lateral span the gearbox actually buys,
     which is the project's stated motivation and is never computed;
  2. planetary feasibility -- the assembly and neighbour conditions applied to
     the report's own shortlist of tooth numbers;
  3. a Campbell diagram -- gear-mesh orders against the reported modal
     frequencies over the motor's speed range;
  4. lap seconds converted into competition points with the rulebook formulas,
     which is the objective the whole project was justified by.

Writes assets/images/projects/fsae/*.pdf/.png (or figures/ standalone).

Run:  python3 scripts/tools/fsae_gearbox.py
"""
import pathlib

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = (ROOT / "assets/images/projects/fsae") if (ROOT / "assets/js").is_dir() else (ROOT / "figures")

# ---- everything below is quoted from the report --------------------------------
Z_SUN, Z_PLANET, Z_RING, N_PLANET = 30, 30, 90, 4
MODULE = 2.0                     # mm
RATIO = Z_RING / Z_SUN + 1       # planetary type, ring held: 4.0
CHAIN_PITCH = 0.625 * 25.4       # 520 motorcycle chain, mm
SPROCKET_IN, SPROCKET_OUT = 18, 20
MOTOR_RPM_MAX = 3300             # EMRAX 228, as stated in section 5.8.2
# ANSYS modal results, section 5.8.1 (Hz)
MODES = {
    "output carrier": [2354.3, 2354.6, 3541.4, 4703.0, 4749.2],
    "input shaft":    [3014.2, 3015.6, 11544.0, 11556.0, 11631.0],
    "input carrier":  [12423.0, 12424.0, 12427.0, 12434.0, 12976.0],
}
# system lumped model, section 5.8.1
SYS_M, SYS_A, SYS_L = 14.55, 1.26e-4, 0.02          # kg, m^2, m
SYS_E = (190e9, 210e9)                               # 4140 steel, as cited
# OptimumLap results, Table 16 (seconds)
LAPSIM = {"Acceleration": (5.56, 5.55), "SkidPad": (5.45, 5.42),
          "Autocross": (57.75, 56.00), "Endurance": (151.0, 147.0)}
# FSAE 2021 rules D.9.4 / D.10.4 / D.11.4 / D.12.13.  (A, floor, Tmax/Tmin, squared?)
FSAE = {"Acceleration": (95.5, 4.5, 1.50, False),
        "SkidPad":      (71.5, 3.5, 1.25, True),
        "Autocross":   (118.5, 6.5, 1.45, False),
        "Endurance":   (250.0, 25.0, 1.45, False)}


def pitch_dia(teeth, pitch=CHAIN_PITCH):
    """Sprocket pitch diameter for a roller chain."""
    return pitch / np.sin(np.pi / teeth)


def wrap_angle(d_small, d_big, centre):
    """Angle of chain wrap on the SMALL sprocket, degrees."""
    x = np.clip((d_big - d_small) / (2 * centre), -1, 1)
    return np.degrees(np.pi - 2 * np.arcsin(x))


def min_centre_for_wrap(d_small, d_big, wrap_deg=120.0):
    """Smallest centre distance giving at least `wrap_deg` on the small sprocket."""
    s = np.sin(np.radians((180.0 - wrap_deg) / 2))
    geometric = (d_big + d_small) / 2          # sprockets must not overlap
    return max((d_big - d_small) / (2 * s), geometric)


def analysis_chain():
    print("=" * 74)
    print("1. WHAT THE GEARBOX BUYS: chain wrap geometry")
    d18 = pitch_dia(18)
    d20 = pitch_dia(20)
    d72 = pitch_dia(72)                       # 4:1 on the chain alone
    print(f"   520 chain, pitch {CHAIN_PITCH:.3f} mm")
    print(f"   pitch dia: 18T {d18:.1f} mm   20T {d20:.1f} mm   72T {d72:.1f} mm")
    c_chain = min_centre_for_wrap(d18, d72)
    c_gbox = min_centre_for_wrap(d18, d20)
    print(f"   chain-only 4:1 (18->72): centres >= {c_chain:.0f} mm for 120 deg wrap")
    print(f"   gearbox + 18:20 chain:   centres >= {c_gbox:.0f} mm (overlap-limited)")
    print(f"   -> lateral span cut by {c_chain - c_gbox:.0f} mm "
          f"({100*(c_chain-c_gbox)/c_chain:.0f} %)")
    return d18, d20, d72, c_chain, c_gbox


def analysis_teeth():
    print("=" * 74)
    print("2. THE SHORTLIST: can four equally spaced planets actually be fitted?")
    print(f"   {'ring':>5} {'sun':>4} {'planet':>7} {'ratio':>6}  coaxial  assembly  neighbour")
    cands = [(90, 30, 30), (100, 30, 35), (120, 40, 40), (120, 30, 45)]  # Table 10
    for zc, za, zb in cands:
        coax = (zc == za + 2 * zb)
        assy = (za + zc) % N_PLANET == 0                    # equal spacing
        a = MODULE * (za + zb) / 2                          # sun-planet centres
        da = MODULE * (zb + 2)                              # planet tip diameter
        neigh = da < 2 * a * np.sin(np.pi / N_PLANET)
        r = zc / za + 1
        print(f"   {zc:>5} {za:>4} {zb:>7} {r:>6.2f}  "
              f"{'yes' if coax else 'NO ':>7}  {'yes' if assy else 'NO ':>8}  "
              f"{'yes' if neigh else 'NO ':>9}")
    ok = [(zc, za, zb) for zc, za, zb in cands
          if zc == za + 2 * zb and (za + zc) % N_PLANET == 0]
    print(f"   -> {len(ok)} of {len(cands)} shortlisted sets admit four equally spaced planets: {ok}")

    # every valid set in the 3-5 band, for context
    valid = []
    for za in range(13, 61):
        for zb in range(13, 61):
            zc = za + 2 * zb
            if not (3.0 <= zc / za + 1 <= 5.0):
                continue
            if (za + zc) % N_PLANET:
                continue
            a = MODULE * (za + zb) / 2
            if MODULE * (zb + 2) >= 2 * a * np.sin(np.pi / N_PLANET):
                continue
            valid.append((zc, za, zb, zc / za + 1, MODULE * zc))
    valid.sort(key=lambda v: v[4])
    print(f"   {len(valid)} sets in the whole 3-5 band satisfy all three conditions;")
    print(f"   smallest ring pitch diameter: {valid[0][4]:.0f} mm "
          f"(ring {valid[0][0]}, sun {valid[0][1]}, planet {valid[0][2]}, ratio {valid[0][3]:.2f})")
    print(f"   the chosen 90/30/30 ring pitch diameter: {MODULE*Z_RING:.0f} mm")
    return valid


def analysis_campbell():
    print("=" * 74)
    print("3. CAMPBELL: where the excitation orders meet the reported modes")
    f_in = MOTOR_RPM_MAX / 60.0
    f_carrier = f_in / RATIO
    f_mesh = Z_RING * f_carrier
    print(f"   at {MOTOR_RPM_MAX} rpm: input {f_in:.1f} Hz, carrier {f_carrier:.2f} Hz")
    print(f"   gear-mesh frequency = z_ring * f_carrier = {Z_RING} * {f_carrier:.2f} "
          f"= {f_mesh:.1f} Hz")
    print(f"   (equivalently z_sun*(f_sun - f_carrier) = {Z_SUN}*{f_in - f_carrier:.2f} "
          f"= {Z_SUN*(f_in-f_carrier):.1f} Hz)")
    print(f"   the report states 1550 Hz, and its own formula f_in*z_in/z_out gives "
          f"{f_in*Z_SUN/Z_RING:.1f} Hz")

    k_lo, k_hi = SYS_E[0] * SYS_A / SYS_L, SYS_E[1] * SYS_A / SYS_L
    w_lo, w_hi = np.sqrt(k_lo / SYS_M), np.sqrt(k_hi / SYS_M)
    print(f"   system lumped stiffness k = EA/L = {k_lo/1e9:.2f}-{k_hi/1e9:.2f} GN/m "
          f"(report states 0.50 GN/m)")
    print(f"   omega_n = sqrt(k/m) = {w_lo:.0f}-{w_hi:.0f} rad/s "
          f"= {w_lo/2/np.pi:.0f}-{w_hi/2/np.pi:.0f} Hz")
    print(f"   the report reports 9165.15 Hz; 9165.15 rad/s is {9165.15/2/np.pi:.0f} Hz")
    sys_hz = float(np.mean([w_lo, w_hi])) / 2 / np.pi
    print(f"   -> mesh at redline is {100*f_mesh/sys_hz:.0f} % of the system mode "
          f"({f_mesh:.0f} of {sys_hz:.0f} Hz)")

    per_rpm = Z_RING / (60 * RATIO)          # Hz of mesh per rpm of motor
    named = [("system (corrected)", sys_hz)] + [(f"{k}, mode 1", min(v)) for k, v in MODES.items()]
    print("   order crossings inside 0 - redline:")
    found = 0
    for order in (1, 2, 3):
        for name, hz in sorted(named, key=lambda x: x[1]):
            n_cross = hz / (order * per_rpm)
            if n_cross <= MOTOR_RPM_MAX:
                found += 1
                print(f"     {order}x mesh meets {name} ({hz:.0f} Hz) at {n_cross:.0f} rpm")
    print(f"   -> {found} crossings; the fundamental alone has none, which is as far "
          f"as the report looks")
    return sys_hz


def score(A, floor, k, squared, r):
    """FSAE 2021 dynamic score for a team whose time is r times the fastest."""
    r = np.asarray(r, dtype=float)
    if squared:
        num, den = (k / r) ** 2 - 1, k ** 2 - 1
    else:
        num, den = (k / r) - 1, k - 1
    return np.where(r > k, floor, A * num / den + floor)


def analysis_points():
    print("=" * 74)
    print("4. SECONDS INTO POINTS (FSAE 2021 D.9.4, D.10.4, D.11.4, D.12.13)")
    # Domain: every event must still be behind the leader after the gain
    # (r*(1-f) >= 1), and must be inside its own Tmax or it already scores the
    # floor.  Skidpad's Tmax is the binding one at 1.25.
    fmax = max((old - new) / old for old, new in LAPSIM.values())
    kmin = min(k for _, _, k, _ in FSAE.values())
    rs = np.linspace(1.0 / (1 - fmax) + 0.002, kmin - 0.01, 400)
    total = np.zeros_like(rs)
    per_event = {}
    for ev, (old, new) in LAPSIM.items():
        A, floor, k, sq = FSAE[ev]
        f = (old - new) / old
        gain = score(A, floor, k, sq, rs * (1 - f)) - score(A, floor, k, sq, rs)
        per_event[ev] = (f, gain)
        total += gain
        print(f"   {ev:<13} {old:>6.2f} -> {new:>6.2f} s  ({100*f:4.2f} % quicker), "
              f"worth {np.interp(1.15, rs, gain):5.2f} pts at 15 % off the pace")
    for probe in (1.05, 1.10, 1.15, 1.20):
        print(f"   total at {100*(probe-1):>2.0f} % off the leader's pace: "
              f"{np.interp(probe, rs, total):5.1f} points of the 575 on offer")
    print(f"   valid domain {100*(rs[0]-1):.1f}-{100*(rs[-1]-1):.1f} % off the pace: "
          f"below it the car would be passing the leader, above it the skidpad "
          f"score is already at its 3.5-point floor")
    return rs, per_event, total


def figures(chain, teeth, sys_hz, points):
    OUT.mkdir(parents=True, exist_ok=True)
    d18, d20, d72, c_chain, c_gbox = chain
    rs, per_event, total = points

    fig, ax = plt.subplots(1, 3, figsize=(13.6, 3.9))

    # (a) chain wrap
    C = np.linspace(60, 420, 400)
    ax[0].plot(C, wrap_angle(d18, d72, C), lw=2, color="#C0392B", label="chain alone, 18→72 (4:1)")
    ax[0].plot(C, wrap_angle(d18, d20, C), lw=2, color="#1F6FB2", label="after the gearbox, 18→20")
    ax[0].axhline(120, color="0.35", ls="--", lw=1)
    ax[0].annotate("120° minimum wrap", (250, 123), fontsize=8, color="0.35")
    for c, col in ((c_chain, "#C0392B"), (c_gbox, "#1F6FB2")):
        ax[0].axvline(c, color=col, ls=":", lw=1.2)
    ax[0].annotate(f"{c_chain:.0f} mm", (c_chain + 5, 55), fontsize=8.5, color="#C0392B")
    ax[0].annotate(f"{c_gbox:.0f} mm", (c_gbox + 5, 40), fontsize=8.5, color="#1F6FB2")
    ax[0].set_xlabel("motor-to-differential centre distance  [mm]")
    ax[0].set_ylabel("chain wrap on the small sprocket  [deg]")
    ax[0].set_title("(a) why a gearbox at all", fontsize=10)
    ax[0].set_ylim(30, 185)
    ax[0].legend(fontsize=7.5, loc="lower right")

    # (b) Campbell
    n = np.linspace(0, MOTOR_RPM_MAX * 1.05, 400)
    f_c = n / 60 / RATIO
    orders = [("1× mesh", Z_RING * f_c, "#B8431F", 2.0),
              ("2× mesh", 2 * Z_RING * f_c, "#B8431F", 1.2),
              ("3× mesh", 3 * Z_RING * f_c, "#B8431F", 0.8),
              ("1× input shaft", n / 60, "#777", 1.0),
              ("planet pass (4×carrier)", 4 * f_c, "#999", 1.0)]
    for lab, y, col, lw in orders:
        ax[1].plot(n, y, color=col, lw=lw, ls="-" if "mesh" in lab else "--", label=lab)
    for name, col in (("output carrier", "#1F6FB2"), ("input shaft", "#2E9E5B")):
        for j, f in enumerate(MODES[name][:2]):
            ax[1].axhline(f, color=col, lw=1.1, alpha=0.85,
                          label=f"{name} mode 1 ({f:.0f} Hz)" if j == 0 else None)
    ax[1].axhline(sys_hz, color="#8E44AD", lw=1.4,
                  label=f"system mode, corrected ({sys_hz:.0f} Hz)")
    ax[1].axhline(9165.15, color="#8E44AD", lw=1.0, ls=":",
                  label="system mode as reported (9165 Hz — off scale)")
    ax[1].axvspan(MOTOR_RPM_MAX, MOTOR_RPM_MAX * 1.05, color="0.85", zorder=0)
    lowest = min(MODES["output carrier"])
    n_cross = lowest / (2 * Z_RING / (60 * RATIO))
    ax[1].plot([n_cross], [lowest], "o", color="crimson", ms=7, zorder=5)
    ax[1].annotate(f"2× mesh × carrier mode\n{n_cross:.0f} rpm", (n_cross - 1500, lowest + 500),
                   fontsize=7.5, color="crimson")
    ax[1].set_xlabel("motor speed  [rpm]")
    ax[1].set_ylabel("frequency  [Hz]")
    ax[1].set_title("(b) Campbell diagram, 0 – redline", fontsize=10)
    ax[1].set_ylim(0, 5200)
    ax[1].set_xlim(0, MOTOR_RPM_MAX * 1.05)
    ax[1].legend(fontsize=6, loc="upper left", ncol=1)

    # (c) points
    for ev, col in (("Endurance", "#C0392B"), ("Autocross", "#1F6FB2"),
                    ("SkidPad", "#2E9E5B"), ("Acceleration", "#E67E22")):
        f, gain = per_event[ev]
        ax[2].plot(100 * (rs - 1), gain, lw=1.8, color=col, label=f"{ev} ({100*f:.1f} % quicker)")
    ax[2].plot(100 * (rs - 1), total, lw=2.4, color="#151820", label="total")
    ax[2].set_xlabel("how far off the fastest car's pace  [%]")
    ax[2].set_ylabel("competition points gained")
    ax[2].set_title("(c) a second is worth more near the front", fontsize=10)
    ax[2].legend(fontsize=7, loc="center right")
    ax[2].annotate("", xy=(100 * (rs[0] - 1), total[0]),
                   xytext=(100 * (rs[-1] - 1), total[-1]),
                   arrowprops=dict(arrowstyle="<-", color="#151820", lw=1.2, alpha=0.5))
    ax[2].annotate(f"{total[0]:.0f} pts", (100 * (rs[0] - 1) + 0.4, total[0] + 0.6), fontsize=8)
    ax[2].annotate(f"{total[-1]:.0f} pts", (100 * (rs[-1] - 1) - 3.2, total[-1] - 2.2), fontsize=8)
    ax[2].set_ylim(0, total.max() * 1.18)

    for a in ax:
        a.grid(alpha=0.25, lw=0.6)
        for sp in ("top", "right"):
            a.spines[sp].set_visible(False)
    fig.tight_layout()
    for ext in ("pdf", "png"):
        fig.savefig(OUT / f"fsae_gearbox.{ext}", dpi=170, bbox_inches="tight")
    print("=" * 74)
    print(f"wrote {OUT/'fsae_gearbox.pdf'}")


if __name__ == "__main__":
    c = analysis_chain()
    t = analysis_teeth()
    s = analysis_campbell()
    p = analysis_points()
    figures(c, t, s, p)
