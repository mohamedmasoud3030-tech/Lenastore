import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { StockMovement, StockIssue, GoodsReceipt, MaterialStock } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { PageHeader } from './common/PageHeader';
import { KpiCard } from './common/KpiCard';
import { StatusBadge } from './common/StatusBadge';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { EmptyState } from './common/EmptyState';
import { ErrorState } from './common/ErrorState';
import { formatDate } from '../lib/formatters';
import { CreateIssueVoucherModal } from './CreateIssueVoucherModal';
import { StockIssuePrintModal } from './StockIssuePrintModal';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Plus,
  Printer,
  FileText,
  Calendar,
  Layers,
  Package2,
  Filter,
} from 'lucide-react';

export default function Movements() {
  const { project } = useProject();

  const [activeTab, setActiveTab] = useState<'LEDGER' | 'ISSUES' | 'RECEIPTS'>('LEDGER');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [materials, setMaterials] = useState<MaterialStock[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [materialFilter, setMaterialFilter] = useState('ALL');

  // Modals
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedPrintIssue, setSelectedPrintIssue] = useState<StockIssue | null>(null);

  const fetchData = useCallback(async () => {
    if (!supabase || !project) return;
    setLoading(true);
    setError(null);

    try {
      const [movRes, issuesRes, receiptsRes, matRes] = await Promise.all([
        supabase
          .from('stock_movements')
          .select('*, materials(name, unit), suppliers(name), purchases(purchase_number)')
          .eq('project_id', project.id)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('stock_issues')
          .select('*, stock_issue_items(*, materials(name, unit))')
          .eq('project_id', project.id)
          .order('date', { ascending: false }),
        supabase
          .from('goods_receipts')
          .select('*, goods_receipt_items(*, materials(name, unit)), purchases(purchase_number), suppliers(name)')
          .eq('project_id', project.id)
          .order('date', { ascending: false }),
        supabase
          .from('material_stock')
          .select('*')
          .eq('project_id', project.id),
      ]);

      if (movRes.error) throw movRes.error;
      if (issuesRes.error) throw issuesRes.error;
      if (receiptsRes.error) throw receiptsRes.error;
      if (matRes.error) throw matRes.error;

      setMovements((movRes.data as any) || []);
      setStockIssues((issuesRes.data as any) || []);
      setGoodsReceipts((receiptsRes.data as any) || []);
      setMaterials((matRes.data as any) || []);
    } catch (err: any) {
      console.error(err);
      setError(parseSupabaseError(err, 'حدث خطأ أثناء تحميل سجل الحركات'));
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Filtered movements
  const filteredMovements = movements.filter((m) => {
    const matchType = typeFilter === 'ALL' || m.type === typeFilter;
    const matchMaterial = materialFilter === 'ALL' || m.material_id === materialFilter;
    const matName = m.materials?.name || '';
    const receiver = m.receiver_name || '';
    const ref = m.reference_number || '';
    const supp = m.suppliers?.name || '';
    const q = search.toLowerCase();

    const matchSearch =
      matName.toLowerCase().includes(q) ||
      receiver.toLowerCase().includes(q) ||
      ref.toLowerCase().includes(q) ||
      supp.toLowerCase().includes(q);

    return matchType && matchMaterial && matchSearch;
  });

  // KPI Calculations
  const totalInCount = movements.filter((m) => m.type === 'IN').length;
  const totalOutCount = movements.filter((m) => m.type === 'OUT').length;
  const totalIssuesCount = stockIssues.length;
  const totalReceiptsCount = goodsReceipts.length;

  if (loading && movements.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="دفتر حركات المخزون وسندات الصرف" description="سجل الوارد والصادر ومتابعة سندات المستودع" />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="حركات المخزون وسندات المستودع"
        description="دفتر الحركات الشامل، إصدار وتوثيق سندات الصرف والاستلام الموقعي."
        actions={
          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> إصدار سند صرف جديد
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchData} />}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="إجمالي الحركات"
          value={movements.length}
          subtitle="حركة وارد وصرف مسجلة"
          icon={<Layers className="w-5 h-5" />}
          variant="default"
        />
        <KpiCard
          title="حركات الوارد (+)"
          value={totalInCount}
          subtitle={`${totalReceiptsCount} سند استلام توريد`}
          variant="success"
        />
        <KpiCard
          title="سندات الصرف (-)"
          value={totalIssuesCount}
          subtitle={`${totalOutCount} عملية صرف موقعية`}
          variant="warning"
        />
        <KpiCard
          title="إجمالي أصناف الكتالوج"
          value={materials.length}
          subtitle="مادة متتبعة بالمشروع"
          variant="info"
        />
      </div>

      {/* Navigation Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveTab('LEDGER')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'LEDGER' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              سجل الحركات (Ledger)
            </button>
            <button
              onClick={() => setActiveTab('ISSUES')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'ISSUES' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              سندات الصرف ({stockIssues.length})
            </button>
            <button
              onClick={() => setActiveTab('RECEIPTS')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'RECEIPTS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              سندات الاستلام والوارد ({goodsReceipts.length})
            </button>
          </div>

          <button
            onClick={() => setIsIssueModalOpen(true)}
            className="sm:hidden w-full py-2 text-xs font-bold bg-amber-600 text-white rounded-xl"
          >
            + سند صرف جديد
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالمادة، المستلم، المورد، رقم المرجع أو السند..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-3 pr-9 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          {activeTab === 'LEDGER' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden w-full sm:w-auto"
              >
                <option value="ALL">جميع الحركات</option>
                <option value="IN">وارد فقط (+)</option>
                <option value="OUT">صرف فقط (-)</option>
              </select>

              <select
                value={materialFilter}
                onChange={(e) => setMaterialFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden w-full sm:w-auto"
              >
                <option value="ALL">جميع المواد</option>
                {materials.map((m) => (
                  <option key={m.material_id} value={m.material_id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: ALL MOVEMENTS LEDGER */}
      {activeTab === 'LEDGER' && (
        filteredMovements.length === 0 ? (
          <EmptyState
            title="لا توجد حركات مخزنية"
            description={search ? 'لم نجد حركات تطابق شروط البحث.' : 'لم يتم تسجيل أي حركات مخزنية لهذا المشروع بعد.'}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">التاريخ والنوع</th>
                    <th className="px-4 py-3.5">اسم المادة</th>
                    <th className="px-4 py-3.5 text-center">الكمية</th>
                    <th className="px-4 py-3.5">المستلم / المورد</th>
                    <th className="px-4 py-3.5">جهة الاستخدام / المرجع</th>
                    <th className="px-5 py-3.5 text-left">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredMovements.map((mov) => {
                    const isIN = mov.type === 'IN';
                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`p-1.5 rounded-lg ${
                                isIN ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isIN ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                            </span>
                            <div>
                              <StatusBadge variant={mov.type} />
                              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(mov.date)}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          {mov.materials?.name || 'مادة مخزنية'}
                        </td>

                        <td className="px-4 py-3.5 text-center">
                          <span className={`text-sm font-bold ${isIN ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {isIN ? '+' : '-'}{mov.quantity}
                          </span>
                          <span className="text-[11px] text-slate-400 ms-1">{mov.materials?.unit}</span>
                        </td>

                        <td className="px-4 py-3.5">
                          {mov.receiver_name ? (
                            <div>
                              <span className="font-semibold text-slate-900">{mov.receiver_name}</span>
                              <p className="text-[11px] text-slate-400">مستلم موقعي</p>
                            </div>
                          ) : mov.suppliers?.name ? (
                            <div>
                              <span className="font-semibold text-slate-900">{mov.suppliers.name}</span>
                              <p className="text-[11px] text-slate-400">مورد مواد</p>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            {mov.location_used && (
                              <div className="text-slate-800 font-medium">{mov.location_used}</div>
                            )}
                            {mov.reference_number && (
                              <div className="text-[11px] text-slate-500" dir="ltr">
                                {mov.reference_number}
                              </div>
                            )}
                            {!mov.location_used && !mov.reference_number && <span className="text-slate-400">-</span>}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-left text-slate-500 max-w-xs truncate">
                          {mov.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* TAB 2: STOCK ISSUE VOUCHERS */}
      {activeTab === 'ISSUES' && (
        stockIssues.length === 0 ? (
          <EmptyState
            title="لا توجد سندات صرف مسجلة"
            description="أنشئ سند صرف موقعي جديد لتوثيق المنصرف من المواد للأعمال الهندسية."
            action={
              <button
                onClick={() => setIsIssueModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 text-white hover:bg-amber-700"
              >
                <Plus className="w-4 h-4" /> إصدار أول سند صرف
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stockIssues.map((issue) => (
              <div key={issue.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-base" dir="ltr">{issue.issue_number}</span>
                      <StatusBadge variant="out" label="سند صرف" />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(issue.date)}</p>
                  </div>
                  <button
                    onClick={() => setSelectedPrintIssue(issue)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" /> طباعة / معاينة
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400">المستلم:</span>{' '}
                    <span className="font-bold text-slate-900">{issue.receiver_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">جهة الاستخدام:</span>{' '}
                    <span className="font-bold text-slate-900">{issue.destination || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">المرجع:</span>{' '}
                    <span className="font-semibold text-slate-800" dir="ltr">{issue.reference_number || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">عدد البنود:</span>{' '}
                    <span className="font-bold text-slate-900">{issue.stock_issue_items?.length || 0} بنود</span>
                  </div>
                </div>

                {issue.stock_issue_items && issue.stock_issue_items.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                    {issue.stock_issue_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{item.materials?.name || 'مادة'}</span>
                        <span className="font-bold text-amber-800">
                          {item.quantity} {item.materials?.unit || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* TAB 3: GOODS RECEIPTS */}
      {activeTab === 'RECEIPTS' && (
        goodsReceipts.length === 0 ? (
          <EmptyState
            title="لا توجد سندات استلام توريد"
            description="يتم إنشاء سندات الاستلام تلقائيًا عند توثيق استلام المشتريات من الموردين."
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">رقم السند والتاريخ</th>
                    <th className="px-4 py-3.5">أمر الشراء والمورد</th>
                    <th className="px-4 py-3.5 text-center">المواد المستلمة</th>
                    <th className="px-4 py-3.5 text-center">الحالة</th>
                    <th className="px-5 py-3.5 text-left">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {goodsReceipts.map((gr) => (
                    <tr key={gr.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                            <ArrowDownToLine className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900" dir="ltr">{gr.receipt_number}</span>
                            <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(gr.date)}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div>
                          <span className="font-bold text-slate-900">{gr.suppliers?.name || 'مورد'}</span>
                          <p className="text-[11px] text-slate-500" dir="ltr">
                            أمر شراء: {gr.purchases?.purchase_number || '-'}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <div className="space-y-1">
                          {gr.goods_receipt_items?.map((item) => (
                            <div key={item.id} className="text-xs">
                              <span className="font-medium text-slate-800">{item.materials?.name}:</span>{' '}
                              <span className="font-bold text-emerald-700">+{item.received_quantity} {item.materials?.unit}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center">
                        <StatusBadge variant="full" label="مستلم وموثق" />
                      </td>

                      <td className="px-5 py-4 text-left text-slate-500">
                        {gr.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Modal for creating Issue Voucher */}
      <CreateIssueVoucherModal
        isOpen={isIssueModalOpen}
        materials={materials}
        onClose={() => setIsIssueModalOpen(false)}
        onSuccess={fetchData}
      />

      {/* Modal for Printing Issue Voucher */}
      <StockIssuePrintModal
        issue={selectedPrintIssue}
        isOpen={!!selectedPrintIssue}
        onClose={() => setSelectedPrintIssue(null)}
      />
    </div>
  );
}
