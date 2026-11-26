/**
 * Illustrative constants for the Hero Interactive NILM Panel.
 * All wattage, power factor, and tariff numbers are illustrative demo values.
 */
export const HERO_PANEL_CONFIG = {
  mainsLabel: 'LIVE AGGREGATE MAINS · 230V AC / 50HZ',
  demoChip: 'Demo data · Illustrative',
  exampleTariffInrPerKwh: 8, // Example tariff: ₹8 / kWh (not a measured rate)
  tariffLabel: 'example tariff ₹8/kWh',
  vmdNodeLabel: 'VMD',
  sensorCaption: 'SCT-013 sensor',
  aggregateBadge: 'AGGREGATE x(t) = Σ I_i(t) + n(t)',
  togglePrompt: 'CLICK ANY APPLIANCE TO TOGGLE LOAD',

  // Four default appliances (editable from this single constants file)
  appliances: [
    {
      id: 'ac',
      name: 'AC',
      watts: 1250,
      pf: 0.86,
      loadType: 'Inductive',
      defaultOn: true,
      darkColor: '#00e5ff',
      lightColor: '#006878',
      character: 'large' // larger amplitude fundamental + slight compressor distortion
    },
    {
      id: 'fridge',
      name: 'Fridge',
      watts: 180,
      pf: 0.78,
      loadType: 'Inductive',
      defaultOn: true,
      darkColor: '#34d399',
      lightColor: '#047857',
      character: 'periodic' // small & periodic duty-cycle ripple
    },
    {
      id: 'fan',
      name: 'Fan',
      watts: 75,
      pf: 0.92,
      loadType: 'Inductive',
      defaultOn: false,
      darkColor: '#ffb703',
      lightColor: '#92400e',
      character: 'steady' // clean steady low-amplitude sinusoid
    },
    {
      id: 'cooler',
      name: 'Cooler',
      watts: 220,
      pf: 0.81,
      loadType: 'Inductive',
      defaultOn: true,
      darkColor: '#a78bfa',
      lightColor: '#5b21b6',
      character: 'irregular' // irregular pump + blower harmonics
    }
  ]
};
