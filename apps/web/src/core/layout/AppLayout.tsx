import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Permissions } from '@tpg/shared';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { cx } from '../ui';

const P = Permissions;

interface NavItem {
  label: string;
  path: string;
  requiredPermission: string;
}
interface NavGroup {
  key: string;
  name: string;
  items: NavItem[];
}
interface NavigationResponse {
  webNav: NavGroup[];
}

function NavItemLink({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          'block rounded-lg px-3 py-2 text-sm font-medium transition',
          isActive ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
        )
      }
    >
      {label}
    </NavLink>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, can } = useAuth();
  const { data } = useApi<NavigationResponse>('/modules/me/navigation');

  const adminItems = [
    { path: '/admin/users', label: 'ผู้ใช้ & สิทธิ์', perm: P.CORE.MANAGE_USERS },
    { path: '/admin/masterdata', label: 'ข้อมูลหลัก', perm: P.CORE.MANAGE_MASTERDATA },
    { path: '/admin/discount-standards', label: 'ตารางส่วนลดมาตรฐาน', perm: P.CORE.MANAGE_DISCOUNT_STANDARDS },
    { path: '/admin/disposal-reasons', label: 'เหตุผลตัดจำหน่าย', perm: P.CORE.MANAGE_MASTERDATA },
    { path: '/admin/audit', label: 'Audit Log', perm: P.CORE.VIEW_AUDIT },
  ].filter((i) => can(i.perm));

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <div className="text-lg font-bold text-brand-700">TPG Center</div>
        <div className="text-xs text-slate-400">คลังสินค้า &amp; ขนส่ง</div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <NavItemLink to="/" label="ภาพรวม" onClick={onNavigate} />

        {data?.webNav?.map((group) => (
          <div key={group.key}>
            <SectionLabel>{group.name}</SectionLabel>
            {group.items.map((item) => (
              <NavItemLink key={item.path} to={item.path} label={item.label} onClick={onNavigate} />
            ))}
            {group.key === 'returns_discount' && can(P.RETURNS_DISCOUNT.VIEW) && (
              <NavItemLink to="/returns-discount/documents" label="ใบ GD ทั้งหมด" onClick={onNavigate} />
            )}
            {group.key === 'returns_discount' && can(P.RETURNS_DISCOUNT.APPROVE_SPECIAL) && (
              <NavItemLink to="/returns-discount/approvals" label="รออนุมัติพิเศษ" onClick={onNavigate} />
            )}
          </div>
        ))}

        {adminItems.length > 0 && (
          <div>
            <SectionLabel>ผู้ดูแลระบบ</SectionLabel>
            {adminItems.map((i) => (
              <NavItemLink key={i.path} to={i.path} label={i.label} onClick={onNavigate} />
            ))}
          </div>
        )}
      </nav>

      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        {user?.name}
        <div className="text-slate-400">{user?.roles?.join(', ')}</div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Sidebar (mobile drawer) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="เมนู"
          >
            ☰
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:block">{user?.name}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              ออกจากระบบ
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
