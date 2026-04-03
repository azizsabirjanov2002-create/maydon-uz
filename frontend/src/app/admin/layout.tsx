'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, MapPin, CalendarDays, Settings, LogOut, ShieldCheck, ClipboardCheck } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    router.push('/login');
  };

  const navItems = [
    { name: 'Очередь заявок', href: '/admin', icon: ClipboardCheck },
    { name: 'Каталог площадок', href: '/admin/venues', icon: MapPin },
    { name: 'Все бронирования', href: '/admin/bookings', icon: CalendarDays },
    { name: 'Статистика', href: '/admin/dashboard', icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar Desktop */}
      <aside className="w-full md:w-64 bg-slate-900 md:min-h-screen flex-shrink-0 flex flex-col pt-6 z-20">
        <div className="px-6 mb-8 flex items-center gap-3 text-white">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-bold text-xl shadow-lg border border-white/10">A</div>
          <div>
             <span className="font-bold text-xl tracking-tight block text-indigo-50">Admin Panel</span>
             <span className="text-xs text-indigo-300 font-medium tracking-wider uppercase">Platform Control</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            // Strict match for /admin to avoid highlighting it for /admin/venues
            const isActive = item.href === '/admin' ? pathname === '/admin' || pathname.startsWith('/admin/moderation') : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-900/50'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto">
          <button onClick={handleLogout} className="flex flex-row items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:bg-white/5 hover:text-white transition-all text-left">
             <LogOut className="w-5 h-5" />
             Выйти
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
