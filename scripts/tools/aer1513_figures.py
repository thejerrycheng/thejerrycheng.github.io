#!/usr/bin/env python3
"""AER1513 — every figure on the project page, regenerated from scratch.

Run:  python3 scripts/tools/aer1513_figures.py [a1] [a2] [a3] [all]
"""
import pathlib
import sys
import time

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import aer1513_core as C

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = (ROOT / "assets/images/projects/aer1513") if (ROOT / "assets/js").is_dir() else (ROOT / "figures")
OUT.mkdir(parents=True, exist_ok=True)

INK, HI, BLUE, GREEN, GREY = "#151820", "#B8431F", "#1F6FB2", "#2E9E5B", "0.55"


def finish(fig, name):
    for ax in fig.axes:
        ax.grid(alpha=0.22, lw=0.6)
        for sp in ("top", "right"):
            ax.spines[sp].set_visible(False)
    fig.tight_layout()
    for ext in ("pdf", "png"):
        fig.savefig(OUT / f"{name}.{ext}", dpi=165, bbox_inches="tight")
    plt.close(fig)
    print(f"   wrote {name}.pdf/.png")


# =========================================================================== A1
def a1():
    print("A1 — the 1-D rail")
    r = C.Rail(K=400, seed=0)
    xb, sb, A, _ = r.batch()
    xk, sk = r.kalman()
    dr = r.dead_reckon()
    t = np.arange(r.K) * r.T

    print(f"   batch RMSE  {np.sqrt(np.mean((xb-r.x)**2)):.4f} m")
    print(f"   KF    RMSE  {np.sqrt(np.mean((xk-r.x)**2)):.4f} m")
    print(f"   dead reckon {np.sqrt(np.mean((dr-r.x)**2)):.4f} m")
    print(f"   |batch - KF| at the last step {abs(xb[-1]-xk[-1]):.2e}  "
          f"(theory says 0); mean over all steps {np.abs(xb-xk).mean():.4f}")

    fig, ax = plt.subplots(1, 3, figsize=(13.6, 3.7))
    ax[0].plot(t, r.x, color=INK, lw=1.6, label="truth")
    ax[0].plot(t, dr, color=GREY, lw=1.2, ls="--", label="dead reckoning")
    ax[0].plot(t, xb, color=HI, lw=1.4, label="batch")
    ax[0].set_xlabel("time [s]"); ax[0].set_ylabel("position [m]")
    ax[0].set_title("(a) the rail", fontsize=10); ax[0].legend(fontsize=7.5)

    ax[1].fill_between(t, -3 * sb, 3 * sb, color=HI, alpha=0.16, label="batch ±3σ")
    ax[1].plot(t, xb - r.x, color=HI, lw=1.0, label="batch error")
    ax[1].plot(t, 3 * sk, color=BLUE, lw=1.0, ls=":", label="KF ±3σ")
    ax[1].plot(t, -3 * sk, color=BLUE, lw=1.0, ls=":")
    ax[1].plot(t, xk - r.x, color=BLUE, lw=0.8, alpha=0.8, label="KF error")
    ax[1].set_xlabel("time [s]"); ax[1].set_ylabel("error [m]")
    ax[1].set_title("(b) the filter is only tight at the end", fontsize=10)
    ax[1].legend(fontsize=7, ncol=2)

    ax[2].semilogy(t, np.abs(xb - xk) + 1e-18, color=INK, lw=1.2)
    ax[2].set_xlabel("time [s]"); ax[2].set_ylabel("|batch − Kalman|  [m]")
    ax[2].set_title(f"(c) they agree exactly at k=K: {abs(xb[-1]-xk[-1]):.1e} m", fontsize=10)
    finish(fig, "a1_batch_vs_kf")

    # sparsity and the price of fewer measurements
    fig, ax = plt.subplots(1, 2, figsize=(10.4, 4.0))
    n = 60
    ax[0].spy(A[:n, :n], markersize=3, color=HI)
    nz = 100 * np.count_nonzero(A) / A.size
    ax[0].set_title(f"(a) A = HᵀW⁻¹H is block tridiagonal\n{nz:.2f} % nonzero at K = {r.K}", fontsize=10)
    ax[0].set_xlabel("state index"); ax[0].set_ylabel("state index")

    evs, rms, s3 = [], [], []
    for every in (1, 2, 5, 10, 20, 40, 80):
        xb2, sb2, _, used = r.batch(every=every)
        evs.append(used); rms.append(np.sqrt(np.mean((xb2 - r.x) ** 2))); s3.append(3 * sb2.mean())
    ax[1].loglog(evs, rms, "o-", color=HI, label="actual RMSE")
    ax[1].loglog(evs, s3, "s--", color=BLUE, label="mean 3σ the estimator reports")
    ax[1].set_xlabel("measurements used"); ax[1].set_ylabel("[m]")
    ax[1].set_title("(b) fewer measurements, and it knows it", fontsize=10)
    ax[1].legend(fontsize=8)
    finish(fig, "a1_sparsity")
    return dict(batch=float(np.sqrt(np.mean((xb - r.x) ** 2))),
                kf=float(np.sqrt(np.mean((xk - r.x) ** 2))),
                dr=float(np.sqrt(np.mean((dr - r.x) ** 2))),
                last_gap=float(abs(xb[-1] - xk[-1])), nz=float(nz))


