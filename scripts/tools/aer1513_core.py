#!/usr/bin/env python3
"""AER1513 State Estimation — the estimators, written once and shared.

Three assignments, one framework.  Every one of them is maximum a posteriori
estimation posed as a nonlinear least-squares problem,

    J(x) = 1/2 e(x)^T W^-1 e(x),      (H^T W^-1 H) dx = H^T W^-1 e(x_op),

and they differ only in what the state lives on:

  A1  x in R^n            linear-Gaussian, so one solve is exact
  A2  x = (x, y, theta)   nonlinear in a vector space, solved recursively (EKF)
  A3  T in SE(3)          nonlinear on a Lie group, so perturbations are not
                          additions and the Jacobians are adjoints

The course datasets are not redistributed.  Every experiment here generates its
own data from the models below, using the noise values reported in the
assignments, so the numbers are reproducible without them.
"""
import numpy as np

# ---------------------------------------------------------------------------
# small helpers
# ---------------------------------------------------------------------------

def wrap(a):
    """Wrap an angle to (-pi, pi]."""
    return (a + np.pi) % (2 * np.pi) - np.pi


def hat3(p):
    """The 3x3 skew-symmetric matrix such that hat3(a) @ b == cross(a, b)."""
    x, y, z = p
    return np.array([[0.0, -z, y], [z, 0.0, -x], [-y, x, 0.0]])


# ---------------------------------------------------------------------------
# SE(3), in Barfoot's conventions
# ---------------------------------------------------------------------------

def se3_hat(xi):
    """xi = [rho; phi] in R^6  ->  the 4x4 Lie algebra element xi^."""
    rho, phi = xi[:3], xi[3:]
    X = np.zeros((4, 4))
    X[:3, :3] = hat3(phi)
    X[:3, 3] = rho
    return X


def so3_exp(phi):
    """Rodrigues.  Returns the rotation matrix exp(phi^)."""
    t = np.linalg.norm(phi)
    if t < 1e-12:
        return np.eye(3) + hat3(phi)
    a = phi / t
    A = hat3(a)
    return np.cos(t) * np.eye(3) + (1 - np.cos(t)) * np.outer(a, a) + np.sin(t) * A


def so3_log(C):
    """Inverse of so3_exp, branch-cut safe near pi."""
    c = (np.trace(C) - 1.0) / 2.0
    t = np.arccos(np.clip(c, -1.0, 1.0))
    if t < 1e-10:
        return np.array([C[2, 1], C[0, 2], C[1, 0]]) * 0.5
    return t / (2 * np.sin(t)) * np.array([C[2, 1] - C[1, 2],
                                           C[0, 2] - C[2, 0],
                                           C[1, 0] - C[0, 1]])


def so3_left_jacobian(phi):
    """J such that exp((phi + dphi)^) ~= exp((J dphi)^) exp(phi^)."""
    t = np.linalg.norm(phi)
    if t < 1e-10:
        return np.eye(3) + 0.5 * hat3(phi)
    a = phi / t
    A = hat3(a)
    return (np.sin(t) / t * np.eye(3)
            + (1 - np.sin(t) / t) * np.outer(a, a)
            + (1 - np.cos(t)) / t * A)


def se3_exp(xi):
    """exp(xi^) for xi = [rho; phi]."""
    rho, phi = xi[:3], xi[3:]
    C = so3_exp(phi)
    J = so3_left_jacobian(phi)
    T = np.eye(4)
    T[:3, :3] = C
    T[:3, 3] = J @ rho
    return T


def se3_log(T):
    """ln(T)^v, the inverse of se3_exp."""
    C, r = T[:3, :3], T[:3, 3]
    phi = so3_log(C)
    J = so3_left_jacobian(phi)
    rho = np.linalg.solve(J, r)
    return np.concatenate([rho, phi])


def se3_inv(T):
    C, r = T[:3, :3], T[:3, 3]
    Ti = np.eye(4)
    Ti[:3, :3] = C.T
    Ti[:3, 3] = -C.T @ r
    return Ti


