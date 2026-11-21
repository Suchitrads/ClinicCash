import type { Reminder } from '../types';

export const LANGUAGE_VOICE: Record<Reminder['language'], string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
};

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

export function speakText(
  text: string,
  language: Reminder['language'],
  rate = 0.9,
  onEnd?: () => void,
): void {
  if (!isSpeechSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();

  const lang = LANGUAGE_VOICE[language];
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = rate;

  const voice = synth.getVoices().find((v) => v.lang.startsWith(lang));
  if (voice) utterance.voice = voice;

  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();

  synth.speak(utterance);
}

export function stopSpeech(): void {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
  }
}
