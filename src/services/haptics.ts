import * as Haptics from 'expo-haptics';
import { useSettings } from '@/store/settings';

type Kind = 'light' | 'medium' | 'heavy' | 'select' | 'success' | 'warning' | 'error';

export function haptic(kind: Kind = 'light'): void {
  if (!useSettings.getState().haptics) return;
  try {
    switch (kind) {
      case 'light':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'select':
        void Haptics.selectionAsync();
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    /* haptics unavailable (web / simulator) */
  }
}
