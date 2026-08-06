import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Purchase } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import {
  PageContainer,
  FilterToolbar,
  ActionButton,
  CardContainer,
  KpiCard,
  StatusBadge,
  EmptyState,
} from './common';
import { formatCurrency, formatDate } from '../lib/formatters';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  ChevronLeft,
  Building2,
} from 'lucide-react';

export default function Purchases() {
  const { project } = useProject();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [receiptFilter, setReceiptFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchPurchases = useCallback(async () => {
    if (!supabase || !project) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from('purchases')
        .select('*, suppliers(name, company), payments(amount), purchase_balances(*)')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;

      setPurchases((data as any) || []);
    } catch (err: any) {
      console.error(err);
      setError(parseSupabaseError(err, 'حدث خطأ أثناء تحميل أوامر الشراء'));
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void fetchPurchases();
  }, [fetchPurchases]);

  const currency = project?.currency || 'SAR';

  const filteredPurchases = purchases.filter((p) => {
    const balanceInfo = p.purchase_balances?.[0];
    const payStatus = balanceInfo?.payment_status || 'UNPAID';
    const recStatus = p.receipt_status || 'UNRECEIVED';

    const matchPay = paymentFilter === 'ALL' || payStatus === paymentFilter;
    const matchRec = receiptFilter === 'ALL' || recStatus === receiptFilter;

    const q = search.toLowerCase();
    const suppName = p.suppliers?.name || '';
    const num = p.purchase_number || '';
    const inv = p.invoice_number || '';

    const matchSearch =
      num.toLowerCase().includes(q) ||
      suppName.toLowerCase().includes(q) ||
      inv.toLowerCase().includes(q);

    return matchPay && matchRec && matchSearch;
  });

  // KPI Calculations
  const totalPurchaseSum = purchases.reduce((acc, p) => acc + Number(p.total || 0), 0);
  const totalPaidSum = purchases.reduce((acc, p) => {
    const paid = p.payments?.reduce((s, pay) => s + Number(pay.amount || 0), 0) || 0;
    return acc + paid;
  }, 0);
  const totalRemainingSum = Math.max(0, totalPurchaseSum - totalPaidSum);

  return (
    <PageContainer
      title="أوامر الشراء والتوريد"
      description="إدارة العقود مع الموردين، تسوية الفواتير، متابعة الاستلام والمدفوعات."
      loading={loading && purchases.length === 0}
      error={error}
      onRetry={fetchPurchases}
      headerActions={
        <ActionButton to="/purchases/new" icon={<Plus className="w-4 h-4" />}>
          أمر شراء جديد
        </ActionButton>
      }
      kpiStats={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            title="إجمالي أوامر الشراء"
            value={formatCurrency(totalPurchaseSum, currency)}
            subtitle={`${purchases.length} أمر شراء`}
            icon={<ShoppingCart className="w-5 h-5" />}
            variant="default"
          />
          <KpiCard
            title="إجمالي المدفوع"
            value={formatCurrency(totalPaidSum, currency)}
            subtitle="مسدد للموردين"
            variant="success"
          />
          <KpiCard
            title="المتبقي للموردين"
            value={formatCurrency(totalRemainingSum, currency)}
            subtitle="مستحقات غير مسددة"
            variant="danger"
          />
          <KpiCard
            title="عدد المشتريات"
            value={purchases.length}
            subtitle="عقد توريد"
            variant="info"
          />
        </div>
      }
      toolbar={
        <FilterToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث برقم الشراء، المورد، أو الفاتورة..."
          viewMode={viewMode}
          onViewModeChange={(mode) => setViewMode(mode as 'grid' | 'list')}
          availableModes={['grid', 'list']}
          filters={
            <>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              >
                <option value="ALL">جميع حالات الدفع</option>
                <option value="UNPAID">غير مدفوع</option>
                <option value="PARTIAL">مدفوع جزئياً</option>
                <option value="PAID">مدفوع بالكامل</option>
              </select>

              <select
                value={receiptFilter}
                onChange={(e) => setReceiptFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              >
                <option value="ALL">جميع حالات الاستلام</option>
                <option value="UNRECEIVED">غير مستلم</option>
                <option value="PARTIAL">مستلم جزئياً</option>
                <option value="FULL">مستلم بالكامل</option>
              </select>
            </>
          }
        />
      }
    >

      {/* List / Grid */}
      {filteredPurchases.length === 0 ? (
        <EmptyState
          title="لا توجد أوامر شراء مطابقة"
          description={search ? 'جرب البحث برقم آخر أو تعديل التصفية.' : 'لم يتم تسجيل أوامر شراء بعد.'}
          action={
            <Link
              to="/purchases/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700"
            >
              <Plus className="w-4 h-4" /> أمر شراء جديد
            </Link>
          }
        />
      ) : viewMode === 'grid' ? (
        /* Unified 2*2 Responsive Grid Layout */
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {filteredPurchases.map((p) => {
            const totalPaid = p.payments?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;
            const remaining = Number(p.total) - totalPaid;
            const payStatus = remaining <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID';

            return (
              <Link
                key={p.id}
                to={`/purchases/${p.id}`}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs hover:border-sky-500 dark:hover:border-sky-500 transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="font-mono font-black text-xs sm:text-sm text-sky-700 dark:text-sky-400 group-hover:underline" dir="ltr">
                      {p.purchase_number}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatDate(p.date)}</span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {p.suppliers?.name || 'مورد غير محدد'}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    <StatusBadge variant={p.receipt_status} />
                    <StatusBadge variant={payStatus} />
                  </div>
                </div>

                {/* High Contrast Price Box */}
                <div className="bg-slate-100/90 dark:bg-slate-800/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">الإجمالي:</span>
                    <span className="font-black text-sm text-slate-900 dark:text-slate-50">
                      {formatCurrency(p.total, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">المسدد:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(totalPaid, currency)}
                    </span>
                  </div>
                  {remaining > 0 && (
                    <div className="flex justify-between items-center text-[11px] border-t border-slate-200/60 dark:border-slate-700/60 pt-1">
                      <span className="text-rose-600 dark:text-rose-400 font-bold">المتبقي:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(remaining, currency)}
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPurchases.map((p) => {
            const totalPaid = p.payments?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;
            const remaining = Number(p.total) - totalPaid;
            const payStatus = remaining <= 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID';

            return (
              <Link
                key={p.id}
                to={`/purchases/${p.id}`}
                className="block bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-sky-300 dark:hover:border-sky-500 transition-all group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-xl group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-base" dir="ltr">{p.purchase_number}</span>
                        <StatusBadge variant={p.receipt_status} />
                        <StatusBadge variant={payStatus} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{p.suppliers?.name || 'مورد'}</span>
                        <span className="text-slate-400">• التاريخ: {formatDate(p.date)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 dark:text-sky-400 group-hover:text-sky-700">
                    عرض التفاصيل والاستلام <ChevronLeft className="w-4 h-4" />
                  </div>
                </div>

                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
                    <div>
                      الإجمالي: <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(p.total, currency)}</span>
                    </div>
                    <div>
                      المدفوع: <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalPaid, currency)}</span>
                    </div>
                    <div>
                      المتبقي: <span className={`font-bold ${remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>{formatCurrency(remaining, currency)}</span>
                    </div>
                  </div>

                  {p.invoice_number && (
                    <div className="text-slate-400 text-[11px]" dir="ltr">
                      فاتورة رقم: {p.invoice_number}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
