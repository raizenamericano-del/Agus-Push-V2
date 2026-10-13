/** Sound effects kecil via Web Audio API — tanpa file audio eksternal */

import { getSettings } from "./storage.js";

function enabled() {
  try {
    return getSettings().sound !== false;
  } catch {
    return true;
  }
}

function ctx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  return AC ? new AC() : null;
}

function tone(ac, freq, start, dur, type = "sine", gain = 0.12) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
  o.connect(g).connect(ac.destination);
  o.start(ac.currentTime + start);
  o.stop(ac.currentTime + start + dur + 0.05);
}

/** Fanfare arpeggio saat build sukses 🎉 */
export function playSuccess() {
  if (!enabled()) return;
  try {
    const ac = ctx();
    if (!ac) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => tone(ac, f, i * 0.09, 0.5, "triangle", 0.14));
    tone(ac, 1318.5, 0.36, 0.7, "sine", 0.1); // E6 sparkle
  } catch {}
}

/** Bunyi kecil saat error */
export function playError() {
  if (!enabled()) return;
  try {
    const ac = ctx();
    if (!ac) return;
    tone(ac, 220, 0, 0.25, "sawtooth", 0.07);
    tone(ac, 174, 0.16, 0.4, "sawtooth", 0.07);
  } catch {}
}

/** Klik UI yang halus */
export function playClick() {
  if (!enabled()) return;
  try {
    const ac = ctx();
    if (!ac) return;
    tone(ac, 660, 0, 0.08, "sine", 0.06);
  } catch {}
}

/** Pop saat modal / aksi penting */
export function playPop() {
  if (!enabled()) return;
  try {
    const ac = ctx();
    if (!ac) return;
    tone(ac, 440, 0, 0.09, "triangle", 0.1);
    tone(ac, 880, 0.06, 0.12, "triangle", 0.09);
  } catch {}
}

/** Bunyi hapus (nada turun) */
export function playDelete() {
  if (!enabled()) return;
  try {
    const ac = ctx();
    if (!ac) return;
    tone(ac, 520, 0, 0.16, "sawtooth", 0.06);
    tone(ac, 330, 0.1, 0.2, "sawtooth", 0.06);
    tone(ac, 180, 0.2, 0.3, "sawtooth", 0.06);
  } catch {}
}
