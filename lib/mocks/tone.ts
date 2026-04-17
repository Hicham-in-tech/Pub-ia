/**
 * Tiny synthetic WAV generator for the dev:mock flow. Produces a ~1.8s
 * syllabic amplitude-modulated tone that actually moves the lipsync mouth —
 * flat sines make Rouda look paralyzed.
 *
 * 8 kHz mono 16-bit. Returns a base64 data URL so MSW can return it inline.
 */
export function makeBabbleWav(opts?: { seconds?: number; seed?: number; freq?: number }): string {
  const seconds = opts?.seconds ?? 1.8;
  const seed = opts?.seed ?? 1;
  const freq = opts?.freq ?? 180;
  const sampleRate = 8000;
  const samples = Math.floor(sampleRate * seconds);
  const bytesPerSample = 2;
  const dataBytes = samples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const dv = new DataView(buffer);

  // RIFF header
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  dv.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * bytesPerSample, true);
  dv.setUint16(32, bytesPerSample, true);
  dv.setUint16(34, 16, true);
  writeStr(36, "data");
  dv.setUint32(40, dataBytes, true);

  // Samples: carrier with syllabic envelope + formant wobble
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const syllable = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3.5 * t + seed); // ~3.5 Hz syllable rate
    const formant = Math.sin(2 * Math.PI * (freq + seed * 11) * t)
      + 0.6 * Math.sin(2 * Math.PI * (freq * 2 + 30) * t)
      + 0.3 * Math.sin(2 * Math.PI * (freq * 3.2 + seed * 7) * t);
    const sample = Math.max(-1, Math.min(1, syllable * formant * 0.28));
    dv.setInt16(44 + i * 2, Math.round(sample * 0x7fff), true);
  }

  let bin = "";
  const u8 = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(u8.subarray(i, Math.min(i + chunk, u8.length))),
    );
  }
  const b64 = btoa(bin);
  return `data:audio/wav;base64,${b64}`;
}
