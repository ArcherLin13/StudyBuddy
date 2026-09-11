import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

let player: AudioPlayer | null = null;

export async function playAlarm(soundOn: boolean): Promise<void> {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (!soundOn) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'duckOthers',
    shouldPlayInBackground: false,
  });
  if (!player) {
    player = createAudioPlayer(require('../../assets/alarm.wav'));
  }
  try {
    await player.seekTo(0);
    player.play();
  } catch {
    /* ignore */
  }
}

export function stopAlarm(): void {
  try {
    player?.pause();
  } catch {
    /* ignore */
  }
}
