let sharedAudioContext: AudioContext | null = null;
const NOTIFICATION_VOLUME_MULTIPLIER = 2.25 * 6.25;

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
  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0.0001, startAt);
  masterGain.gain.exponentialRampToValueAtTime(
    0.12 * NOTIFICATION_VOLUME_MULTIPLIER,
    startAt + 0.02,
  );
  masterGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1);
  masterGain.connect(audioContext.destination);

  const lowTone = audioContext.createOscillator();
  lowTone.type = 'triangle';
  lowTone.frequency.setValueAtTime(880, startAt);
  lowTone.frequency.exponentialRampToValueAtTime(1320, startAt + 0.24);

  const lowGain = audioContext.createGain();
  lowGain.gain.setValueAtTime(0.0001, startAt);
  lowGain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
  lowGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.42);
  lowTone.connect(lowGain);
  lowGain.connect(masterGain);

  const highTone = audioContext.createOscillator();
  highTone.type = 'sine';
  highTone.frequency.setValueAtTime(1320, startAt + 0.08);
  highTone.frequency.exponentialRampToValueAtTime(1760, startAt + 0.34);

  const highGain = audioContext.createGain();
  highGain.gain.setValueAtTime(0.0001, startAt + 0.06);
  highGain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.14);
  highGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.58);
  highTone.connect(highGain);
  highGain.connect(masterGain);

  lowTone.start(startAt);
  highTone.start(startAt + 0.08);
  lowTone.stop(startAt + 0.5);
  highTone.stop(startAt + 0.65);
}
