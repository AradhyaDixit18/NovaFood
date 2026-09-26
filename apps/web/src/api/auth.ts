import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, UserDTO } from '@novafood/shared';
import { api, refreshSession } from '../lib/api';
import { API_URL } from '../lib/env';
import { disconnectSocket } from '../lib/socket';
import { useAuth } from '../stores/auth';
import { mergeGuestCartIntoAccount } from './cart';

type Session = { user: UserDTO; accessToken: string };

/**
 * The API sets a readable `nf_session=1` flag beside the httpOnly refresh cookie. When the web app
 * and API share an origin (dev proxy, Netlify proxy) we can read it and skip the refresh round trip
 * for visitors with no session. Cross-origin, the flag is not visible, so we always try.
 */
export function mayHaveSession(): boolean {
  if (API_URL) return true;
  return document.cookie.split(';').some((c) => c.trim().startsWith('nf_session='));
}

/** Restores a session from the refresh cookie on page load. */
export async function bootstrapSession(): Promise<void> {
  if (!mayHaveSession()) {
    useAuth.getState().clear();
    return;
  }
  const ok = await refreshSession();
  if (!ok) useAuth.getState().clear();
}

function useSessionMutation<V>(fn: (v: V) => Promise<Session>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async ({ user, accessToken }) => {
      useAuth.getState().setSession(user, accessToken);
      await mergeGuestCartIntoAccount();
      // Everything cached while signed out (recommendations, coupons...) may now differ.
      await qc.invalidateQueries();
    },
  });
}

export const useLogin = () => useSessionMutation((input: LoginInput) => api<Session>('/auth/login', { method: 'POST', body: input, noRefresh: true }));
export const useRegister = () => useSessionMutation((input: RegisterInput) => api<Session>('/auth/register', { method: 'POST', body: input, noRefresh: true }));

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST', noRefresh: true }),
    onSettled: () => {
      disconnectSocket();
      useAuth.getState().clear();
      qc.clear();
    },
  });
}

export const useForgotPassword = () =>
  useMutation({ mutationFn: (email: string) => api<{ ok: true; message: string }>('/auth/forgot-password', { method: 'POST', body: { email }, noRefresh: true }) });

export const useResetPassword = () =>
  useMutation({ mutationFn: (input: { token: string; password: string }) => api('/auth/reset-password', { method: 'POST', body: input, noRefresh: true }) });

export const useVerifyEmail = () =>
  useMutation({
    mutationFn: (token: string) => api<{ user: UserDTO }>('/auth/verify-email', { method: 'POST', body: { token }, noRefresh: true }),
    onSuccess: ({ user }) => {
      if (useAuth.getState().user) useAuth.getState().setUser(user);
    },
  });

export const useResendVerification = () => useMutation({ mutationFn: () => api('/auth/resend-verification', { method: 'POST' }) });

export const useChangePassword = () =>
  useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => api('/auth/change-password', { method: 'POST', body: input }),
    onSuccess: () => useAuth.getState().clear(),
  });
