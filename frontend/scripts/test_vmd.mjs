import assert from 'assert';
import { runVMD } from '../src/lib/vmd.js';

const ks = [2, 3, 5, 8];
const rows = [];

for (const K of ks) {
  const res = runVMD({ K, alpha: 2000 });
  const sumShare = Number(res.modes.reduce((s, m) => s + m.energyShare, 0).toFixed(1));
  assert.strictEqual(res.modes.length, K, `Expected ${K} modes, got ${res.modes.length}`);
  assert.ok(Math.abs(sumShare - 100) <= 0.1, `Energy shares must sum to 100%, got ${sumShare}`);

  if (K === 3) {
    assert.ok(res.reconSnrDb > 20, `Expected Recon SNR > 20 dB at K=3, got ${res.reconSnrDb}`);
    const freqs = res.modes.map((m) => m.centerFrequency);
    assert.ok(Math.abs(freqs[0] - 50) <= 5, `Mode 1 expected near 50 Hz, got ${freqs[0]}`);
    assert.ok(Math.abs(freqs[1] - 150) <= 5, `Mode 2 expected near 150 Hz, got ${freqs[1]}`);
    assert.ok(Math.abs(freqs[2] - 250) <= 5, `Mode 3 expected near 250 Hz, got ${freqs[2]}`);
  }

  rows.push({
    K,
    cards: res.modes.length,
    centerFreqsHz: res.modes.map((m) => m.centerFrequency),
    bandwidthsHz: res.modes.map((m) => m.bandwidth),
    energySharesPct: res.modes.map((m) => m.energyShare),
    sumSharePct: sumShare,
    reconSnrDb: res.reconSnrDb,
    iterations: res.iterations,
  });
}

// Verify alpha genuinely changes bandwidth & Recon SNR
const lowAlpha = runVMD({ K: 3, alpha: 500 });
const highAlpha = runVMD({ K: 3, alpha: 5000 });
assert.notStrictEqual(lowAlpha.modes[0].bandwidth, highAlpha.modes[0].bandwidth, 'Alpha must change mode bandwidth');
assert.notStrictEqual(lowAlpha.reconSnrDb, highAlpha.reconSnrDb, 'Alpha must change Recon SNR');

console.log('VMD_UNIT_TEST: PASS');
console.log('VMD_QA_TABLE:', JSON.stringify(rows, null, 2));
console.log('ALPHA_COMPARISON:', JSON.stringify({
  alpha500: { bw0: lowAlpha.modes[0].bandwidth, snr: lowAlpha.reconSnrDb },
  alpha5000: { bw0: highAlpha.modes[0].bandwidth, snr: highAlpha.reconSnrDb },
}));
