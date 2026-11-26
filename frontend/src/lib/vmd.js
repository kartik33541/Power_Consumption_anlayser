/**
 * Real Variational Mode Decomposition (Dragomiretskiy & Zosso, 2014)
 * Dependency-free FFT-based ADMM implementation for browser & Node.
 */

export const VMD_FS = 1000;
export const VMD_N = 1024;

function createSeededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates the fixed synthetic test signal (N=1024, fs=1000 Hz)
 * with three labelled components + fixed-seed noise.
 */
export function buildSyntheticSignal() {
  const N = VMD_N;
  const fs = VMD_FS;
  const rng = createSeededRng(1337);

  const grid = new Float64Array(N);
  const compressor = new Float64Array(N);
  const fan = new Float64Array(N);
  const noise = new Float64Array(N);
  const signal = new Float64Array(N);

  for (let n = 0; n < N; n++) {
    const t = n / fs;
    const c1 = 1.0 * Math.sin(2 * Math.PI * 50 * t);
    const c2 = 0.62 * Math.sin(2 * Math.PI * 150 * t + 0.4);
    const c3 = 0.42 * Math.sin(2 * Math.PI * 250 * t + 1.1);
    const nz = (rng() + rng() + rng() - 1.5) * 0.04;
    grid[n] = c1;
    compressor[n] = c2;
    fan[n] = c3;
    noise[n] = nz;
    signal[n] = c1 + c2 + c3 + nz;
  }

  return {
    signal,
    fs,
    N,
    components: [
      { id: 'grid', label: '50 Hz grid fundamental', color: 'var(--color-ac)', data: grid },
      { id: 'compressor', label: '~150 Hz compressor-like', color: 'var(--color-fridge)', data: compressor },
      { id: 'fan', label: '~250 Hz fan-like', color: 'var(--color-fan)', data: fan },
    ],
  };
}

/**
 * In-place radix-2 Cooley-Tukey FFT (inverse=true computes IFFT with 1/N scaling).
 */
function fft(re, im, inverse = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tr = re[i]; re[i] = re[j]; re[j] = tr;
      let ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }

  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const ang = (sign * 2 * Math.PI) / len;
    const wLenRe = Math.cos(ang);
    const wLenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < half; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * wRe - im[i + j + half] * wIm;
        const vIm = re[i + j + half] * wIm + im[i + j + half] * wRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nextRe = wRe * wLenRe - wIm * wLenIm;
        wIm = wRe * wLenIm + wIm * wLenRe;
        wRe = nextRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function energy(a) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * a[i];
  return s;
}

/**
 * Runs Variational Mode Decomposition on the synthetic (or supplied) signal.
 * @param {object} opts
 * @param {number} opts.K Number of modes (2..8)
 * @param {number} opts.alpha Bandwidth penalty parameter
 * @param {number} [opts.tau=0] Dual ascent step (0 for noise-tolerant)
 * @param {number} [opts.tol=1e-6] Convergence tolerance
 * @param {number} [opts.maxIter=100] Max ADMM iterations
 */
