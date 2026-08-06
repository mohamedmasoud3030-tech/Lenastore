import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUpRight,
  ClipboardPlus,
  Package2,
  ShoppingCart,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import AnalyticsCharts from './AnalyticsCharts';
import { PageHeader } from './common/PageHeader';
import { LoadingSkeleton } from './common/LoadingSkeleton';

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

  const statCards = [
    {
      label: 'إجمالي أوامر الشراء',
      value: currencyFormatter.format(stats.totalPurchases),
      icon: ShoppingCart,
      iconClass: 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 ring-sky-100 dark:ring-sky-900',
      accentClass: 'from-sky-800 to-cyan-600',
    },
    {
      label: 'المدفوع للموردين',
      value: currencyFormatter.format(stats.totalPaid),
      icon: WalletCards,
      iconClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 ring-emerald-100 dark:ring-emerald-900',
      accentClass: 'from-emerald-700 to-teal-500',
    },
    {
      label: 'الرصيد المستحق للموردين',
      value: currencyFormatter.format(remaining),
      icon: ArrowDownLeft,
      iconClass: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 ring-amber-100 dark:ring-amber-900',
      accentClass: 'from-amber-500 to-orange-500',
    },
    {
      label: 'مواد عند حد إعادة الطلب',
      value: String(stats.lowStock),
      icon: AlertTriangle,
      iconClass: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300 ring-red-100 dark:ring-red-900',
      accentClass: 'from-red-600 to-rose-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header matching rest of app */}
      <PageHeader
        title={`لوحة تشغيل مشروع ${project?.name || ''}`}
        description="نظرة شاملة وموحدة على الموقف المالي وتوريدات المواد وأحدث حركة المخزون الإنشائي."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/requests/new"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-300 shadow-2xs"
            >
              <ClipboardPlus size={16} />
              طلب شراء جديد
            </Link>
            <Link
              to="/movements"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700 shadow-2xs"
            >
              <ArrowRightLeft size={16} />
              تسجيل حركة
            </Link>
          </div>
        }
      />

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <>
          {/* Standardized 4 KPI Stats Cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {statCards.map(({ label, value, icon: Icon, iconClass, accentClass }) => (
              <article key={label} className="relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-2xs">
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${accentClass}`} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-snug">{label}</p>
                    <p className="mt-2 truncate text-lg sm:text-xl font-black tracking-tight text-slate-950 dark:text-slate-100" title={value}>
                      {value}
                    </p>
                  </div>
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ${iconClass}`}>
                    <Icon size={18} />
                  </span>
                </div>
              </article>
            ))}
          </section>

          {/* Consumption & Financial Analytics Chart Preview */}
          <AnalyticsCharts compact={true} />

          {/* Lower Dashboard Grid (Recent Movements & Financial Progress) */}
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.75fr)]">
            <article className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
              <header className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
                <div>
                  <h2 className="text-sm font-black text-slate-950 dark:text-slate-100">آخر حركات المخزون</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">أحدث عمليات الاستلام والصرف المسجلة</p>
                </div>
                <Link to="/movements" className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 dark:text-sky-400 hover:underline">
                  عرض الكل
                  <ArrowLeft size={14} />
                </Link>
              </header>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentMovements.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400">
                      <Package2 size={22} />
                    </span>
                    <p className="mt-3 text-xs font-bold text-slate-700 dark:text-slate-300">لا توجد حركات مخزون بعد</p>
                    <p className="mt-1 text-[11px] text-slate-400">ستظهر عمليات الاستلام والصرف هنا تلقائيًا.</p>
                  </div>
                ) : (
                  recentMovements.map((movement) => {
                    const material = Array.isArray(movement.materials) ? movement.materials[0] : movement.materials;
                    const isIncoming = movement.type === 'IN';

                    return (
                      <div key={movement.id} className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                            isIncoming ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                          }`}
                        >
                          {isIncoming ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <p className="truncate text-xs font-black text-slate-900 dark:text-slate-100">{material?.name || 'مادة غير معروفة'}</p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                isIncoming ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                              }`}
                            >
                              {isIncoming ? 'استلام' : 'صرف'}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {movement.reference_number || movement.location_used || 'بدون مرجع'} • {movement.date}
                          </p>
                        </div>
                        <p className="shrink-0 text-xs font-black text-slate-950 dark:text-slate-100">
                          {movement.quantity} <span className="text-[10px] text-slate-400">{material?.unit}</span>
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </article>

            <div className="space-y-5">
              <article className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black text-slate-950 dark:text-slate-100">الموقف المالي</h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">نسبة السداد من إجمالي المشتريات</p>
                  </div>
                  <span className="text-base font-black text-sky-900 dark:text-sky-400">{paymentProgress.toFixed(0)}%</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-sky-800 to-cyan-500 transition-all"
                    style={{ width: `${paymentProgress}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3">
                    <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">تم سداده</p>
                    <p className="mt-1 truncate font-black text-emerald-950 dark:text-emerald-200">{currencyFormatter.format(stats.totalPaid)}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3">
                    <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">متبقٍ</p>
                    <p className="mt-1 truncate font-black text-amber-950 dark:text-amber-200">{currencyFormatter.format(remaining)}</p>
                  </div>
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-black text-slate-950 dark:text-slate-100">طلبات قيد المتابعة</h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">طلبات لم تصل إلى الشراء أو الإلغاء</p>
                  </div>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 dark:bg-sky-950/50 text-base font-black text-sky-900 dark:text-sky-300">
                    {stats.openRequests}
                  </span>
                </div>
                <Link
                  to="/requests"
                  className="mt-4 flex min-h-10 items-center justify-between rounded-xl bg-slate-950 dark:bg-slate-800 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-900"
                >
                  متابعة طلبات الشراء
                  <ArrowLeft size={15} />
                </Link>
              </article>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