def adjoint(T):
    """Ad(T), the 6x6 that maps a perturbation through a rigid transform:
       T exp(xi^) = exp((Ad(T) xi)^) T."""
    C, r = T[:3, :3], T[:3, 3]
    A = np.zeros((6, 6))
    A[:3, :3] = C
    A[:3, 3:] = hat3(r) @ C
    A[3:, 3:] = C
    return A


def circle_dot(p):
    """The 4x6 operator with  xi^ p == (p)^{\\odot} xi, for homogeneous p."""
    eps, eta = p[:3], p[3]
    Z = np.zeros((4, 6))
    Z[:3, :3] = eta * np.eye(3)
    Z[:3, 3:] = -hat3(eps)
    return Z


# ---------------------------------------------------------------------------
# A1 — the 1-D rail: linear-Gaussian, so batch and the filter are the same thing
# ---------------------------------------------------------------------------

class Rail:
    """x_k = x_{k-1} + T v_k + w_k,   y_k = x_k + n_k.

    A robot on a rail with wheel odometry and a rangefinder to a wall. Both
    models are linear and both noises Gaussian, so the posterior is exactly
    Gaussian and one linear solve is the answer -- no iteration, no
    linearisation error. It is the only one of the three where that is true,
    which is what makes it the right place to start.
    """

    def __init__(self, K=500, T=0.1, sig_w=0.05, sig_n=0.05, seed=0):
        self.K, self.T, self.sig_w, self.sig_n = K, T, sig_w, sig_n
        rng = np.random.default_rng(seed)
        self.v = 0.6 * np.sin(np.arange(K) * T * 0.7) + 0.4
        self.x = np.zeros(K)
        for k in range(1, K):
            self.x[k] = self.x[k - 1] + T * self.v[k] + rng.normal(0, sig_w)
        self.y = self.x + rng.normal(0, sig_n, K)
        self.rng = rng

    # ---- batch ------------------------------------------------------------
    def batch(self, every=1, x0_var=1e-6):
        """Stack every constraint and solve once.

        Rows of H are the motion constraints  -x_{k-1} + x_k = T v_k  and the
        measurement constraints  x_k = y_k.  W is block-diagonal with the
        corresponding variances.  `every` keeps only every n-th measurement.
        """
        K, T = self.K, self.T
        rows, vals, cols, z, w = [], [], [], [], []
        r = 0
        # prior on x_0
        rows.append(r); cols.append(0); vals.append(1.0)
        z.append(0.0); w.append(x0_var); r += 1
        # motion
        for k in range(1, K):
            rows += [r, r]; cols += [k - 1, k]; vals += [-1.0, 1.0]
            z.append(T * self.v[k]); w.append(self.sig_w ** 2); r += 1
        # measurements
        used = list(range(0, K, every))
        for k in used:
            rows.append(r); cols.append(k); vals.append(1.0)
            z.append(self.y[k]); w.append(self.sig_n ** 2); r += 1
        H = np.zeros((r, K))
        H[rows, cols] = vals
        Winv = np.diag(1.0 / np.array(w))
        A = H.T @ Winv @ H
        b = H.T @ Winv @ np.array(z)
        xhat = np.linalg.solve(A, b)
        P = np.linalg.inv(A)
        return xhat, np.sqrt(np.diag(P)), A, len(used)

    # ---- the Kalman filter, which is the same solve done forwards ---------
    def kalman(self, every=1, x0_var=1e-6):
        K, T = self.K, self.T
        xh = np.zeros(K); Ph = np.zeros(K)
        xh[0], Ph[0] = 0.0, x0_var
        for k in range(1, K):
            xp = xh[k - 1] + T * self.v[k]
            Pp = Ph[k - 1] + self.sig_w ** 2
            if k % every == 0:
                Kk = Pp / (Pp + self.sig_n ** 2)
                xh[k] = xp + Kk * (self.y[k] - xp)
                Ph[k] = (1 - Kk) * Pp
            else:
                xh[k], Ph[k] = xp, Pp
        return xh, np.sqrt(Ph)

    def dead_reckon(self):
        x = np.zeros(self.K)
        for k in range(1, self.K):
            x[k] = x[k - 1] + self.T * self.v[k]
        return x