export function runVMD({ K = 3, alpha = 2000, tau = 0, tol = 1e-6, maxIter = 100 } = {}) {
  const synth = buildSyntheticSignal();
  const { signal, fs, N, components } = synth;

  // Mirror extension: T = 2 * N = 2048 (exact power of 2)
  const half = N >> 1;
  const T = N * 2;
  const fMirrorRe = new Float64Array(T);
  const fMirrorIm = new Float64Array(T);
  for (let i = 0; i < half; i++) {
    fMirrorRe[i] = signal[half - 1 - i];
  }
  for (let i = 0; i < N; i++) {
    fMirrorRe[half + i] = signal[i];
  }
  for (let i = 0; i < half; i++) {
    fMirrorRe[half + N + i] = signal[N - 1 - i];
  }

  // FFT and fftshift into centered [-0.5, 0.5)
  fft(fMirrorRe, fMirrorIm, false);
  const fHatRe = new Float64Array(T);
  const fHatIm = new Float64Array(T);
  for (let i = 0; i < T; i++) {
    const shifted = (i + half * 2) % T; // T/2 = N
    fHatRe[i] = fMirrorRe[shifted];
    fHatIm[i] = fMirrorIm[shifted];
  }

  // Normalized frequencies in [-0.5, 0.5) and analytic half [halfT .. T-1]
  const halfT = T >> 1; // 1024
  const freqs = new Float64Array(T);
  for (let i = 0; i < T; i++) {
    freqs[i] = i / T - 0.5;
  }

  // Allocate u_hat_plus for positive frequencies (length halfT)
  const uHatRe = Array.from({ length: K }, () => new Float64Array(halfT));
  const uHatIm = Array.from({ length: K }, () => new Float64Array(halfT));
  const uPrevRe = Array.from({ length: K }, () => new Float64Array(halfT));
  const uPrevIm = Array.from({ length: K }, () => new Float64Array(halfT));
  const sumRe = new Float64Array(halfT);
  const sumIm = new Float64Array(halfT);
  const lamRe = new Float64Array(halfT);
  const lamIm = new Float64Array(halfT);

  // Uniformly spaced initial center frequencies in [0.03, 0.40]
  const omega = new Float64Array(K);
  for (let k = 0; k < K; k++) {
    omega[k] = K === 1 ? 0.15 : 0.03 + (0.37 * k) / (K - 1);
  }

  let iterations = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;

    for (let k = 0; k < K; k++) {
      uPrevRe[k].set(uHatRe[k]);
      uPrevIm[k].set(uHatIm[k]);
    }

    // Sum of all modes
    sumRe.fill(0);
    sumIm.fill(0);
    for (let k = 0; k < K; k++) {
      for (let f = 0; f < halfT; f++) {
        sumRe[f] += uHatRe[k][f];
        sumIm[f] += uHatIm[k][f];
      }
    }

    // Update each mode k
    for (let k = 0; k < K; k++) {
      const ukRe = uHatRe[k];
      const ukIm = uHatIm[k];
      const wk = omega[k];
      let numOmega = 0;
      let denOmega = 0;

      for (let f = 0; f < halfT; f++) {
        const fi = halfT + f;
        const otherRe = sumRe[f] - ukRe[f];
        const otherIm = sumIm[f] - ukIm[f];
        const diff = freqs[fi] - wk;
        const denom = 1 + 2 * alpha * diff * diff;

        const nextRe = (fHatRe[fi] - otherRe + lamRe[f] * 0.5) / denom;
        const nextIm = (fHatIm[fi] - otherIm + lamIm[f] * 0.5) / denom;

        sumRe[f] = otherRe + nextRe;
        sumIm[f] = otherIm + nextIm;
        ukRe[f] = nextRe;
        ukIm[f] = nextIm;

        const pwr = nextRe * nextRe + nextIm * nextIm;
        numOmega += freqs[fi] * pwr;
        denOmega += pwr;
      }

      if (denOmega > 1e-18) {
        omega[k] = numOmega / denOmega;
      }
    }

    // Dual ascent if tau > 0
    if (tau > 0) {
      for (let f = 0; f < halfT; f++) {
        const fi = halfT + f;
        lamRe[f] += tau * (fHatRe[fi] - sumRe[f]);
        lamIm[f] += tau * (fHatIm[fi] - sumIm[f]);
      }
    }

    // Convergence check
    let uDiff = 0;
    for (let k = 0; k < K; k++) {
      for (let f = 0; f < halfT; f++) {
        const dr = uHatRe[k][f] - uPrevRe[k][f];
        const di = uHatIm[k][f] - uPrevIm[k][f];
        uDiff += (dr * dr + di * di) / T;
      }
    }
    if (uDiff < tol) break;
  }

  // Reconstruct time-domain modes & compute spectral bandwidth
  const modesRaw = [];
  const workRe = new Float64Array(T);
  const workIm = new Float64Array(T);

  for (let k = 0; k < K; k++) {
    // Build full Hermitian-symmetric spectrum in centered layout, then ifftshift
    workRe.fill(0);
    workIm.fill(0);
    for (let f = 0; f < halfT; f++) {
      const posIdx = halfT + f;
      const negIdx = halfT - f;
      const reVal = uHatRe[k][f];
      const imVal = uHatIm[k][f];
      const shiftedPos = (posIdx + halfT) % T;
      workRe[shiftedPos] = reVal;
      workIm[shiftedPos] = imVal;
      if (f > 0 && negIdx < T) {
        const shiftedNeg = (negIdx + halfT) % T;
        workRe[shiftedNeg] = reVal;
        workIm[shiftedNeg] = -imVal;
      }
    }
    fft(workRe, workIm, true);

    const timeSlice = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      timeSlice[n] = workRe[half + n];
    }

    // Spectral spread (full 2-sigma bandwidth in Hz) around omega[k]
    let pwrSum = 0;
    let varSum = 0;
    const wk = omega[k];
    for (let f = 0; f < halfT; f++) {
      const pwr = uHatRe[k][f] * uHatRe[k][f] + uHatIm[k][f] * uHatIm[k][f];
      const df = (freqs[halfT + f] - wk) * fs;
      pwrSum += pwr;
      varSum += df * df * pwr;
    }
    const stdHz = pwrSum > 1e-18 ? Math.sqrt(varSum / pwrSum) : 0;
    const bandwidthHz = Number((2 * stdHz).toFixed(2));

    modesRaw.push({
      centerFrequency: Number((omega[k] * fs).toFixed(1)),
      bandwidth: bandwidthHz,
      timeData: timeSlice,
      energy: energy(timeSlice),
    });
  }

  // Sort ascending by centerFrequency (canonical Stage 7 order)
  modesRaw.sort((a, b) => a.centerFrequency - b.centerFrequency);

  // Reconstruction SNR
  const recon = new Float64Array(N);
  for (let k = 0; k < K; k++) {
    const td = modesRaw[k].timeData;
    for (let n = 0; n < N; n++) recon[n] += td[n];
  }
  let resEnergy = 0;
  const sigEnergy = energy(signal);
  for (let n = 0; n < N; n++) {
    const diff = signal[n] - recon[n];
    resEnergy += diff * diff;
  }
  const reconSnrDb = resEnergy > 1e-12 ? Number((10 * Math.log10(sigEnergy / resEnergy)).toFixed(2)) : 60;

  // Normalize energy shares so they sum to exactly 100.0%
  const totalModeEnergy = modesRaw.reduce((s, m) => s + m.energy, 0) || 1;
  const compEnergies = components.map((c) => energy(c.data));

  const modes = modesRaw.map((m, idx) => {
    const sharePct = Number(((m.energy / totalModeEnergy) * 100).toFixed(1));
    const componentShares = {};
    components.forEach((c, ci) => {
      const p = dot(m.timeData, c.data);
      const frac = m.energy > 1e-12 && compEnergies[ci] > 1e-12
        ? (p * p) / (m.energy * compEnergies[ci])
        : 0;
      componentShares[c.id] = Number((Math.min(1, frac) * 100).toFixed(1));
    });

    return {
      modeIndex: idx + 1,
      centerFrequency: m.centerFrequency,
      bandwidth: m.bandwidth,
      energyShare: sharePct,
      componentShares,
    };
  });

  // Adjust rounding on largest-energy mode so energyShare sums to 100.0%
  if (modes.length > 0) {
    const sumShares = modes.reduce((s, m) => s + m.energyShare, 0);
    const delta = Number((100 - sumShares).toFixed(1));
    if (Math.abs(delta) > 0) {
      let maxIdx = 0;
      for (let i = 1; i < modes.length; i++) {
        if (modes[i].energyShare > modes[maxIdx].energyShare) maxIdx = i;
      }
      modes[maxIdx].energyShare = Number((modes[maxIdx].energyShare + delta).toFixed(1));
    }
  }

  return {
    K,
    alpha,
    iterations,
    reconSnrDb,
    modes,
    components: components.map(({ id, label, color }) => ({ id, label, color })),
  };
}
