import { useEffect,useState } from 'react';
import { isApiReachable,subscribeToApiReachability } from '../services/ConnectivityService';

/** Service reachability, based on requests rather than a guessed device state. */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(isApiReachable);
  useEffect(() => subscribeToApiReachability(setIsConnected), []);
  return { isConnected, isOnline: isConnected };
}
