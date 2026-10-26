import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { useSettings } from '@/store/settings';

export interface NetworkInfo {
  /** True when the device has a usable connection AND the user has not forced offline mode. */
  online: boolean;
  /** The raw device connectivity, ignoring the in-app offline switch. */
  deviceOnline: boolean;
  type: string;
}

export function useNetwork(): NetworkInfo {
  const forced = useSettings((s) => s.offlineMode);
  const [state, setState] = useState({ deviceOnline: true, type: 'unknown' });
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) => {
      setState({ deviceOnline: !!s.isConnected && s.isInternetReachable !== false, type: s.type });
    });
    return () => unsub();
  }, []);
  return { online: state.deviceOnline && !forced, deviceOnline: state.deviceOnline, type: state.type };
}