# =========================================================================== A2
def a2():
    print("A2 — Lost in the Woods")
    w = C.Woods(K=900, seed=1)
    t = np.arange(w.K) * w.T
    res = {}

    fig, axes = plt.subplots(3, 3, figsize=(13.6, 7.2), sharex=True)
    for col, rmax in enumerate((1.0, 3.0, 5.0)):
        xh, Ph, nvis = w.ekf(rmax=rmax)
        e = xh - w.xt
        e[:, 2] = C.wrap(e[:, 2])
        rmse = np.sqrt(np.mean(e[:, 0] ** 2 + e[:, 1] ** 2))
        ins = []
        for i, (lab, unit) in enumerate((("x", "m"), ("y", "m"), ("θ", "rad"))):
            s3 = 3 * np.sqrt(Ph[:, i, i])
            ax = axes[i, col]
            ax.fill_between(t, -s3, s3, color=HI, alpha=0.16)
            ax.plot(t, e[:, i], color=INK, lw=0.7)
            ax.plot(t, s3, color=HI, lw=0.8, ls="--"); ax.plot(t, -s3, color=HI, lw=0.8, ls="--")
            ins.append(100 * np.mean(np.abs(e[:, i]) < s3))
            if col == 0:
                ax.set_ylabel(f"{lab} error [{unit}]")
            if i == 0:
                ax.set_title(f"r_max = {rmax:.0f} m · {nvis.mean():.1f} landmarks/step\n"
                             f"RMSE_xy = {rmse:.4f} m", fontsize=10)
            if i == 2:
                ax.set_xlabel("time [s]")
        res[rmax] = dict(rmse=float(rmse), vis=float(nvis.mean()),
                         inside=[float(v) for v in ins])
        print(f"   r_max {rmax}: {nvis.mean():5.2f} landmarks/step, RMSE_xy {rmse:.4f} m, "
              f"inside 3σ {ins[0]:.1f}/{ins[1]:.1f}/{ins[2]:.1f} %")
    finish(fig, "a2_error_3sigma")

    # plan view with covariance ellipses
    xh, Ph, nvis = w.ekf(rmax=3.0)
    dr = w.dead_reckon()
    fig, ax = plt.subplots(figsize=(7.4, 6.4))
    ax.plot(w.land[:, 0], w.land[:, 1], "o", color="#C8A24A", ms=9, mec=INK, mew=1.0,
            label="landmarks", zorder=3)
    ax.plot(dr[:, 0], dr[:, 1], color=GREY, lw=1.1, ls="--", label="dead reckoning")
    ax.plot(w.xt[:, 0], w.xt[:, 1], color=INK, lw=1.8, label="truth")
    ax.plot(xh[:, 0], xh[:, 1], color=HI, lw=1.2, label="EKF")
    th = np.linspace(0, 2 * np.pi, 60)
    for k in range(0, w.K, 45):
        P = Ph[k, :2, :2]
        vals, vecs = np.linalg.eigh(P)
        a, b = 3 * np.sqrt(np.maximum(vals, 1e-12))
        ang = np.arctan2(vecs[1, 0], vecs[0, 0])
        ex = xh[k, 0] + a * np.cos(th) * np.cos(ang) - b * np.sin(th) * np.sin(ang)
        ey = xh[k, 1] + a * np.cos(th) * np.sin(ang) + b * np.sin(th) * np.cos(ang)
        ax.plot(ex, ey, color=HI, lw=0.8, alpha=0.55)
    ax.set_aspect("equal"); ax.set_xlabel("x [m]"); ax.set_ylabel("y [m]")
    ax.set_title("Lost in the Woods, r_max = 3 m — 3σ ellipses every 4.5 s", fontsize=10)
    ax.legend(fontsize=8, loc="best")
    finish(fig, "a2_trajectory")

    # convergence from a bad initial condition, and the CRLB variant
    fig, ax = plt.subplots(1, 2, figsize=(12.4, 3.9))
    for x0, lab, col in (((0, 0, 0), "x̂₀ = x₀ (given)", INK),
                         ((1, 1, 0.1), "x̂₀ = (1, 1, 0.1)", HI),
                         ((10, 10, 10), "x̂₀ = (10, 10, 10)", BLUE),
                         ((9999, 9999, 9999), "x̂₀ = (9999, 9999, 9999)", GREEN)):
        xh2, _, _ = w.ekf(rmax=5.0, x0=(w.xt[0] if lab.startswith("x̂₀ = x₀") else x0))
        d = np.hypot(xh2[:, 0] - w.xt[:, 0], xh2[:, 1] - w.xt[:, 1])
        ax[0].semilogy(t, d + 1e-6, color=col, lw=1.2, label=lab)
        n_conv = int(np.argmax(d < 0.1)) if (d < 0.1).any() else -1
        print(f"   {lab:<28} converges below 0.1 m after {n_conv} steps ({n_conv*w.T:.1f} s)")
    ax[0].set_xlabel("time [s]"); ax[0].set_ylabel("position error [m]")
    ax[0].set_title("(a) it forgets a bad start", fontsize=10); ax[0].legend(fontsize=7.5)

    for crlb, lab, col in ((False, "EKF (Jacobians at x̂)", HI), (True, "CRLB (Jacobians at x)", BLUE)):
        xh3, Ph3, _ = w.ekf(rmax=1.0, x0=(1, 1, 0.1), crlb=crlb)
        e = np.hypot(xh3[:, 0] - w.xt[:, 0], xh3[:, 1] - w.xt[:, 1])
        ax[1].plot(t, e, color=col, lw=1.0, label=f"{lab} — RMSE {np.sqrt(np.mean(e**2)):.4f} m")
        print(f"   r_max 1, {lab}: RMSE {np.sqrt(np.mean(e**2)):.4f} m")
    ax[1].set_xlabel("time [s]"); ax[1].set_ylabel("position error [m]")
    ax[1].set_title("(b) the price of linearising about the estimate", fontsize=10)
    ax[1].legend(fontsize=7.5)
    finish(fig, "a2_initial_and_crlb")
    return res


