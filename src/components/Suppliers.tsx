import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Supplier, SupplierBalance } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { PageHeader } from './common/PageHeader';
import { KpiCard } from './common/KpiCard';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { EmptyState } from './common/EmptyState';
import { ErrorState } from './common/ErrorState';
import { useToast } from './common/ToastProvider';
import { formatCurrency } from '../lib/formatters';
import {
  Building2,
  Plus,
  Search,
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

  if (loading && suppliers.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="الموردون" description="دليل الموردين والمقاولين والالتزامات المالية" />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الموردون والشركات التجميعية"
        description="إدارة الموردين، متابعة مبالغ الشراء المسجلة لكل مورد، والمدفوعات والمستحقات."
        actions={
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> إضافة مورد جديد
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchSuppliers} />}

      {/* KPI Summary */}
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

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم المورد، الشركة، أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          />
        </div>
      </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((s) => {
            const bal = supplierBalances.find((b) => b.supplier_id === s.id);
            const totalPurch = Number(bal?.total_purchases || 0);
            const totalPaid = Number(bal?.total_paid || 0);
            const remaining = Number(bal?.remaining_balance || 0);

            return (
              <div
                key={s.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 hover:border-sky-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{s.name}</h3>
                        {s.company && <p className="text-xs text-slate-500 mt-0.5">{s.company}</p>}
                      </div>
                    </div>

                    <button
                      onClick={() => openEditModal(s)}
                      className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                      title="تعديل المورد"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    {s.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span dir="ltr">{s.phone}</span>
                      </p>
                    )}
                    {s.tax_id && (
                      <p className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>الرقم الضريبي: {s.tax_id}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Balances summary footer */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1 mt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">إجمالي التوريد:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(totalPurch, currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">المدفوع:</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(totalPaid, currency)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200/60 pt-1">
                    <span className="text-slate-500 font-medium">المتبقي:</span>
                    <span className={`font-bold ${remaining > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
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
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-right shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-slate-200">
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
                    <label className="block font-semibold text-slate-700 mb-1">اسم المورد / المسؤول *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: شركة الخليج للحديد"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">اسم الشركة التجاري</label>
                    <input
                      type="text"
                      placeholder="اختياري"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">رقم الهاتف</label>
                      <input
                        type="tel"
                        dir="ltr"
                        placeholder="05xxxx"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">الرقم الضريبي</label>
                      <input
                        type="text"
                        placeholder="3000xxxx"
                        value={form.tax_id}
                        onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">ملاحظات إضافية</label>
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="شروط التسليم أو الدفع..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    ></textarea>
                  </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex flex-row-reverse gap-3 border-t border-slate-200">
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
                    className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors shadow-xs"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
