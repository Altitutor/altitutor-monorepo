import { useNetworkState } from 'expo-network';

export function useStudyConnectivity() {
  const state = useNetworkState();
  return state.isConnected !== false && state.isInternetReachable !== false;
}
