let sharedAudioContext: AudioContext | null = null;
const NOTIFICATION_MASTER_VOLUME = 1.45;

function getAudioContext() {
  if (typeof window === 'undefined') return null;

  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) return null;

  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextClass();
  }

  return sharedAudioContext;
}

export async function primeNotificationSound() {
  const audioContext = getAudioContext();
  if (!audioContext || audioContext.state !== 'suspended') return;

  try {
    await audioContext.resume();
  } catch {
    // Ignore autoplay-policy resume failures until the next user interaction.
  }
}

export async function playNotificationPing() {
  const audioContext = getAudioContext();
  if (!audioContext) return;

  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
    } catch {
      return;
    }
  }

  const startAt = audioContext.currentTime;

  // Keep the signal loud and attention-grabbing while still compressing peaks.
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-40, startAt);
  compressor.knee.setValueAtTime(24, startAt);
  compressor.ratio.setValueAtTime(18, startAt);
  compressor.attack.setValueAtTime(0.001, startAt);
  compressor.release.setValueAtTime(0.18, startAt);

  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0.0001, startAt);
  masterGain.gain.exponentialRampToValueAtTime(NOTIFICATION_MASTER_VOLUME, startAt + 0.014);
  masterGain.gain.exponentialRampToValueAtTime(0.52, startAt + 0.18);
  masterGain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.62);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.28);
  masterGain.connect(compressor);
  compressor.connect(audioContext.destination);

  const toneA = audioContext.createOscillator();
  toneA.type = 'square';
  toneA.frequency.setValueAtTime(1020, startAt);
  toneA.frequency.exponentialRampToValueAtTime(1180, startAt + 0.14);

  const gainA = audioContext.createGain();
  gainA.gain.setValueAtTime(0.0001, startAt);
  gainA.gain.exponentialRampToValueAtTime(1.0, startAt + 0.01);
  gainA.gain.exponentialRampToValueAtTime(0.48, startAt + 0.16);
  gainA.gain.exponentialRampToValueAtTime(0.12, startAt + 0.38);
  gainA.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.92);
  toneA.connect(gainA);
  gainA.connect(masterGain);

  const toneB = audioContext.createOscillator();
  toneB.type = 'triangle';
  toneB.frequency.setValueAtTime(1440, startAt + 0.18);
  toneB.frequency.exponentialRampToValueAtTime(1720, startAt + 0.42);

  const gainB = audioContext.createGain();
  gainB.gain.setValueAtTime(0.0001, startAt + 0.17);
  gainB.gain.exponentialRampToValueAtTime(0.84, startAt + 0.2);
  gainB.gain.exponentialRampToValueAtTime(0.22, startAt + 0.44);
  gainB.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.96);
  toneB.connect(gainB);
  gainB.connect(masterGain);

  const airTone = audioContext.createOscillator();
  airTone.type = 'triangle';
  airTone.frequency.setValueAtTime(1960, startAt + 0.12);
  airTone.frequency.exponentialRampToValueAtTime(1760, startAt + 0.26);

  const airGain = audioContext.createGain();
  airGain.gain.setValueAtTime(0.0001, startAt + 0.11);
  airGain.gain.exponentialRampToValueAtTime(0.28, startAt + 0.15);
  airGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.34);
  airTone.connect(airGain);
  airGain.connect(masterGain);

  const toneC = audioContext.createOscillator();
  toneC.type = 'square';
  toneC.frequency.setValueAtTime(1160, startAt + 0.38);
  toneC.frequency.exponentialRampToValueAtTime(1360, startAt + 0.56);

  const gainC = audioContext.createGain();
  gainC.gain.setValueAtTime(0.0001, startAt + 0.36);
  gainC.gain.exponentialRampToValueAtTime(0.42, startAt + 0.395);
  gainC.gain.exponentialRampToValueAtTime(0.12, startAt + 0.52);
  gainC.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.84);
  toneC.connect(gainC);
  gainC.connect(masterGain);

  toneA.start(startAt);
  toneB.start(startAt + 0.18);
  airTone.start(startAt + 0.12);
  toneC.start(startAt + 0.38);

  toneA.stop(startAt + 0.95);
  toneB.stop(startAt + 1.02);
  airTone.stop(startAt + 0.38);
  toneC.stop(startAt + 0.84);
}
