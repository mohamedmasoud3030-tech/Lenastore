import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  CalendarDays,
  ClipboardPlus,
  Package2,
  ShoppingCart,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';

interface DashboardStats {
  totalPurchases: number;
  totalPaid: number;
  lowStock: number;
  openRequests: number;
}

const initialStats: DashboardStats = {
  totalPurchases: 0,
  totalPaid: 0,
  lowStock: 0,
  openRequests: 0,
};

export default function Dashboard() {
  const { project } = useProject();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);

  useEffect(() => {
    if (!project) return;

    const fetchDashboard = async () => {
      setLoading(true);

      try {
        const [purchasesRes, paymentsRes, materialsRes, requestsRes, movementsRes] = await Promise.all([
          supabase.from('purchases').select('total').eq('project_id', project.id),
          supabase.from('payments').select('amount').eq('project_id', project.id),
          supabase.from('material_stock').select('current_stock,min_stock').eq('project_id', project.id),
          supabase
            .from('purchase_requests')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', project.id)
            .not('status', 'in', '(PURCHASED,CANCELLED)'),
          supabase
            .from('stock_movements')
            .select('id,type,quantity,date,reference_number,location_used,created_at,materials(name,unit)')
            .eq('project_id', project.id)
            .order('created_at', { ascending: false })
            .limit(6),
        ]);

        const responses = [purchasesRes, paymentsRes, materialsRes, requestsRes, movementsRes];
        const firstError = responses.find((response) => response.error)?.error;
        if (firstError) throw firstError;

        const totalPurchases = purchasesRes.data?.reduce((sum, row) => sum + (Number(row.total) || 0), 0) ?? 0;
        const totalPaid = paymentsRes.data?.reduce((sum, row) => sum + (Number(row.amount) || 0), 0) ?? 0;
        const lowStock =
          materialsRes.data?.filter((material) => Number(material.current_stock || 0) <= Number(material.min_stock || 0)).length ?? 0;

        setStats({
          totalPurchases,
          totalPaid,
          lowStock,
          openRequests: requestsRes.count ?? 0,
        });
        setRecentMovements(movementsRes.data ?? []);
      } catch (error) {
        console.error('Dashboard data error:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboard();
  }, [project]);

  const remaining = Math.max(stats.totalPurchases - stats.totalPaid, 0);
  const paymentProgress = stats.totalPurchases > 0 ? Math.min((stats.totalPaid / stats.totalPurchases) * 100, 100) : 0;

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('ar-OM', {
        style: 'currency',
        currency: project?.currency || 'OMR',
        maximumFractionDigits: project?.currency === 'OMR' ? 3 : 2,
      }),
    [project?.currency]
  );

  const currentDate = new Intl.DateTimeFormat('ar-OM', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const statCards = [
    {
      label: 'إجمالي أوامر الشراء',
      value: currencyFormatter.format(stats.totalPurchases),
      icon: ShoppingCart,
      iconClass: 'bg-sky-50 text-sky-800 ring-sky-100',
      accentClass: 'from-sky-800 to-cyan-600',
    },
    {
      label: 'المدفوع للموردين',
      value: currencyFormatter.format(stats.totalPaid),
      icon: WalletCards,
      iconClass: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      accentClass: 'from-emerald-700 to-teal-500',
    },
    {
      label: 'الرصيد المستحق',
      value: currencyFormatter.format(remaining),
      icon: ArrowDownLeft,
      iconClass: 'bg-amber-50 text-amber-700 ring-amber-100',
      accentClass: 'from-amber-500 to-orange-500',
    },
    {
      label: 'مواد عند حد إعادة الطلب',
      value: String(stats.lowStock),
      icon: AlertTriangle,
      iconClass: 'bg-red-50 text-red-700 ring-red-100',
      accentClass: 'from-red-600 to-rose-500',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-3xl bg-slate-200/70" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-36 animate-pulse rounded-3xl bg-slate-200/70" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-3xl bg-slate-200/70" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[1.75rem] bg-slate-950 px-5 py-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:px-7 sm:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(14,116,144,0.28),transparent_22rem),radial-gradient(circle_at_90%_100%,rgba(245,158,11,0.16),transparent_22rem)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <CalendarDays size={15} className="text-amber-300" />
              {currentDate}
            </div>
            <h1 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">لوحة مشروع {project?.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
              متابعة المشتريات، الالتزامات المالية، تنبيهات المخزون وأحدث الحركات من شاشة تشغيل واحدة.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              to="/requests/new"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 transition hover:bg-amber-300"
            >
              <ClipboardPlus size={18} />
              طلب شراء جديد
            </Link>
            <Link
              to="/movements"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-white/[0.12]"
            >
              <ArrowRightLeft size={18} />
              تسجيل حركة
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, iconClass, accentClass }) => (
          <article key={label} className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${accentClass}`} />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold leading-5 text-slate-500">{label}</p>
                <p className="mt-3 truncate text-xl font-black tracking-tight text-slate-950" title={value}>
                  {value}
                </p>
              </div>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ${iconClass}`}>
                <Icon size={20} />
              </span>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.75fr)]">
        <article className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-base font-black text-slate-950">آخر حركات المخزون</h2>
              <p className="mt-1 text-xs font-semibold text-slate-500">أحدث عمليات الاستلام والصرف المسجلة</p>
            </div>
            <Link to="/movements" className="inline-flex items-center gap-1 text-xs font-extrabold text-sky-800 hover:text-sky-950">
              عرض الكل
              <ArrowLeft size={15} />
            </Link>
          </header>

          <div className="divide-y divide-slate-100">
            {recentMovements.length === 0 ? (
              <div className="px-5 py-14 text-center sm:px-6">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                  <Package2 size={24} />
                </span>
                <p className="mt-4 text-sm font-extrabold text-slate-700">لا توجد حركات مخزون بعد</p>
                <p className="mt-1 text-xs text-slate-400">ستظهر عمليات الاستلام والصرف هنا تلقائيًا.</p>
              </div>
            ) : (
              recentMovements.map((movement) => {
                const material = Array.isArray(movement.materials) ? movement.materials[0] : movement.materials;
                const isIncoming = movement.type === 'IN';

                return (
                  <div key={movement.id} className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50/80 sm:px-6">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                        isIncoming ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {isIncoming ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="truncate text-sm font-extrabold text-slate-900">{material?.name || 'مادة غير معروفة'}</p>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-black ${
                            isIncoming ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {isIncoming ? 'استلام' : 'صرف'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                        {movement.reference_number || movement.location_used || 'بدون مرجع'} • {movement.date}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-slate-950">
                      {movement.quantity} <span className="text-xs font-bold text-slate-400">{material?.unit}</span>
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-950">الموقف المالي</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">نسبة السداد من إجمالي المشتريات</p>
              </div>
              <span className="text-lg font-black text-sky-900">{paymentProgress.toFixed(0)}%</span>
            </div>
            <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-l from-sky-800 to-cyan-500 transition-all"
                style={{ width: `${paymentProgress}%` }}
              />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-emerald-50 p-3">
                <p className="text-[10px] font-black text-emerald-700">تم سداده</p>
                <p className="mt-1 truncate text-sm font-black text-emerald-950">{currencyFormatter.format(stats.totalPaid)}</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-3">
                <p className="text-[10px] font-black text-amber-700">متبقٍ</p>
                <p className="mt-1 truncate text-sm font-black text-amber-950">{currencyFormatter.format(remaining)}</p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-950">طلبات قيد المتابعة</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">طلبات لم تصل إلى الشراء أو الإلغاء</p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-50 text-xl font-black text-sky-900 ring-1 ring-sky-100">
                {stats.openRequests}
              </span>
            </div>
            <Link
              to="/requests"
              className="mt-5 flex min-h-11 items-center justify-between rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-sky-900"
            >
              متابعة طلبات الشراء
              <ArrowLeft size={16} />
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
