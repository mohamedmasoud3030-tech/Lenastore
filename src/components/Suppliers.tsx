import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Supplier, SupplierBalance } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import {
  PageContainer,
  FilterToolbar,
  ActionButton,
  KpiCard,
  EmptyState,
} from './common';
import { useToast } from './common/ToastProvider';
import { formatCurrency } from '../lib/formatters';
import {
  Building2,
  Plus,
  Phone,
  FileText,
  DollarSign,
  X,
  UserCheck,
  Edit,
} from 'lucide-react';

export default function Suppliers() {
  const { project } = useProject();
  const toast = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierBalances, setSupplierBalances] = useState<SupplierBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    company: '',
    phone: '',
    tax_id: '',
    notes: '',
  });

  const currency = project?.currency || 'SAR';

  const fetchSuppliers = useCallback(async () => {
    if (!supabase || !project) return;
    setLoading(true);
    setError(null);

    try {
      const [supRes, balRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('project_id', project.id).order('name'),
        supabase.from('supplier_balances').select('*').eq('project_id', project.id),
      ]);

      if (supRes.error) throw supRes.error;

      setSuppliers(supRes.data as Supplier[]);
      setSupplierBalances((balRes.data as SupplierBalance[]) || []);
    } catch (err: any) {
      console.error(err);
      setError(parseSupabaseError(err, 'حدث خطأ أثناء تحميل سجل الموردين'));
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void fetchSuppliers();
  }, [fetchSuppliers]);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setForm({ name: '', company: '', phone: '', tax_id: '', notes: '' });
    setShowAddModal(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setForm({
      name: s.name || '',
      company: s.company || '',
      phone: s.phone || '',
      tax_id: s.tax_id || '',
      notes: s.notes || '',
    });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;

    if (!form.name.trim()) {
      toast.error('يرجى كتابة اسم المورد');
      return;
    }

    setSubmitting(true);

    try {
      if (editingSupplier) {
        const { error: err } = await supabase
          .from('suppliers')
          .update({
            name: form.name.trim(),
            company: form.company.trim() || null,
            phone: form.phone.trim() || null,
            tax_id: form.tax_id.trim() || null,
            notes: form.notes.trim() || null,
          })
          .eq('id', editingSupplier.id);

        if (err) throw err;
        toast.success(`تم تحديث بيانات المورد (${form.name}) بنجاح`);
      } else {
        const { error: err } = await supabase.from('suppliers').insert([
          {
            project_id: project.id,
            name: form.name.trim(),
            company: form.company.trim() || null,
            phone: form.phone.trim() || null,
            tax_id: form.tax_id.trim() || null,
            notes: form.notes.trim() || null,
          },
        ]);

        if (err) throw err;
        toast.success(`تم إدراج المورد (${form.name}) بنجاح`);
      }

      setShowAddModal(false);
      void fetchSuppliers();
    } catch (err: any) {
      toast.error(parseSupabaseError(err, 'حدث خطأ أثناء حفظ بيانات المورد'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.company && s.company.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  // KPI Calculations
  const totalPurchasesSum = supplierBalances.reduce((acc, b) => acc + Number(b.total_purchases || 0), 0);
  const totalPaidSum = supplierBalances.reduce((acc, b) => acc + Number(b.total_paid || 0), 0);
  const totalRemainingSum = supplierBalances.reduce((acc, b) => acc + Number(b.remaining_balance || 0), 0);

  return (
    <PageContainer
      title="الموردون والشركات التجميعية"
      description="إدارة الموردين، متابعة مبالغ الشراء المسجلة لكل مورد، والمدفوعات والمستحقات."
      loading={loading && suppliers.length === 0}
      error={error}
      onRetry={fetchSuppliers}
      headerActions={
        <ActionButton onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
          إضافة مورد جديد
        </ActionButton>
      }
      kpiStats={
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            title="عدد الموردين"
            value={suppliers.length}
            subtitle="مورد مسجل"
            icon={<Building2 className="w-5 h-5" />}
            variant="default"
          />
          <KpiCard
            title="إجمالي مشتريات الموردين"
            value={formatCurrency(totalPurchasesSum, currency)}
            subtitle="قيمة عقود وفواتير التوريد"
            variant="info"
          />
          <KpiCard
            title="إجمالي السداد للموردين"
            value={formatCurrency(totalPaidSum, currency)}
            subtitle="مدفوعات مسددة"
            variant="success"
          />
          <KpiCard
            title="إجمالي المستحقات المتبقية"
            value={formatCurrency(totalRemainingSum, currency)}
            subtitle="مبالغ مؤجلة للموردين"
            variant="danger"
          />
        </div>
      }
      toolbar={
        <FilterToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="بحث باسم المورد، الشركة، أو رقم الهاتف..."
        />
      }
    >

      {/* Grid */}
      {filteredSuppliers.length === 0 ? (
        <EmptyState
          title="لا يوجد موردون مطاطبون"
          description={search ? 'جرب استخدام كلمات بحث أخرى.' : 'لم تقم بإضافة أي مورد بعد.'}
          action={
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700"
            >
              <Plus className="w-4 h-4" /> إضافة مورد الآن
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {filteredSuppliers.map((s) => {
            const bal = supplierBalances.find((b) => b.supplier_id === s.id);
            const totalPurch = Number(bal?.total_purchases || 0);
            const totalPaid = Number(bal?.total_paid || 0);
            const remaining = Number(bal?.remaining_balance || 0);

            return (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3 hover:border-sky-500 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-xl shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-xs sm:text-sm truncate">{s.name}</h3>
                        {s.company && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{s.company}</p>}
                      </div>
                    </div>

                    <button
                      onClick={() => openEditModal(s)}
                      className="p-1 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg shrink-0"
                      title="تعديل المورد"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                    {s.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span dir="ltr">{s.phone}</span>
                      </p>
                    )}
                    {s.tax_id && (
                      <p className="flex items-center gap-1.5">
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span>ضريبي: {s.tax_id}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Balances summary footer */}
                <div className="bg-slate-100/90 dark:bg-slate-800/90 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-[11px] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">التوريد:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalPurch, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">المدفوع:</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(totalPaid, currency)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/60 dark:border-slate-700/60 pt-1">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">المتبقي:</span>
                    <span className={`font-bold ${remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                      {formatCurrency(remaining, currency)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setShowAddModal(false)} />
            <div className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-right shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-slate-200 dark:border-slate-800">
              <form onSubmit={handleSubmit}>
                <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-sky-400" />
                    <h3 className="text-base font-bold">{editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</h3>
                  </div>
                  <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">اسم المورد / المسؤول *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: شركة الخليج للحديد"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">اسم الشركة التجاري</label>
                    <input
                      type="text"
                      placeholder="اختياري"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">رقم الهاتف</label>
                      <input
                        type="tel"
                        dir="ltr"
                        placeholder="05xxxx"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الرقم الضريبي</label>
                      <input
                        type="text"
                        placeholder="3000xxxx"
                        value={form.tax_id}
                        onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">ملاحظات إضافية</label>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="شروط التسليم أو الدفع..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    ></textarea>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 flex flex-row-reverse gap-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'جاري الحفظ...' : 'حفظ بيانات المورد'}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
