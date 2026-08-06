import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { PurchaseRequest } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { PageHeader } from './common/PageHeader';
import { KpiCard } from './common/KpiCard';
import { StatusBadge } from './common/StatusBadge';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { EmptyState } from './common/EmptyState';
import { ErrorState } from './common/ErrorState';
import { formatDate } from '../lib/formatters';
import { Link } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronLeft,
} from 'lucide-react';

export default function PurchaseRequests() {
  const { project } = useProject();

  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchRequests = useCallback(async () => {
    if (!supabase || !project) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from('purchase_requests')
        .select('*, purchase_request_items(*, materials(name, unit))')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      setRequests((data as any) || []);
    } catch (err: any) {
      console.error(err);
      setError(parseSupabaseError(err, 'حدث خطأ أثناء تحميل طلبات الشراء'));
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const filteredRequests = requests.filter((req) => {
    const matchStatus = statusFilter === 'ALL' || req.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      req.request_number.toLowerCase().includes(q) ||
      (req.reason && req.reason.toLowerCase().includes(q)) ||
      (req.notes && req.notes.toLowerCase().includes(q));

    return matchStatus && matchSearch;
  });

  // KPI Calculations
  const totalCount = requests.length;
  const requestedCount = requests.filter((r) => r.status === 'REQUESTED').length;
  const purchasingCount = requests.filter((r) => r.status === 'PURCHASING').length;
  const purchasedCount = requests.filter((r) => r.status === 'PURCHASED').length;

  if (loading && requests.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="طلبات الشراء" description="إدارة وتتبع طلبات توفير المواد" />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="طلبات الشراء الموقعيه"
        description="تسجيل احتیاجات المشروع من المواد، ومتابعة اعتمادها وتحويلها إلى أوامر شراء."
        actions={
          <Link
            to="/requests/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> طلب شراء جديد
          </Link>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchRequests} />}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="إجمالي الطلبات"
          value={totalCount}
          subtitle="طلب توفير مواد"
          icon={<FileText className="w-5 h-5" />}
          variant="default"
        />
        <KpiCard
          title="طلبات قيد الاعتماد"
          value={requestedCount}
          subtitle="تنتظر تحويل الشراء"
          variant="warning"
        />
        <KpiCard
          title="جاري الشراء"
          value={purchasingCount}
          subtitle="أوامر قيد المفاوضات"
          variant="info"
        />
        <KpiCard
          title="تم الشراء والتوفير"
          value={purchasedCount}
          subtitle="طلبات مكتملة"
          variant="success"
        />
      </div>

      {/* Search & Status Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم الطلب، الغرض، أو الملاحظات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-sky-900 dark:text-sky-400 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              شبكة (2×2)
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-sky-900 dark:text-sky-400 shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              قائمة
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs overflow-x-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'ALL' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              الكل ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter('REQUESTED')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'REQUESTED' ? 'bg-sky-100 dark:bg-sky-950 text-sky-900 dark:text-sky-300 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              مطلوب ({requestedCount})
            </button>
            <button
              onClick={() => setStatusFilter('PURCHASING')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'PURCHASING' ? 'bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-300 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              جاري الشراء ({purchasingCount})
            </button>
            <button
              onClick={() => setStatusFilter('PURCHASED')}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                statusFilter === 'PURCHASED' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              تم الشراء ({purchasedCount})
            </button>
          </div>
        </div>
      </div>

      {/* List / Grid */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات شراء مطابقة"
          description={search ? 'جرب تغيير كلمة البحث أو فلتر الحالة.' : 'لم يتم تسجيل أي طلب شراء موقعي بعد.'}
          action={
            <Link
              to="/requests/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700"
            >
              <Plus className="w-4 h-4" /> إنشاء طلب جديد
            </Link>
          }
        />
      ) : viewMode === 'grid' ? (
        /* Unified 2*2 Responsive Grid Layout */
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {filteredRequests.map((req) => (
            <Link
              key={req.id}
              to={`/requests/${req.id}`}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-sky-500 transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className="font-mono font-black text-xs sm:text-sm text-sky-700 dark:text-sky-400 group-hover:underline" dir="ltr">
                    {req.request_number}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatDate(req.date)}</span>
                </div>

                <p className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-2 mb-2">
                  {req.reason || 'طلب شراء مواد للموقع'}
                </p>

                <div className="flex flex-wrap gap-1 mb-3">
                  <StatusBadge variant={req.status} />
                  <StatusBadge variant={req.priority} />
                </div>
              </div>

              <div className="bg-slate-100/90 dark:bg-slate-800/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">عدد الأصناف:</span>
                <span className="font-black text-slate-900 dark:text-slate-100">{req.purchase_request_items?.length || 0} مواد</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <Link
              key={req.id}
              to={`/requests/${req.id}`}
              className="block bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-sky-300 dark:hover:border-sky-500 transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-xl group-hover:bg-sky-600 group-hover:text-white transition-colors">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-base" dir="ltr">{req.request_number}</span>
                      <StatusBadge variant={req.status} />
                      <StatusBadge variant={req.priority} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                      <span>تاريخ الطلب: {formatDate(req.date)}</span>
                      {req.needed_date && <span className="text-slate-400">• تاريخ الاحتياج: {formatDate(req.needed_date)}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 group-hover:text-sky-700">
                  عرض التفاصيل والاعتماد <ChevronLeft className="w-4 h-4" />
                </div>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-slate-400 font-medium">السبب / الغرض:</span>{' '}
                  <span className="font-bold text-slate-800 dark:text-slate-200">{req.reason || 'غير محدد'}</span>
                </div>

                <div className="text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{req.purchase_request_items?.length || 0}</span> مواد مطلوبة
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
