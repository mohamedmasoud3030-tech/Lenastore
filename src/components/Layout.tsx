import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  ArrowRightLeft,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package2,
  ShoppingCart,
  Sun,
  Users,
  WifiOff,
  X,
  PieChart,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../lib/AuthContext';
import { useProject } from '../lib/ProjectContext';
import { useTheme } from '../lib/ThemeContext';
import BrandMark from './BrandMark';
import NotificationCenter from './common/NotificationCenter';

const navGroups = [
  {
    title: 'التشغيل والمخزون',
    items: [
      { name: 'لوحة التشغيل', shortName: 'اللوحة', to: '/', icon: LayoutDashboard },
      { name: 'طلبات الشراء', shortName: 'الطلبات', to: '/requests', icon: FileText },
      { name: 'دليل المواد', shortName: 'المواد', to: '/materials', icon: Package2 },
      { name: 'حركة المخزون', shortName: 'الحركات', to: '/movements', icon: ArrowRightLeft },
    ],
  },
  {
    title: 'التوريدات والمالية',
    items: [
      { name: 'المشتريات والاستلام', shortName: 'المشتريات', to: '/purchases', icon: ShoppingCart },
      { name: 'سجل الموردين', shortName: 'الموردون', to: '/suppliers', icon: Users },
      { name: 'مركز التقارير A4', shortName: 'التقارير', to: '/reports', icon: PieChart },
    ],
  },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="space-y-6">
      {navGroups.map((group) => (
        <div key={group.title} className="space-y-2">
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
            {group.title}
          </p>
          <nav className="space-y-1">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    'group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-extrabold transition',
                    isActive
                      ? 'bg-amber-400/15 text-white shadow-2xs border-r-4 border-amber-400'
                      : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={clsx(
                        'grid h-8 w-8 place-items-center rounded-lg transition',
                        isActive ? 'bg-amber-400 text-slate-950 font-black' : 'bg-white/[0.05] text-slate-400 group-hover:text-white'
                      )}
                    >
                      <item.icon size={17} strokeWidth={2} />
                    </span>
                    <span className="truncate">{item.name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </div>
  );
}

export default function Layout() {
  const { signOut } = useAuth();
  const { project } = useProject();
  const { theme, toggleTheme } = useTheme();
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

  const allNavItems = navGroups.flatMap((g) => g.items);

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#0b0f19] md:flex md:flex-row text-slate-900 dark:text-slate-100 transition-colors" dir="rtl">
      {!isOnline && (
        <div className="fixed inset-x-0 top-0 z-[70] flex min-h-9 items-center justify-center gap-2 bg-red-600 px-4 py-2 text-center text-xs font-bold text-white shadow-lg">
          <WifiOff size={15} />
          لا يوجد اتصال بالإنترنت. القراءة والعمليات المرتبطة بقاعدة البيانات متوقفة مؤقتًا.
        </div>
      )}

      {/* Right Desktop Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 xl:w-72 shrink-0 flex-col overflow-hidden bg-slate-950 text-white md:flex border-l border-slate-900 shadow-xl z-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(14,116,144,0.25),transparent_22rem)]" />
        
        {/* Brand Header */}
        <div className="relative border-b border-white/10 px-5 py-5 flex items-center justify-between">
          <BrandMark inverse />
        </div>

        {/* Current Project Card */}
        <div className="relative px-4 pt-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30">
                <Building2 size={18} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-white" title={project?.name}>
                  {project?.name || 'مشروع غير محدد'}
                </p>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{project?.location || 'الموقع غير محدد'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="relative flex-1 overflow-y-auto px-4 py-5">
          <Navigation />
        </div>

        {/* Bottom Actions */}
        <div className="relative border-t border-white/10 p-4 space-y-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.05]">
              {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-sky-300" />}
            </span>
            {theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
          </button>

          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.05]">
              <LogOut size={15} />
            </span>
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="min-w-0 flex-1 flex flex-col">
        {/* Universal Top Bar */}
        <header
          className={clsx(
            'sticky z-40 flex min-h-16 items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-4 sm:px-6 backdrop-blur-md',
            isOnline ? 'top-0' : 'top-9'
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-2xs md:hidden hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              aria-label="فتح القائمة الجانبية"
              title="فتح القائمة الجانبية"
            >
              <Menu size={20} />
            </button>
            <BrandMark compact className="md:hidden" />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-slate-900 dark:text-slate-100">{project?.name || 'لوحة التشغيل'}</h2>
              <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">{project?.location || 'نظام إدارة المواد والتوريدات'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationCenter />

            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              title="تبديل المظهر"
            >
              {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
            </button>
          </div>
        </header>

        <main className="min-h-screen pb-24 md:pb-8 flex-1">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_35px_rgba(15,23,42,0.08)] backdrop-blur-md md:hidden">
        <div className="mx-auto grid h-16 max-w-xl grid-cols-5">
          {allNavItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'relative flex flex-col items-center justify-center gap-1 text-[10px] font-extrabold transition',
                  isActive ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-amber-400" />}
                  <item.icon size={18} strokeWidth={isActive ? 2.4 : 2} />
                  <span>{item.shortName}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Mobile Right Drawer Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[80] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="إغلاق القائمة"
          />
          <aside className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs flex-col bg-slate-950 p-5 text-white shadow-2xl z-50">
            <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-5">
              <BrandMark inverse />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-slate-200"
                aria-label="إغلاق القائمة"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.05] p-3.5">
              <p className="truncate text-xs font-black">{project?.name}</p>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">{project?.location}</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              <Navigation onNavigate={() => setMobileMenuOpen(false)} />
            </div>

            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 text-xs font-extrabold text-red-300"
            >
              <LogOut size={16} />
              تسجيل الخروج
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