# ---------------------------------------------------------------------------
# A2 — Lost in the Woods: nonlinear in the plane, solved with an EKF
# ---------------------------------------------------------------------------

class Woods:
    """The planar range-bearing problem, with the report's noise values.

        [x y theta]_k = [x y theta]_{k-1} + T [[c,0],[s,0],[0,1]] ([v; om] + w)

        r^l_k   = sqrt((xl - x - d cos th)^2 + (yl - y - d sin th)^2)
        phi^l_k = atan2(yl - y - d sin th, xl - x - d cos th) - theta

    d is the offset of the laser rangefinder ahead of the robot centre, which is
    what puts theta into the range Jacobian and makes the problem observable in
    heading at all.
    """
    V_VAR, OM_VAR = 0.0044, 0.0082          # report eq. (1)
    R_VAR, B_VAR = 9.0036e-4, 6.7143e-4     # report eq. (2)

    def __init__(self, K=1200, T=0.1, d=0.2, n_land=17, seed=1):
        self.K, self.T, self.d = K, T, d
        rng = np.random.default_rng(seed)
        self.rng = rng
        t = np.arange(K) * T
        self.v = 0.55 + 0.25 * np.sin(0.35 * t)
        self.om = 0.75 * np.sin(0.21 * t) + 0.25 * np.cos(0.07 * t)
        # ground truth by integrating the noise-free input
        self.xt = np.zeros((K, 3))
        for k in range(1, K):
            th = self.xt[k - 1, 2]
            self.xt[k] = self.xt[k - 1] + T * np.array([np.cos(th) * self.v[k],
                                                        np.sin(th) * self.v[k],
                                                        self.om[k]])
            self.xt[k, 2] = wrap(self.xt[k, 2])
        # the inputs the estimator is given are the truth plus process noise
        self.vm = self.v + rng.normal(0, np.sqrt(self.V_VAR), K)
        self.omm = self.om + rng.normal(0, np.sqrt(self.OM_VAR), K)
        # landmarks scattered over the travelled area
        lo, hi = self.xt[:, :2].min(0) - 2.0, self.xt[:, :2].max(0) + 2.0
        self.land = rng.uniform(lo, hi, size=(n_land, 2))
        # range/bearing to every landmark at every step (0 = not seen)
        self.r = np.zeros((K, n_land)); self.b = np.zeros((K, n_land))
        for k in range(K):
            rr, bb = self.true_meas(self.xt[k])
            self.r[k] = rr + rng.normal(0, np.sqrt(self.R_VAR), n_land)
            self.b[k] = wrap(bb + rng.normal(0, np.sqrt(self.B_VAR), n_land))

    def true_meas(self, x):
        dx = self.land[:, 0] - x[0] - self.d * np.cos(x[2])
        dy = self.land[:, 1] - x[1] - self.d * np.sin(x[2])
        return np.hypot(dx, dy), wrap(np.arctan2(dy, dx) - x[2])

    # ---- the two Jacobians, exactly as derived in the report --------------
    def F(self, x, k):
        th = x[2]
        return np.array([[1.0, 0.0, -self.T * self.vm[k] * np.sin(th)],
                         [0.0, 1.0,  self.T * self.vm[k] * np.cos(th)],
                         [0.0, 0.0, 1.0]])

    def W(self, x, k):
        th = x[2]
        return np.array([[self.T * np.cos(th), 0.0],
                         [self.T * np.sin(th), 0.0],
                         [0.0, self.T]])

    def G(self, x, l):
        """d[r; phi]/d[x, y, theta] for one landmark."""
        d, th = self.d, x[2]
        dx = self.land[l, 0] - x[0] - d * np.cos(th)
        dy = self.land[l, 1] - x[1] - d * np.sin(th)
        rr = np.hypot(dx, dy)
        rr = max(rr, 1e-9)
        r2 = rr * rr
        return np.array([
            [-dx / rr, -dy / rr, (dx * d * np.sin(th) - dy * d * np.cos(th)) / rr],
            [dy / r2, -dx / r2, -1.0 - (d * np.cos(th) * dy + d * np.sin(th) * dx) / r2],
        ])

    def ekf(self, rmax=5.0, x0=None, P0=None, crlb=False):
        """The EKF, with the update stacked over however many landmarks are in
        range at this step. `crlb` evaluates every Jacobian at the true state,
        which is the Cramer-Rao version -- the best the filter could ever do."""
        K = self.K
        Q = np.diag([self.V_VAR, self.OM_VAR])
        R1 = np.diag([self.R_VAR, self.B_VAR])
        xh = np.zeros((K, 3)); Ph = np.zeros((K, 3, 3))
        xh[0] = self.xt[0] if x0 is None else np.asarray(x0, float)
        Ph[0] = np.diag([1.0, 1.0, 0.1]) if P0 is None else P0
        nvis = np.zeros(K, int)
        for k in range(1, K):
            # The state is ALWAYS propagated with the estimate -- the filter does
            # not know the truth. `crlb` changes only where the Jacobians are
            # evaluated, which is the whole point of the comparison: it isolates
            # the cost of linearising about x-hat instead of about x.
            th = xh[k - 1, 2]
            xp = xh[k - 1] + self.T * np.array([np.cos(th) * self.vm[k],
                                                np.sin(th) * self.vm[k], self.omm[k]])
            xp[2] = wrap(xp[2])
            lin = self.xt[k - 1] if crlb else xh[k - 1]
            Fk, Wk = self.F(lin, k), self.W(lin, k)
            Pp = Fk @ Ph[k - 1] @ Fk.T + Wk @ Q @ Wk.T

            vis = [l for l in range(len(self.land))
                   if 0 < self.r[k, l] < rmax]
            nvis[k] = len(vis)
            if not vis:
                xh[k], Ph[k] = xp, Pp
                continue
            # the innovation is always measured against the PREDICTED state;
            # only G moves to the true state under crlb
            linG = self.xt[k] if crlb else xp
            rr, bb = self.true_meas(xp)
            Gs, es = [], []
            for l in vis:
                Gs.append(self.G(linG, l))
                es.append([self.r[k, l] - rr[l], wrap(self.b[k, l] - bb[l])])
            Gk = np.vstack(Gs)
            e = np.concatenate(es)
            Rk = np.kron(np.eye(len(vis)), R1)
            S = Gk @ Pp @ Gk.T + Rk
            Kk = Pp @ Gk.T @ np.linalg.inv(S)
            xh[k] = xp + Kk @ e
            xh[k, 2] = wrap(xh[k, 2])
            Ph[k] = (np.eye(3) - Kk @ Gk) @ Pp
        return xh, Ph, nvis

    def dead_reckon(self):
        x = np.zeros((self.K, 3)); x[0] = self.xt[0]
        for k in range(1, self.K):
            th = x[k - 1, 2]
            x[k] = x[k - 1] + self.T * np.array([np.cos(th) * self.vm[k],
                                                 np.sin(th) * self.vm[k], self.omm[k]])
            x[k, 2] = wrap(x[k, 2])
        return x


