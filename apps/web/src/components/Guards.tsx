import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Role } from '@novafood/shared';
import { useAuth } from '../stores/auth';
import { PageLoader } from './States';

/** Waits for the session check, then redirects anonymous visitors to login and back again. */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'unknown') return <PageLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
