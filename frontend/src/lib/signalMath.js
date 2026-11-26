/**
 * NILM Signal Physics & Waveform Simulation
 * Provides physically grounded synthetic waveforms for interactive demos.
 */

export const APPLIANCE_SPECS = {
  ac: {
    name: "Air Conditioner",
    rmsCurrent: 6.2,     // Amperes
    phaseLag: 0.52,      // ~30 degrees (PF ~0.87)
    harmonics: [
      { order: 1, amp: 8.7, phase: 0.52 },
      { order: 3, amp: 0.9, phase: 1.1 },
      { order: 5, amp: 0.4, phase: 0.8 }
    ]
  },
  fridge: {
    name: "Refrigerator",
    rmsCurrent: 1.4,     // Amperes
    phaseLag: 0.78,      // ~45 degrees (PF ~0.71)
    harmonics: [
      { order: 1, amp: 1.95, phase: 0.78 },
      { order: 3, amp: 0.35, phase: 1.4 },
      { order: 5, amp: 0.18, phase: 1.9 }
    ]
  },
  fan: {
    name: "Ceiling Fan",
    rmsCurrent: 0.35,    // Amperes
    phaseLag: 0.85,      // ~49 degrees (PF ~0.65)
    harmonics: [
      { order: 1, amp: 0.49, phase: 0.85 },
      { order: 3, amp: 0.12, phase: 1.2 },
      { order: 7, amp: 0.05, phase: 2.1 }
    ]
  }
};

/**
 * Generate waveform points for a specific appliance
 */
export function getApplianceWaveform(applianceKey, timeOffset, numPoints = 200, cycles = 2.5) {
  const spec = APPLIANCE_SPECS[applianceKey];
  if (!spec) return [];

  const points = [];
  const f0 = 50; // 50 Hz grid fundamental
  const dt = (cycles / f0) / numPoints;

  for (let i = 0; i < numPoints; i++) {
    const t = timeOffset + i * dt;
    let current = 0;
    for (const h of spec.harmonics) {
      current += h.amp * Math.sin(2 * Math.PI * (f0 * h.order) * t - h.phase);
    }
    points.push({ x: i / (numPoints - 1), y: current, t });
  }

  return points;
}

/**
 * Synthesizes aggregate current x(t) = AC(t) + Fridge(t) + Fan(t) + noise(t)
 */
export function synthesizeAggregateSignal({ acOn, fridgeOn, fanOn, timeOffset, numPoints = 200, cycles = 2.5, noiseLevel = 0.08 }) {
  const f0 = 50;
  const dt = (cycles / f0) / numPoints;
  const acPoints = [];
  const fridgePoints = [];
  const fanPoints = [];
  const sumPoints = [];

  for (let i = 0; i < numPoints; i++) {
    const t = timeOffset + i * dt;
    const normX = i / (numPoints - 1);

    // AC
    let acVal = 0;
    if (acOn) {
      for (const h of APPLIANCE_SPECS.ac.harmonics) {
        acVal += h.amp * Math.sin(2 * Math.PI * (f0 * h.order) * t - h.phase);
      }
    }
    acPoints.push({ x: normX, y: acVal });

    // Fridge
    let fridgeVal = 0;
    if (fridgeOn) {
      for (const h of APPLIANCE_SPECS.fridge.harmonics) {
        fridgeVal += h.amp * Math.sin(2 * Math.PI * (f0 * h.order) * t - h.phase);
      }
    }
    fridgePoints.push({ x: normX, y: fridgeVal });

    // Fan
    let fanVal = 0;
    if (fanOn) {
      for (const h of APPLIANCE_SPECS.fan.harmonics) {
        fanVal += h.amp * Math.sin(2 * Math.PI * (f0 * h.order) * t - h.phase);
      }
    }
    fanPoints.push({ x: normX, y: fanVal });

    // Noise
    const noise = (Math.sin(i * 12.7 + timeOffset * 300) * 0.5 + Math.cos(i * 31.3) * 0.5) * noiseLevel;
    const sumVal = acVal + fridgeVal + fanVal + noise;
    sumPoints.push({ x: normX, y: sumVal });
  }

  return { acPoints, fridgePoints, fanPoints, sumPoints };
}

/**
 * Simulates K VMD modes sorted by center frequency
 */
export function simulateVMDModes(k = 5) {
  // Center frequencies in Hz for 50 Hz fundamental system
  const centerFrequencies = [
    50,   // Fundamental (Mode 1)
    150,  // 3rd harmonic (Mode 2)
    250,  // 5th harmonic (Mode 3)
    350,  // 7th harmonic (Mode 4)
    550,  // High-order switching band (Mode 5)
    750,  // Mode 6
    950,  // Mode 7
    1200  // Mode 8
  ].slice(0, k);

  return centerFrequencies.map((fc, idx) => {
    // Mode characteristics & contributor ratios
    let acContrib = 0.5;
    let fridgeContrib = 0.35;
    let fanContrib = 0.15;
    let status = "Mixed contributions";

    if (idx === 0) {
      // 50 Hz fundamental: AC is largest current, fridge second, fan third
      acContrib = 0.65;
      fridgeContrib = 0.28;
      fanContrib = 0.07;
      status = "Fundamental grid load (Heavily mixed)";
    } else if (idx === 1) {
      // 150 Hz 3rd harmonic: Motors & non-linear rectification
      acContrib = 0.45;
      fridgeContrib = 0.30;
      fanContrib = 0.25;
      status = "3rd Harmonic band (Mixed motor profiles)";
    } else if (idx === 2) {
      // 250 Hz 5th harmonic: compressor and inverter signatures
      acContrib = 0.55;
      fridgeContrib = 0.35;
      fanContrib = 0.10;
      status = "5th Harmonic band (Compressor dominant)";
    } else {
      acContrib = 0.40;
      fridgeContrib = 0.30;
      fanContrib = 0.30;
      status = "High-order band (Mixed noise & transients)";
    }

    return {
      modeIndex: idx + 1,
      centerFrequency: fc,
      bandwidth: Math.round(fc * 0.18 + 15),
      energyShare: Math.max(8, Math.round(100 / (idx * 1.5 + 1))),
      contributions: {
        ac: Math.round(acContrib * 100),
        fridge: Math.round(fridgeContrib * 100),
        fan: Math.round(fanContrib * 100)
      },
      status
    };
  });
}
