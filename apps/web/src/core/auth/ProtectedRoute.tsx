import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Spinner } from '../ui';
import { useAuth } from './AuthContext';

export function ProtectedRoute({
  children,
  permission,
}: {
  children: ReactNode;
  permission?: string;
}) {
  const { user, loading, can } = useAuth();

  if (loading) return <Spinner label="กำลังตรวจสอบสิทธิ์…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !can(permission)) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        คุณไม่มีสิทธิ์เข้าถึงหน้านี้
      </div>
    );
  }
  return <>{children}</>;
}
