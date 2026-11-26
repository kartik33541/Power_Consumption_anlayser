import { runVMD } from '../lib/vmd';

self.onmessage = (e) => {
  const { id, K, alpha } = e.data;
  try {
    const result = runVMD({ K, alpha });
    self.postMessage({ id, ok: true, result });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err?.message || 'VMD failed' });
  }
};