# =========================================================================== A3
def a3(k1=10, k2=110, n_land=28):
    print("A3 — Starry Night")
    s = C.Starry(K=160, n_land=n_land, seed=3)
    nvis = np.array([len(o) for o in s.obs])
    span = np.arange(k1, k2 + 1)

    # Question 4: how many landmarks are actually visible
    fig, ax = plt.subplots(figsize=(11.0, 3.0))
    good = nvis >= 3
    ax.scatter(np.arange(len(nvis))[good], nvis[good], s=9, color=GREEN, label="≥ 3 landmarks")
    ax.scatter(np.arange(len(nvis))[~good], nvis[~good], s=12, color=HI, label="< 3 landmarks")
    ax.axvspan(k1, k2, color="0.85", zorder=0)
    ax.set_xlabel("timestep k"); ax.set_ylabel("landmarks visible")
    ax.set_title(f"Visible landmarks — {(~good).sum()} of {len(nvis)} steps see fewer than 3; "
                 f"the shaded span is the one estimated", fontsize=10)
    ax.legend(fontsize=8)
    finish(fig, "a3_visibility")
    print(f"   visible/step mean {nvis.mean():.2f}, {(nvis<3).sum()} of {len(nvis)} steps below 3")

    t0 = time.time()
    T_op, marg, costs, A = s.solve(k1, k2, iters=14)
    tb = time.time() - t0
    et, er = C.pose_errors(T_op, s.T_true[k1:k2 + 1])
    sig = np.array([np.sqrt(np.diag(m)) for m in marg])
    dr = s.dead_reckon(k1, k2)
    etd, erd = C.pose_errors(dr, s.T_true[k1:k2 + 1])
    rb = float(np.sqrt((et ** 2).sum(1).mean()))
    print(f"   batch {k2-k1+1} poses in {tb:.1f}s: trans RMSE {rb:.4f} m, "
          f"rot {1000*np.sqrt((er**2).sum(1).mean()):.2f} mrad")
    print(f"   dead reckoning:            trans RMSE {np.sqrt((etd**2).sum(1).mean()):.4f} m, "
          f"rot {1000*np.sqrt((erd**2).sum(1).mean()):.2f} mrad")

    # six-panel error with 3-sigma
    fig, axes = plt.subplots(2, 3, figsize=(13.6, 5.2), sharex=True)
    names = ["x", "y", "z", "θx", "θy", "θz"]
    for i in range(6):
        ax = axes[i // 3, i % 3]
        e = et[:, i] if i < 3 else er[:, i - 3]
        sc = 1.0 if i < 3 else 1000.0
        s3 = 3 * sig[:, i] * sc
        ax.fill_between(span, -s3, s3, color=HI, alpha=0.16)
        ax.plot(span, e * sc, color=INK, lw=0.8)
        ax.plot(span, s3, color=HI, lw=0.7, ls="--"); ax.plot(span, -s3, color=HI, lw=0.7, ls="--")
        for k in span[nvis[k1:k2 + 1] < 3]:
            ax.axvline(k, color=HI, alpha=0.10, lw=1.4, zorder=0)
        ax.set_title(f"{names[i]}   inside 3σ: {100*np.mean(np.abs(e*sc)<s3):.0f} %", fontsize=9)
        ax.set_ylabel("[m]" if i < 3 else "[mrad]")
        if i >= 3:
            ax.set_xlabel("timestep k")
    fig.suptitle("Batch SE(3) error against its own 3σ — shaded columns are steps with fewer than 3 landmarks",
                 fontsize=10.5)
    finish(fig, "a3_error_3sigma")

    # convergence
    fig, ax = plt.subplots(figsize=(6.0, 3.4))
    ax.semilogy(np.arange(1, len(costs) + 1), costs, "o-", color=HI, lw=1.6)
    ax.set_xlabel("Gauss-Newton iteration"); ax.set_ylabel("J(x)")
    ax.set_title(f"Cost falls {costs[0]/costs[-1]:.0f}× in {len(costs)} iterations", fontsize=10)
    finish(fig, "a3_convergence")

    # 3-D trajectory
    fig = plt.figure(figsize=(7.6, 6.2))
    ax = fig.add_subplot(111, projection="3d")
    P = np.array([C.se3_inv(T)[:3, 3] for T in s.T_true[k1:k2 + 1]])
    Pe = np.array([C.se3_inv(T)[:3, 3] for T in T_op])
    Pd = np.array([C.se3_inv(T)[:3, 3] for T in dr])
    ax.scatter(s.land[:, 0], s.land[:, 1], s.land[:, 2], s=22, color="#C8A24A",
               edgecolor=INK, linewidth=0.4, label="landmarks")
    ax.plot(Pd[:, 0], Pd[:, 1], Pd[:, 2], color=GREY, lw=1.0, ls="--", label="dead reckoning")
    ax.plot(P[:, 0], P[:, 1], P[:, 2], color=INK, lw=2.0, label="truth")
    ax.plot(Pe[:, 0], Pe[:, 1], Pe[:, 2], color=HI, lw=1.3, label="batch estimate")
    for i in range(0, len(T_op), 12):                     # body triads
        Tinv = C.se3_inv(T_op[i]); o = Tinv[:3, 3]; R = Tinv[:3, :3]
        for c, col in zip(range(3), (HI, GREEN, BLUE)):
            ax.plot(*[[o[d], o[d] + 0.6 * R[d, c]] for d in range(3)], color=col, lw=1.3)
    ax.set_xlabel("x [m]"); ax.set_ylabel("y [m]"); ax.set_zlabel("z [m]")
    ax.legend(fontsize=8, loc="upper left")
    ax.set_title("The estimated trajectory, with body triads every 12 steps", fontsize=10)
    for ext in ("pdf", "png"):
        fig.savefig(OUT / f"a3_trajectory3d.{ext}", dpi=165, bbox_inches="tight")
    plt.close(fig); print("   wrote a3_trajectory3d.pdf/.png")

    return dict(batch_rmse=rb, batch_s=tb, dr_rmse=float(np.sqrt((etd ** 2).sum(1).mean())),
                nvis=float(nvis.mean()), starve=int((nvis < 3).sum()))


def a3_window():
    """The batch-vs-window comparison, from the 3-seed sweep."""
    import json
    f = OUT / "a3_window_sweep.json"
    if not f.exists():
        print("   (no sweep json; run the sweep first)"); return
    d = json.load(open(f))
    order = ["dr", "w5", "w10", "w25", "w50", "batch"]
    lab = {"dr": "dead\nreckoning", "w5": "window 5", "w10": "window 10",
           "w25": "window 25", "w50": "window 50", "batch": "batch\n(all poses)"}
    tr = {k: np.array(d[k])[:, 0] for k in order}
    ro = {k: np.array(d[k])[:, 1] for k in order}
    tm = {k: np.array(d[k])[:, 2] for k in order}
    fig, ax = plt.subplots(1, 3, figsize=(13.4, 3.8))
    xs = np.arange(len(order))
    cols = [GREY] + [BLUE] * 4 + [HI]
    ax[0].bar(xs, [tr[k].mean() for k in order], yerr=[tr[k].std() for k in order],
              capsize=3, color=cols, alpha=0.9)
    ax[0].set_yscale("log"); ax[0].set_ylabel("translation RMSE [m]")
    ax[0].set_xticks(xs, [lab[k] for k in order], fontsize=7.5)
    ax[0].set_title("(a) accuracy — 3 seeds, mean ± sd", fontsize=10)
    ax[1].bar(xs, [ro[k].mean() for k in order], yerr=[ro[k].std() for k in order],
              capsize=3, color=cols, alpha=0.9)
    ax[1].set_yscale("log"); ax[1].set_ylabel("rotation RMSE [mrad]")
    ax[1].set_xticks(xs, [lab[k] for k in order], fontsize=7.5)
    ax[1].set_title("(b) rotation", fontsize=10)
    o2 = [k for k in order if k != "dr"]
    ax[2].bar(np.arange(len(o2)), [tm[k].mean() for k in o2],
              color=[BLUE] * 4 + [HI], alpha=0.9)
    ax[2].set_ylabel("solve time [s]")
    ax[2].set_xticks(np.arange(len(o2)), [lab[k] for k in o2], fontsize=7.5)
    ax[2].set_title("(c) and what it costs", fontsize=10)
    finish(fig, "a3_window")
    print(f"   batch {tr['batch'].mean():.4f} ± {tr['batch'].std():.4f} m in {tm['batch'].mean():.1f} s")
    for k in ("w5", "w10", "w25", "w50"):
        print(f"   {k:<6} {tr[k].mean():.4f} ± {tr[k].std():.4f} m in {tm[k].mean():.1f} s")


if __name__ == "__main__":
    which = [a for a in sys.argv[1:] if a in ("a1", "a2", "a3")] or ["a1", "a2", "a3"]
    if "a1" in which: a1()
    if "a2" in which: a2()
    if "a3" in which: a3(); a3_window()
