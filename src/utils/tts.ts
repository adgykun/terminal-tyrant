/**
 * Browser-based text-to-speech narration using the Web Speech API.
 * Assigns different voice characteristics based on NPC personality.
 */

const PERSONALITY_VOICES: Record<string, { pitch: number; rate: number }> = {
  generous: { pitch: 1.1, rate: 1.0 },
  honorable: { pitch: 0.9, rate: 0.95 },
  stingy: { pitch: 0.8, rate: 0.85 },
  treacherous: { pitch: 0.7, rate: 1.1 },
  angry: { pitch: 0.6, rate: 1.15 },
  happy: { pitch: 1.3, rate: 1.05 },
  neutral: { pitch: 1.0, rate: 1.0 },
  cautious: { pitch: 1.0, rate: 0.9 },
  timid: { pitch: 1.4, rate: 0.85 },
  aggressive: { pitch: 0.5, rate: 1.2 },
};

let enabled = false;

export function isTTSEnabled(): boolean {
  return enabled;
}

export function setTSEnabled(value: boolean): void {
  enabled = value;
  if (!enabled) {
    stopSpeaking();
  }
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Speak text aloud. If a personality is provided, the voice pitch and rate
 * are adjusted to match the character type.
 */
export function speak(text: string, personality?: string): void {
  if (!enabled) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  const clean = text.replace(/[「」""''\[\]【】]/g, "").trim();
  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = "zh-CN";

  const voiceParams = personality
    ? PERSONALITY_VOICES[personality] ?? PERSONALITY_VOICES.neutral
    : PERSONALITY_VOICES.neutral;
  utterance.pitch = voiceParams.pitch;
  utterance.rate = voiceParams.rate;

  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find(v => v.lang.startsWith("zh"));
  if (zhVoice) {
    utterance.voice = zhVoice;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
