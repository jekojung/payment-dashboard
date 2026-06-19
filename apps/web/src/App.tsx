import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Permissions } from '@tpg/shared';
import { AuthProvider } from './core/auth/AuthContext';
import { LoginPage } from './core/auth/LoginPage';
import { ProtectedRoute } from './core/auth/ProtectedRoute';
import { AppLayout } from './core/layout/AppLayout';
import { OverviewPage } from './core/pages/OverviewPage';
import { DashboardPage } from './modules/returns-discount/DashboardPage';
import { DocumentsPage } from './modules/returns-discount/DocumentsPage';
import { DocumentDetailPage } from './modules/returns-discount/DocumentDetailPage';
import { StockPage } from './modules/returns-discount/StockPage';
import { DisposalPage } from './modules/returns-discount/DisposalPage';
import { ApprovalsPage } from './modules/returns-discount/ApprovalsPage';
import { UsersPage } from './admin/UsersPage';
import { MasterdataPage } from './admin/MasterdataPage';
import { DiscountStandardsPage } from './admin/DiscountStandardsPage';
import { DisposalReasonsPage } from './admin/DisposalReasonsPage';
import { AuditPage } from './admin/AuditPage';

const P = Permissions;

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<OverviewPage />} />

            {/* โมดูล 1 */}
            <Route path="returns-discount">
              <Route index element={<Guard p={P.RETURNS_DISCOUNT.VIEW}><DashboardPage /></Guard>} />
              <Route path="documents" element={<Guard p={P.RETURNS_DISCOUNT.VIEW}><DocumentsPage /></Guard>} />
              <Route path="documents/:id" element={<Guard p={P.RETURNS_DISCOUNT.VIEW}><DocumentDetailPage /></Guard>} />
              <Route path="stock" element={<Guard p={P.RETURNS_DISCOUNT.VIEW}><StockPage /></Guard>} />
              <Route path="disposal" element={<Guard p={P.RETURNS_DISCOUNT.VIEW}><DisposalPage /></Guard>} />
              <Route path="approvals" element={<Guard p={P.RETURNS_DISCOUNT.APPROVE_SPECIAL}><ApprovalsPage /></Guard>} />
            </Route>

            {/* admin */}
            <Route path="admin">
              <Route path="users" element={<Guard p={P.CORE.MANAGE_USERS}><UsersPage /></Guard>} />
              <Route path="masterdata" element={<Guard p={P.CORE.MANAGE_MASTERDATA}><MasterdataPage /></Guard>} />
              <Route path="discount-standards" element={<Guard p={P.CORE.MANAGE_DISCOUNT_STANDARDS}><DiscountStandardsPage /></Guard>} />
              <Route path="disposal-reasons" element={<Guard p={P.CORE.MANAGE_MASTERDATA}><DisposalReasonsPage /></Guard>} />
              <Route path="audit" element={<Guard p={P.CORE.VIEW_AUDIT}><AuditPage /></Guard>} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function Guard({ p, children }: { p: string; children: React.ReactNode }) {
  return <ProtectedRoute permission={p}>{children}</ProtectedRoute>;
}