# ---------------------------------------------------------------------------
# A3 — Starry Night: batch MAP on SE(3)
# ---------------------------------------------------------------------------

class Starry:
    """Poses on SE(3), an IMU giving the body-frame twist, and a stereo camera.

        T_k = Xi_k T_{k-1},           Xi_k = exp(dt varpi_k^)
        y^j_k = (1/z) M T_cv T_k p^{pj,i}_i

    with the 4x4 stereo intrinsic matrix M.  The state is a sequence of group
    elements, so the estimator perturbs on the LEFT, T = exp(eps^) T_op, and the
    Jacobians come out as an adjoint and a circle-dot rather than as partial
    derivatives of coordinates.
    """
    # report eq. (1) and (2): per-second variances, and stereo pixel variances
    Q_DIAG = np.array([0.0026, 0.0021, 0.00079, 0.0090, 0.017, 0.17])
    R_DIAG = np.array([37.98, 129.84, 41.95, 132.49])

    def __init__(self, K=180, dt=0.1, n_land=20, seed=3):
        self.K, self.dt = K, dt
        rng = np.random.default_rng(seed)
        self.rng = rng
        # stereo intrinsics, a plausible rectified pair
        self.fu, self.fv, self.cu, self.cv, self.b = 390.0, 390.0, 320.0, 240.0, 0.24
        self.M = np.array([
            [self.fu, 0, self.cu, 0],
            [0, self.fv, self.cv, 0],
            [self.fu, 0, self.cu, -self.fu * self.b],
            [0, self.fv, self.cv, 0]])
        # camera mounted looking along the vehicle's +x, z up -> camera z forward
        C_cv = np.array([[0.0, -1.0, 0.0], [0.0, 0.0, -1.0], [1.0, 0.0, 0.0]])
        self.T_cv = np.eye(4)
        self.T_cv[:3, :3] = C_cv
        self.T_cv[:3, 3] = C_cv @ (-np.array([0.05, 0.0, 0.10]))

        t = np.arange(K) * dt
        # a gentle 3-D spiral, so all six degrees of freedom are exercised
        self.varpi = np.stack([
            0.9 + 0.15 * np.sin(0.6 * t), 0.05 * np.sin(0.4 * t), 0.10 * np.cos(0.3 * t),
            0.05 * np.sin(0.5 * t), 0.08 * np.sin(0.25 * t), 0.35 + 0.1 * np.cos(0.2 * t)
        ], axis=1)
        self.T_true = [np.eye(4)]
        for k in range(1, K):
            self.T_true.append(se3_exp(dt * self.varpi[k]) @ self.T_true[-1])
        # the IMU the estimator gets is the truth plus noise
        sd = np.sqrt(self.Q_DIAG)
        self.varpi_m = self.varpi + rng.normal(0, sd, size=(K, 6)) / np.sqrt(dt)

        # Landmarks are seeded the way a real feature map arises: pick a pose,
        # pick a pixel and a depth inside that camera's frustum, and put the
        # landmark where that ray lands. This guarantees the map is actually
        # observable, instead of scattering points that never enter frame.
        land = []
        while len(land) < n_land:
            k = rng.integers(0, K)
            u = rng.uniform(60, 580); v = rng.uniform(60, 420)
            z = rng.uniform(3.0, 22.0)
            x = (u - self.cu) * z / self.fu
            y = (v - self.cv) * z / self.fv
            p_c = np.array([x, y, z, 1.0])
            p_i = se3_inv(self.T_true[k]) @ se3_inv(self.T_cv) @ p_c
            land.append(p_i[:3])
        self.land = np.array(land)

        # stereo observations, only where the landmark is in front and in frame
        self.obs = []
        for k in range(K):
            row = {}
            for j in range(n_land):
                y = self.project(self.T_true[k], self.land[j])
                if y is None:
                    continue
                row[j] = y + rng.normal(0, np.sqrt(self.R_DIAG))
            self.obs.append(row)

    # ---- the observation model and its derivative -------------------------
    def cam_point(self, T, p_i):
        p = np.append(p_i, 1.0)
        return (self.T_cv @ T @ p)[:3]

    def project(self, T, p_i, frame=(640, 480)):
        pc = self.cam_point(T, p_i)
        x, y, z = pc
        if z < 0.5 or z > 60.0:
            return None
        u_l = self.fu * x / z + self.cu
        v_l = self.fv * y / z + self.cv
        u_r = self.fu * (x - self.b) / z + self.cu
        v_r = v_l
        if not (0 <= u_l <= frame[0] and 0 <= v_l <= frame[1]
                and 0 <= u_r <= frame[0]):
            return None
        return np.array([u_l, v_l, u_r, v_r])

    def dg_dz(self, pc):
        """The 4x3 dg/dz of the stereo model, report eq. (51)."""
        x, y, z = pc
        return np.array([
            [self.fu / z, 0, -self.fu * x / z ** 2],
            [0, self.fv / z, -self.fv * y / z ** 2],
            [self.fu / z, 0, -self.fu * (x - self.b) / z ** 2],
            [0, self.fv / z, -self.fv * y / z ** 2]])

    def g_of(self, pc):
        x, y, z = pc
        return np.array([self.fu * x / z + self.cu, self.fv * y / z + self.cv,
                         self.fu * (x - self.b) / z + self.cu, self.fv * y / z + self.cv])

    # ---- batch Gauss-Newton over a span of poses --------------------------
    def solve(self, k1, k2, iters=12, T_init=None, prior_P=1e-4, prior=None):
        """Batch MAP over poses k1..k2 inclusive. Returns the operating point,
        the marginal 6x6 covariances, and the cost per iteration.

        `prior` is (T_check, P_check) on the FIRST pose of the span. It defaults
        to the true pose with a tight covariance, which is the initial condition
        the assignment specifies for the batch problem. A sliding window must
        pass its own previous estimate here instead -- anchoring every window to
        ground truth would hand the estimator the answer once per timestep, and
        makes any window look as good as batch."""
        n = k2 - k1 + 1
        dt = self.dt
        Qinv = np.diag(1.0 / (self.Q_DIAG * dt))
        Rinv = np.diag(1.0 / self.R_DIAG)
        if T_init is None:
            T_op = [self.T_true[k1].copy()]
            for k in range(k1 + 1, k2 + 1):
                T_op.append(se3_exp(dt * self.varpi_m[k]) @ T_op[-1])
        else:
            T_op = [T.copy() for T in T_init]
        if prior is None:
            T_check, P_check = self.T_true[k1], prior_P * np.eye(6)
        else:
            T_check, P_check = prior
        P0inv = np.linalg.inv(P_check)
        costs = []
        for _ in range(iters):
            A = np.zeros((6 * n, 6 * n))
            bb = np.zeros(6 * n)
            cost = 0.0
            # prior on the first pose of the span
            e0 = se3_log(T_check @ se3_inv(T_op[0]))
            A[:6, :6] += P0inv
            bb[:6] += P0inv @ e0
            cost += 0.5 * e0 @ P0inv @ e0
            # motion constraints
            for i in range(1, n):
                k = k1 + i
                Xi = se3_exp(dt * self.varpi_m[k])
                ev = se3_log(Xi @ T_op[i - 1] @ se3_inv(T_op[i]))
                F = adjoint(T_op[i] @ se3_inv(T_op[i - 1]))
                # e_v,k ~= e_v,k(x_op) + F eps_{k-1} - eps_k, and the normal
                # equations are written for e ~= e(x_op) - H dx, so H carries
                # the opposite sign: -F on the sub-diagonal, +1 on the diagonal.
                # This is eq. (59) of the report, and getting it backwards makes
                # the motion block fight the measurement block instead of
                # agreeing with it.
                Hb = np.zeros((6, 6 * n))
                Hb[:, 6 * (i - 1):6 * i] = -F
                Hb[:, 6 * i:6 * (i + 1)] = np.eye(6)
                A += Hb.T @ Qinv @ Hb
                bb += Hb.T @ Qinv @ ev
                cost += 0.5 * ev @ Qinv @ ev
            # measurements
            for i in range(n):
                k = k1 + i
                for j, y in self.obs[k].items():
                    pc = self.cam_point(T_op[i], self.land[j])
                    if pc[2] < 0.2:
                        continue
                    ey = y - self.g_of(pc)
                    Gj = self.dg_dz(pc) @ (np.eye(3, 4) @ self.T_cv @ circle_dot(
                        T_op[i] @ np.append(self.land[j], 1.0)))
                    Hb = np.zeros((4, 6 * n))
                    Hb[:, 6 * i:6 * (i + 1)] = Gj
                    A += Hb.T @ Rinv @ Hb
                    bb += Hb.T @ Rinv @ ey
                    cost += 0.5 * ey @ Rinv @ ey
            costs.append(cost)
            dx = np.linalg.solve(A + 1e-9 * np.eye(6 * n), bb)
            # Backtracking line search. Plain Gauss-Newton can overshoot on a
            # manifold -- the quadratic model is only good near the operating
            # point -- so halve the step until the cost actually decreases.
            step = 1.0
            for _ in range(8):
                cand = [se3_exp(step * dx[6 * i:6 * i + 6]) @ T_op[i] for i in range(n)]
                if self._cost(cand, k1, k2, Qinv, Rinv, P0inv, T_check) <= cost:
                    break
                step *= 0.5
            T_op = cand
            if np.linalg.norm(step * dx) < 1e-10:
                break
        P = np.linalg.inv(A + 1e-9 * np.eye(6 * n))
        marg = [P[6 * i:6 * i + 6, 6 * i:6 * i + 6] for i in range(n)]
        return T_op, marg, costs, A

    def _cost(self, T_op, k1, k2, Qinv, Rinv, P0inv, T_check=None):
        """The objective J(x) at a candidate operating point, for the line search."""
        n = k2 - k1 + 1
        e0 = se3_log((self.T_true[k1] if T_check is None else T_check) @ se3_inv(T_op[0]))
        cost = 0.5 * e0 @ P0inv @ e0
        for i in range(1, n):
            Xi = se3_exp(self.dt * self.varpi_m[k1 + i])
            ev = se3_log(Xi @ T_op[i - 1] @ se3_inv(T_op[i]))
            cost += 0.5 * ev @ Qinv @ ev
        for i in range(n):
            for j, y in self.obs[k1 + i].items():
                pc = self.cam_point(T_op[i], self.land[j])
                if pc[2] < 0.2:
                    continue
                ey = y - self.g_of(pc)
                cost += 0.5 * ey @ Rinv @ ey
        return cost

    def sliding(self, k1, k2, win, iters=12):
        """Solve a window ending at each step and keep only its newest pose.

        Warm-started from the previous window's solution, which is what a real
        sliding-window estimator does: the poses the two windows share are
        already converged, and only the pose that just entered needs to be
        propagated in. Re-initialising each window by dead reckoning instead
        makes big windows look worse than small ones, which is an artefact of
        the iteration budget rather than a property of the window.
        """
        out, margs = [], []
        prev = None                              # (start index, poses, marginals)
        for k in range(k1, k2 + 1):
            a = max(k1, k - win + 1)
            if prev is None:
                init, prior = None, None         # first window: the given initial condition
            else:
                pa, pT, pM = prev
                keep_i = [i for i in range(len(pT)) if pa + i >= a]
                keep = [pT[i] for i in keep_i]
                init = keep + [se3_exp(self.dt * self.varpi_m[k]) @ keep[-1]]
                # the pose leaving the window becomes the prior on the new first
                # pose, carrying its own marginal covariance forward
                j = keep_i[0]
                prior = (pT[j], pM[j] + 1e-9 * np.eye(6))
            T_op, marg, _, _ = self.solve(a, k, iters=iters, T_init=init, prior=prior)
            prev = (a, T_op, marg)
            out.append(T_op[-1]); margs.append(marg[-1])
        return out, margs

    def dead_reckon(self, k1, k2):
        T = [self.T_true[k1].copy()]
        for k in range(k1 + 1, k2 + 1):
            T.append(se3_exp(self.dt * self.varpi_m[k]) @ T[-1])
        return T


def pose_errors(T_est, T_true):
    """[translation, rotation] error per pose, in the body frame."""
    et, er = [], []
    for Te, Tt in zip(T_est, T_true):
        xi = se3_log(Tt @ se3_inv(Te))
        et.append(xi[:3]); er.append(xi[3:])
    return np.array(et), np.array(er)
