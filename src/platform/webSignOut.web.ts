import { useWebAuth } from '../auth/WebAuthProvider.web';

export function useWebSignOut(): (() => Promise<void>) | null {
  return useWebAuth().signOut;
}
