import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Purchase } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { PageHeader } from './common/PageHeader';
import { KpiCard } from './common/KpiCard';
import { StatusBadge } from './common/StatusBadge';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { EmptyState } from './common/EmptyState';
import { ErrorState } from './common/ErrorState';
import { formatCurrency, formatDate } from '../lib/formatters';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  DollarSign,
  PackageCheck,
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

  if (loading && purchases.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="أوامر الشراء والتوريد" description="إدارة عقود التوريد والمدفوعات والمستودع" />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="أوامر الشراء والتوريد"
        description="إدارة العقود مع الموردين، تسوية الفواتير، متابعة الاستلام والمدفوعات."
        actions={
          <Link
            to="/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> أمر شراء جديد
          </Link>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchPurchases} />}

      {/* KPI Cards */}
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

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم الشراء، المورد، أو الفاتورة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          >
            <option value="ALL">جميع حالات الدفع</option>
            <option value="UNPAID">غير مدفوع</option>
            <option value="PARTIAL">مدفوع جزئياً</option>
            <option value="PAID">مدفوع بالكامل</option>
          </select>

          <select
            value={receiptFilter}
            onChange={(e) => setReceiptFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          >
            <option value="ALL">جميع حالات الاستلام</option>
            <option value="UNRECEIVED">غير مستلم</option>
            <option value="PARTIAL">مستلم جزئياً</option>
            <option value="FULL">مستلم بالكامل</option>
          </select>
        </div>
      </div>

      {/* List */}
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
                className="block bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-sky-300 hover:shadow-md transition-all group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl group-hover:bg-sky-600 group-hover:text-white transition-colors">
                      <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base" dir="ltr">{p.purchase_number}</span>
                        <StatusBadge variant={p.receipt_status} />
                        <StatusBadge variant={payStatus} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5" />
                        <span className="font-semibold text-slate-800">{p.suppliers?.name || 'مورد'}</span>
                        <span className="text-slate-400">• التاريخ: {formatDate(p.date)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-600 group-hover:text-sky-700">
                    عرض التفاصيل والاستلام <ChevronLeft className="w-4 h-4" />
                  </div>
                </div>

                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-4 text-slate-600">
                    <div>
                      الإجمالي: <span className="font-bold text-slate-900">{formatCurrency(p.total, currency)}</span>
                    </div>
                    <div>
                      المدفوع: <span className="font-bold text-emerald-700">{formatCurrency(totalPaid, currency)}</span>
                    </div>
                    <div>
                      المتبقي: <span className={`font-bold ${remaining > 0 ? 'text-rose-600' : 'text-slate-500'}`}>{formatCurrency(remaining, currency)}</span>
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
    </div>
  );
}
