let sharedAudioContext: AudioContext | null = null;
const NOTIFICATION_MASTER_VOLUME = 0.9;

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

  // Keep the signal punchy and audible without clipping into a harsh tone.
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-24, startAt);
  compressor.knee.setValueAtTime(20, startAt);
  compressor.ratio.setValueAtTime(8, startAt);
  compressor.attack.setValueAtTime(0.003, startAt);
  compressor.release.setValueAtTime(0.2, startAt);

  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0.0001, startAt);
  masterGain.gain.exponentialRampToValueAtTime(NOTIFICATION_MASTER_VOLUME, startAt + 0.018);
  masterGain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.24);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.72);
  masterGain.connect(compressor);
  compressor.connect(audioContext.destination);

  const toneA = audioContext.createOscillator();
  toneA.type = 'triangle';
  toneA.frequency.setValueAtTime(920, startAt);
  toneA.frequency.exponentialRampToValueAtTime(1120, startAt + 0.11);

  const gainA = audioContext.createGain();
  gainA.gain.setValueAtTime(0.0001, startAt);
  gainA.gain.exponentialRampToValueAtTime(0.9, startAt + 0.012);
  gainA.gain.exponentialRampToValueAtTime(0.22, startAt + 0.12);
  gainA.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);
  toneA.connect(gainA);
  gainA.connect(masterGain);

  const toneB = audioContext.createOscillator();
  toneB.type = 'sine';
  toneB.frequency.setValueAtTime(1260, startAt + 0.12);
  toneB.frequency.exponentialRampToValueAtTime(1580, startAt + 0.29);

  const gainB = audioContext.createGain();
  gainB.gain.setValueAtTime(0.0001, startAt + 0.11);
  gainB.gain.exponentialRampToValueAtTime(0.78, startAt + 0.145);
  gainB.gain.exponentialRampToValueAtTime(0.26, startAt + 0.26);
  gainB.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.5);
  toneB.connect(gainB);
  gainB.connect(masterGain);

  const airTone = audioContext.createOscillator();
  airTone.type = 'triangle';
  airTone.frequency.setValueAtTime(1840, startAt + 0.125);
  airTone.frequency.exponentialRampToValueAtTime(1680, startAt + 0.22);

  const airGain = audioContext.createGain();
  airGain.gain.setValueAtTime(0.0001, startAt + 0.11);
  airGain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.155);
  airGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.31);
  airTone.connect(airGain);
  airGain.connect(masterGain);

  toneA.start(startAt);
  toneB.start(startAt + 0.12);
  airTone.start(startAt + 0.12);

  toneA.stop(startAt + 0.32);
  toneB.stop(startAt + 0.56);
  airTone.stop(startAt + 0.34);
}
