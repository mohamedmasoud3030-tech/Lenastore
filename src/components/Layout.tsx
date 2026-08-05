import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useProject } from '../lib/ProjectContext';
import { 
  LayoutDashboard, 
  Package2, 
  ArrowRightLeft, 
  ShoppingCart, 
  Wallet, 
  Users, 
  FileText,
  LogOut,
  WifiOff
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { name: 'اللوحة', to: '/', icon: LayoutDashboard },
  { name: 'طلبات الشراء', to: '/requests', icon: FileText },
  { name: 'المواد', to: '/materials', icon: Package2 },
  { name: 'الحركات', to: '/movements', icon: ArrowRightLeft },
  { name: 'المشتريات', to: '/purchases', icon: ShoppingCart },
  { name: 'الموردون', to: '/suppliers', icon: Users },
  { name: 'التقارير', to: '/reports', icon: FileText },
];

export default function Layout() {
  const { signOut } = useAuth();
  const { project } = useProject();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-1 z-50 flex items-center justify-center gap-2 text-sm font-medium">
          <WifiOff size={16} />
          <span>أنت غير متصل بالإنترنت. بعض الميزات قد لا تعمل.</span>
        </div>
      )}
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-e border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 truncate" title={project?.name}>
            {project?.name || 'إدارة المشروع'}
          </h1>
          <p className="text-sm text-gray-500 truncate">{project?.location}</p>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 w-full text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <LogOut size={20} />
            تسجيل خروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen max-w-full pb-16 md:pb-0 overflow-x-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10 sticky top-0">
          <div>
            <h1 className="text-lg font-bold text-gray-900 truncate max-w-[200px]">
              {project?.name}
            </h1>
          </div>
          <button onClick={signOut} className="text-gray-500 hover:text-red-600">
            <LogOut size={24} />
          </button>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom Nav - Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.slice(0, 5).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center w-full h-full space-y-1',
                  isActive ? 'text-blue-600' : 'text-gray-500'
                )
              }
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
