import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSessionStore } from '../store';

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const status = useSessionStore((state) => state.status);

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
