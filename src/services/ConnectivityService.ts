/** Reachability observed from real API requests; no optional native dependency. */
let reachable = true;
const subscribers = new Set<(online: boolean) => void>();
export const isApiReachable = () => reachable;
export function reportApiReachability(online: boolean) {
  if (online === reachable) return;
  reachable = online;
  subscribers.forEach(listener => listener(online));
}
export function subscribeToApiReachability(listener: (online: boolean) => void) {
  subscribers.add(listener);
  return () => { subscribers.delete(listener); };
}
