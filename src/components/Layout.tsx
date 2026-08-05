import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ArrowRightLeft,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package2,
  ShoppingCart,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../lib/AuthContext';
import { useProject } from '../lib/ProjectContext';
import BrandMark from './BrandMark';

const navItems = [
  { name: 'لوحة المشروع', shortName: 'اللوحة', to: '/', icon: LayoutDashboard },
  { name: 'طلبات الشراء', shortName: 'الطلبات', to: '/requests', icon: FileText },
  { name: 'دليل المواد', shortName: 'المواد', to: '/materials', icon: Package2 },
  { name: 'حركة المخزون', shortName: 'الحركات', to: '/movements', icon: ArrowRightLeft },
  { name: 'المشتريات والاستلام', shortName: 'المشتريات', to: '/purchases', icon: ShoppingCart },
  { name: 'الموردون', shortName: 'الموردون', to: '/suppliers', icon: Users },
  { name: 'التقارير', shortName: 'التقارير', to: '/reports', icon: FileText },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1.5">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition',
              isActive
                ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
                : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={clsx(
                  'grid h-8 w-8 place-items-center rounded-lg transition',
                  isActive ? 'bg-amber-400 text-slate-950' : 'bg-white/[0.05] text-slate-400 group-hover:text-white'
                )}
              >
                <item.icon size={17} strokeWidth={2} />
              </span>
              <span className="truncate">{item.name}</span>
              {isActive && <span className="mr-auto h-1.5 w-1.5 rounded-full bg-amber-300" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout() {
  const { signOut } = useAuth();
  const { project } = useProject();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f4f7fb] md:flex" dir="rtl">
      {!isOnline && (
        <div className="fixed inset-x-0 top-0 z-[70] flex min-h-9 items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-xs font-bold text-white shadow-lg">
          <WifiOff size={15} />
          لا يوجد اتصال بالإنترنت. القراءة والعمليات المرتبطة بقاعدة البيانات متوقفة مؤقتًا.
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col overflow-hidden bg-slate-950 text-white md:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(14,116,144,0.2),transparent_20rem)]" />
        <div className="relative border-b border-white/10 px-5 py-5">
          <BrandMark inverse />
        </div>

        <div className="relative px-4 pt-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-700/25 text-sky-300 ring-1 ring-sky-300/15">
                <Building2 size={20} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-white" title={project?.name}>
                  {project?.name || 'مشروع غير محدد'}
                </p>
                <p className="mt-1 truncate text-[11px] font-semibold text-slate-400">{project?.location || 'الموقع غير محدد'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-3 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">التشغيل</p>
          <Navigation />
        </div>

        <div className="relative border-t border-white/10 p-4">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.05]">
              <LogOut size={17} />
            </span>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header
          className={clsx(
            'sticky z-40 flex min-h-17 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md md:hidden',
            isOnline ? 'top-0' : 'top-9'
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark compact />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-slate-950">{project?.name}</p>
              <p className="truncate text-[11px] font-semibold text-slate-500">{project?.location}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
            aria-label="فتح القائمة"
          >
            <Menu size={21} />
          </button>
        </header>

        <main className="min-h-screen pb-24 md:pb-0">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8 xl:p-10">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_35px_rgba(15,23,42,0.08)] backdrop-blur-md md:hidden">
        <div className="mx-auto grid h-17 max-w-xl grid-cols-5">
          {navItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'relative flex flex-col items-center justify-center gap-1 text-[10px] font-extrabold transition',
                  isActive ? 'text-sky-900' : 'text-slate-400'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-amber-400" />}
                  <item.icon size={19} strokeWidth={isActive ? 2.4 : 2} />
                  <span>{item.shortName}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[80] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="إغلاق القائمة"
          />
          <aside className="absolute inset-y-0 right-0 flex w-[86%] max-w-sm flex-col bg-slate-950 p-5 text-white shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-5">
              <BrandMark inverse />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-slate-200"
                aria-label="إغلاق القائمة"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
              <p className="truncate text-sm font-extrabold">{project?.name}</p>
              <p className="mt-1 truncate text-xs font-semibold text-slate-400">{project?.location}</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              <Navigation onNavigate={() => setMobileMenuOpen(false)} />
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 text-sm font-extrabold text-red-300"
            >
              <LogOut size={18} />
              تسجيل الخروج
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
