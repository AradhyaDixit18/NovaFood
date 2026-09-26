import type { UserDTO } from '@novafood/shared';
import { create } from 'zustand';

type Status = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  user: UserDTO | null;
  /** Kept in memory only; the refresh token lives in an httpOnly cookie the page cannot read. */
  accessToken: string | null;
  status: Status;
  setSession: (user: UserDTO, accessToken: string) => void;
  setUser: (user: UserDTO) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  status: 'unknown',
  setSession: (user, accessToken) => set({ user, accessToken, status: 'authenticated' }),
  setUser: (user) => set({ user }),
  clear: () => set({ user: null, accessToken: null, status: 'anonymous' }),
}));

export const useUser = () => useAuth((s) => s.user);
export const useIsAuthed = () => useAuth((s) => s.status === 'authenticated');
