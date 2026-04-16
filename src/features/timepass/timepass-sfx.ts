import type { TimepassReactionKind } from '@/types/models';

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined' || !window.AudioContext) {
    return null;
  }

  if (!audioContext) {
    audioContext = new window.AudioContext();
  }

  return audioContext;
}

export async function primeTimepassAudio() {
  const context = getAudioContext();
  if (!context || context.state !== 'suspended') return;

  try {
    await context.resume();
  } catch {
    // Ignore autoplay-policy failures until the next user gesture.
  }
}

function playTone(
  frequency: number,
  startAt: number,
  duration: number,
  volume: number,
  type: OscillatorType,
) {
  const context = getAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

export async function playReactionFx(kind: TimepassReactionKind) {
  const context = audioContext;
  if (!context || context.state === 'suspended') return;

  const startAt = context.currentTime;

  switch (kind) {
    case 'woohoo':
      playTone(720, startAt, 0.22, 0.18, 'triangle');
      playTone(980, startAt + 0.14, 0.3, 0.16, 'triangle');
      break;
    case 'yes':
      playTone(420, startAt, 0.15, 0.18, 'square');
      playTone(560, startAt + 0.16, 0.18, 0.14, 'square');
      break;
    case 'clap':
      playTone(240, startAt, 0.07, 0.14, 'square');
      playTone(260, startAt + 0.08, 0.07, 0.13, 'square');
      playTone(280, startAt + 0.16, 0.07, 0.12, 'square');
      break;
    case 'fire':
      playTone(160, startAt, 0.3, 0.18, 'sawtooth');
      playTone(220, startAt + 0.12, 0.24, 0.12, 'triangle');
      break;
    case 'lol':
      playTone(640, startAt, 0.12, 0.16, 'triangle');
      playTone(520, startAt + 0.1, 0.12, 0.15, 'triangle');
      playTone(740, startAt + 0.22, 0.12, 0.14, 'triangle');
      break;
  }
}
