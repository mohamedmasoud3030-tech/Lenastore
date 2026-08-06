import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { MaterialStock } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { useToast } from './common/ToastProvider';
import { PageHeader } from './common/PageHeader';
import { KpiCard } from './common/KpiCard';
import { StatusBadge } from './common/StatusBadge';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { EmptyState } from './common/EmptyState';
import { ErrorState } from './common/ErrorState';
import { MaterialDetailsDrawer } from './MaterialDetailsDrawer';
import {
  Package2,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
  Edit2,
  ChevronRight,
} from 'lucide-react';

export default function Materials() {
  const { project } = useProject();
  const toast = useToast();

  const [materials, setMaterials] = useState<MaterialStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LOW' | 'OUT' | 'AVAILABLE'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'category'>('name');

  const [selectedMaterial, setSelectedMaterial] = useState<MaterialStock | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialStock | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category: '',
    unit: 'متر مكعب',
    min_stock: '0',
    notes: '',
  });

  const fetchMaterials = useCallback(async () => {
    if (!supabase || !project) return;
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchErr } = await supabase
        .from('material_stock')
        .select('*')
        .eq('project_id', project.id);

      if (fetchErr) throw fetchErr;

      setMaterials((data as MaterialStock[]) || []);
    } catch (err: any) {
      console.error(err);
      setError(parseSupabaseError(err, 'حدث خطأ أثناء تحميل قائمة المواد'));
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void fetchMaterials();
  }, [fetchMaterials]);

  // Categories list
  const categories = Array.from(
    new Set(materials.map((m) => m.category).filter(Boolean) as string[])
  );

  // Filters & Sorting logic
  const filteredMaterials = materials
    .filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.category && m.category.toLowerCase().includes(search.toLowerCase()));

      const matchCategory = categoryFilter === 'ALL' || m.category === categoryFilter;

      let matchStatus = true;
      const current = Number(m.current_stock);
      const min = Number(m.min_stock);

      if (statusFilter === 'LOW') {
        matchStatus = current <= min && current > 0;
      } else if (statusFilter === 'OUT') {
        matchStatus = current <= 0;
      } else if (statusFilter === 'AVAILABLE') {
        matchStatus = current > min;
      }

      return matchSearch && matchCategory && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'stock') {
        return Number(b.current_stock) - Number(a.current_stock);
      }
      if (sortBy === 'category') {
        return (a.category || '').localeCompare(b.category || '', 'ar');
      }
      return a.name.localeCompare(b.name, 'ar');
    });

  // KPI Calculations
  const totalMaterials = materials.length;
  const lowStockCount = materials.filter(
    (m) => Number(m.current_stock) <= Number(m.min_stock) && Number(m.current_stock) > 0
  ).length;
  const outOfStockCount = materials.filter((m) => Number(m.current_stock) <= 0).length;
  const availableCount = materials.filter(
    (m) => Number(m.current_stock) > Number(m.min_stock)
  ).length;

  const handleOpenAddModal = () => {
    setEditingMaterial(null);
    setForm({
      name: '',
      category: '',
      unit: 'طُن',
      min_stock: '10',
      notes: '',
    });
    setShowAddEditModal(true);
  };

  const handleOpenEditModal = (mat: MaterialStock, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingMaterial(mat);
    setForm({
      name: mat.name,
      category: mat.category || '',
      unit: mat.unit,
      min_stock: String(mat.min_stock),
      notes: '',
    });
    setShowAddEditModal(true);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;

    if (!form.name.trim()) {
      toast.error('يرجى إدخال اسم المادة');
      return;
    }
    if (!form.unit.trim()) {
      toast.error('يرجى إدخال وحدة القياس');
      return;
    }

    const minStockVal = Number(form.min_stock);
    if (isNaN(minStockVal) || minStockVal < 0) {
      toast.error('الحد الأدنى للمخزون يجب أن يكون صفرًا أو أكثر');
      return;
    }

    setSubmitting(true);
    try {
      if (editingMaterial) {
        // Update
        const { error: updateErr } = await supabase
          .from('materials')
          .update({
            name: form.name.trim(),
            category: form.category.trim() || null,
            unit: form.unit.trim(),
            min_stock: minStockVal,
            notes: form.notes.trim() || null,
          })
          .eq('id', editingMaterial.material_id)
          .eq('project_id', project.id);

        if (updateErr) throw updateErr;
        toast.success(`تم تحديث المادة "${form.name}" بنجاح`);
      } else {
        // Create
        const { error: insertErr } = await supabase.from('materials').insert([
          {
            project_id: project.id,
            name: form.name.trim(),
            category: form.category.trim() || null,
            unit: form.unit.trim(),
            min_stock: minStockVal,
            notes: form.notes.trim() || null,
          },
        ]);

        if (insertErr) throw insertErr;
        toast.success(`تم إضافة المادة "${form.name}" بنجاح`);
      }

      setShowAddEditModal(false);
      void fetchMaterials();
    } catch (err: any) {
      toast.error(parseSupabaseError(err, 'حدث خطأ أثناء حفظ المادة'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && materials.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="المواد والمخزون" description="إدارة كتالوج المواد ومتابعة أرصدة المخزون" />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="المواد والمخزون"
        description="كتالوج المواد والمستودع، تحديث الحد الأدنى، ومتابعة حركة الأصناف."
        actions={
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" /> إضافة مادة جديدة
          </button>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchMaterials} />}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          title="إجمالي المواد"
          value={totalMaterials}
          subtitle="صنف مسجل في الكتالوج"
          icon={<Package2 className="w-5 h-5" />}
          variant="default"
        />
        <KpiCard
          title="متوفر بشكل جيد"
          value={availableCount}
          subtitle="أعلى من الحد الأدنى"
          variant="success"
        />
        <KpiCard
          title="منخفض الرصيد"
          value={lowStockCount}
          subtitle="يتطلب إعادة طلب"
          variant="warning"
        />
        <KpiCard
          title="نفد من المخزن"
          value={outOfStockCount}
          subtitle="الرصيد 0 حاليًا"
          variant="danger"
        />
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث عن مادة بالاسم أو التصنيف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({totalMaterials})
            </button>
            <button
              onClick={() => setStatusFilter('LOW')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                statusFilter === 'LOW' ? 'bg-amber-100 text-amber-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              منخفض ({lowStockCount})
            </button>
            <button
              onClick={() => setStatusFilter('OUT')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                statusFilter === 'OUT' ? 'bg-rose-100 text-rose-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              نافد ({outOfStockCount})
            </button>
          </div>

          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            >
              <option value="ALL">جميع التصنيفات</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          >
            <option value="name">ترتيب بالاسم</option>
            <option value="stock">ترتيب بالرصيد المتاح</option>
            <option value="category">ترتيب بالتصنيف</option>
          </select>
        </div>
      </div>

      {/* Materials Table & List */}
      {filteredMaterials.length === 0 ? (
        <EmptyState
          title="لا توجد مواد مطابقة"
          description={search ? 'جرب البحث بكلمة أخرى أو تعديل تصفية الحالة.' : 'لم يتم إضافة مواد لهذا المشروع بعد.'}
          action={
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700"
            >
              <Plus className="w-4 h-4" /> إضافة مادة جديدة
            </button>
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="px-5 py-3.5">اسم المادة والتصنيف</th>
                  <th className="px-4 py-3.5 text-center">الوحدة</th>
                  <th className="px-4 py-3.5 text-center">الوارد المخزني</th>
                  <th className="px-4 py-3.5 text-center">الصرف المخزني</th>
                  <th className="px-4 py-3.5 text-center">الرصيد المتاح</th>
                  <th className="px-4 py-3.5 text-center">الحد الأدنى</th>
                  <th className="px-4 py-3.5 text-center">الحالة</th>
                  <th className="px-5 py-3.5 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredMaterials.map((item) => {
                  const stock = Number(item.current_stock);
                  const min = Number(item.min_stock);
                  const isLow = stock <= min && stock > 0;
                  const isOut = stock <= 0;
                  const badgeVariant = isOut ? 'out_of_stock' : isLow ? 'low' : 'available';

                  return (
                    <tr
                      key={item.material_id}
                      onClick={() => {
                        setSelectedMaterial(item);
                        setIsDrawerOpen(true);
                      }}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 group-hover:bg-sky-100 group-hover:text-sky-700 text-slate-500 rounded-xl transition-colors">
                            <Package2 className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                              {item.name}
                            </span>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {item.category || 'بدون تصنيف'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-center text-slate-600 font-medium">
                        {item.unit}
                      </td>

                      <td className="px-4 py-4 text-center font-semibold text-emerald-700">
                        +{item.total_in}
                      </td>

                      <td className="px-4 py-4 text-center font-semibold text-amber-700">
                        -{item.total_out}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <span
                          className={`text-sm font-bold ${
                            isOut
                              ? 'text-rose-600'
                              : isLow
                              ? 'text-amber-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {stock}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-center text-slate-500 font-medium">
                        {min}
                      </td>

                      <td className="px-4 py-4 text-center">
                        <StatusBadge variant={badgeVariant} />
                      </td>

                      <td className="px-5 py-4 text-left">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleOpenEditModal(item, e)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                            title="تعديل المادة"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Material Details History Drawer */}
      <MaterialDetailsDrawer
        material={selectedMaterial}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={(mat) => handleOpenEditModal(mat)}
      />

      {/* Add / Edit Material Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
              onClick={() => setShowAddEditModal(false)}
            />
            <div className="relative transform overflow-hidden rounded-2xl bg-white text-right shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-md border border-slate-200">
              <form onSubmit={handleSaveMaterial}>
                <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
                  <h3 className="text-base font-bold">
                    {editingMaterial ? 'تعديل بيانات مادة' : 'إضافة مادة جديدة للكتالوج'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddEditModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">اسم المادة *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أسمنت بورتلاندي / حديد 12 مم"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">التصنيف</label>
                      <input
                        type="text"
                        placeholder="مثال: خرسانات / تشطيبات"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">وحدة القياس *</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: طُن / كيس / متر مكعب"
                        value={form.unit}
                        onChange={(e) => setForm({ ...form, unit: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">الحد الأدنى للتنبيه *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={form.min_stock}
                      onChange={(e) => setForm({ ...form, min_stock: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      سيتم إظهار تنبيه المادة المنخفضة عندما يقل الرصيد المتاح عن هذا العدد.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات وصفية</label>
                    <textarea
                      rows={2}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    ></textarea>
                  </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex flex-row-reverse gap-3 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'جاري الحفظ...' : editingMaterial ? 'تحديث المادة' : 'إضافة المادة'}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setShowAddEditModal(false)}
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
