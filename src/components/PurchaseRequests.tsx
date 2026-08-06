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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم الطلب، الغرض، أو الملاحظات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('REQUESTED')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'REQUESTED' ? 'bg-sky-100 text-sky-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            مطلوب ({requestedCount})
          </button>
          <button
            onClick={() => setStatusFilter('PURCHASING')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'PURCHASING' ? 'bg-purple-100 text-purple-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            جاري الشراء ({purchasingCount})
          </button>
          <button
            onClick={() => setStatusFilter('PURCHASED')}
            className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'PURCHASED' ? 'bg-emerald-100 text-emerald-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            تم الشراء ({purchasedCount})
          </button>
        </div>
      </div>

      {/* List / Table */}
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
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => (
            <Link
              key={req.id}
              to={`/requests/${req.id}`}
              className="block bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-sky-300 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl group-hover:bg-sky-600 group-hover:text-white transition-colors">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-base" dir="ltr">{req.request_number}</span>
                      <StatusBadge variant={req.status} />
                      <StatusBadge variant={req.priority} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>تاريخ الطلب: {formatDate(req.date)}</span>
                      {req.needed_date && <span className="text-slate-400">• تاريخ الاحتياج: {formatDate(req.needed_date)}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 group-hover:text-sky-700">
                  عرض التفاصيل والاعتماد <ChevronLeft className="w-4 h-4" />
                </div>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 font-medium">السبب / الغرض:</span>{' '}
                  <span className="font-bold text-slate-800">{req.reason || 'غير محدد'}</span>
                </div>

                <div className="text-slate-500">
                  <span className="font-semibold text-slate-700">{req.purchase_request_items?.length || 0}</span> مواد مطلوبة
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
