import type { ExtensionMessage } from "../shared/types";

chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
  if (message.type !== "PLAY_ALERT") return;
  void playAlertTone();
});

async function playAlertTone(): Promise<void> {
  const context = new AudioContext();
  const start = context.currentTime;
  const frequencies = [880, 1174, 880];
  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const toneStart = start + index * 0.22;
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(0.2, toneStart + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneStart + 0.17);
  });
  window.setTimeout(() => void context.close(), 1000);
}
