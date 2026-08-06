import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Supplier, Material } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { useToast } from './common/ToastProvider';
import { PageHeader } from './common/PageHeader';
import { formatCurrency } from '../lib/formatters';
import { Save, Plus, Trash2, ShoppingCart } from 'lucide-react';

interface PurchaseItemInput {
  material_id: string;
  quantity: string;
  unit_price: string;
}

interface SubmissionAttempt {
  key: string;
  fingerprint: string;
}

function createAttemptKey(): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `purchase-${randomPart}`;
}

export default function CreatePurchase() {
  const { project } = useProject();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const { request, items: requestItems } = (location.state as any) || {};

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [submissionAttempt, setSubmissionAttempt] = useState<SubmissionAttempt | null>(null);

  const currency = project?.currency || 'EGP';

  const [form, setForm] = useState({
    purchase_number: `PO-${Date.now().toString().slice(-5)}`,
    supplier_id: '',
    date: new Date().toISOString().split('T')[0],
    invoice_number: '',
    discount: '0',
    tax: '0',
    transport_cost: '0',
    notes: '',
    request_id: request?.id || null,
  });

  const initialItems: PurchaseItemInput[] = requestItems
    ? requestItems.map((requestItem: any) => ({
        material_id: requestItem.material_id,
        quantity: String(requestItem.quantity || 1),
        unit_price: '0',
      }))
    : [{ material_id: '', quantity: '1', unit_price: '0' }];

  const [items, setItems] = useState<PurchaseItemInput[]>(initialItems);

  useEffect(() => {
    if (!supabase || !project) return;
    const fetchData = async () => {
      try {
        const [supplierResult, materialResult] = await Promise.all([
          supabase
            .from('suppliers')
            .select('id, project_id, name, company, phone, tax_id, notes, created_at, updated_at')
            .eq('project_id', project.id)
            .order('name'),
          supabase
            .from('materials')
            .select('id, project_id, name, category, unit, min_stock, notes, created_at, updated_at')
            .eq('project_id', project.id)
            .order('name'),
        ]);

        if (supplierResult.error) throw supplierResult.error;
        if (materialResult.error) throw materialResult.error;
        setSuppliers((supplierResult.data as Supplier[]) || []);
        setMaterials((materialResult.data as Material[]) || []);
      } catch (error) {
        console.error(error);
        toast.error(parseSupabaseError(error, 'تعذر تحميل الموردين والمواد'));
      }
    };
    void fetchData();
  }, [project, toast]);

  const handleAddItem = () => {
    setItems((previous) => [...previous, { material_id: '', quantity: '1', unit_price: '0' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const subtotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    return sum + Math.round(quantity * unitPrice * 100) / 100;
  }, 0);

  const discountValue = Number(form.discount) || 0;
  const taxValue = Number(form.tax) || 0;
  const transportValue = Number(form.transport_cost) || 0;
  const total = Math.round((subtotal - discountValue + taxValue + transportValue) * 100) / 100;

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !project) return;

    if (!form.supplier_id) {
      toast.error('يرجى اختيار المورد');
      return;
    }

    const validItems: { material_id: string; quantity: number; unit_price: number }[] = [];
    const selectedMaterialIds = new Set<string>();

    for (const item of items) {
      if (!item.material_id) {
        toast.error('يرجى اختيار المادة لجميع البنود');
        return;
      }
      if (selectedMaterialIds.has(item.material_id)) {
        toast.error('لا يمكن تكرار نفس المادة داخل أمر الشراء');
        return;
      }
      selectedMaterialIds.add(item.material_id);

      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error('الكمية يجب أن تكون أكبر من صفر');
        return;
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        toast.error('سعر الوحدة يجب أن يكون صفرًا أو أكثر');
        return;
      }
      validItems.push({ material_id: item.material_id, quantity, unit_price: unitPrice });
    }

    if (discountValue < 0 || taxValue < 0 || transportValue < 0 || total < 0) {
      toast.error('القيم المالية غير صحيحة أو ينتج عنها إجمالي سالب');
      return;
    }

    const payload = {
      p_project_id: project.id,
      p_request_id: form.request_id || null,
      p_purchase_number: form.purchase_number.trim(),
      p_supplier_id: form.supplier_id,
      p_purchase_date: form.date,
      p_invoice_number: form.invoice_number.trim() || null,
      p_discount: discountValue,
      p_tax: taxValue,
      p_transport_cost: transportValue,
      p_notes: form.notes.trim() || null,
      p_items: validItems,
    };
    const fingerprint = JSON.stringify(payload);
    const attempt =
      submissionAttempt?.fingerprint === fingerprint
        ? submissionAttempt
        : { key: createAttemptKey(), fingerprint };

    if (attempt !== submissionAttempt) setSubmissionAttempt(attempt);
    setLoading(true);

    try {
      const { data: purchaseId, error } = await supabase.rpc('create_purchase_atomic', {
        ...payload,
        p_idempotency_key: attempt.key,
      });
      if (error) throw error;
      if (!purchaseId) throw new Error('لم تُرجع قاعدة البيانات رقم أمر الشراء');

      setSubmissionAttempt(null);
      toast.success(`تم إنشاء أمر الشراء بنجاح (${form.purchase_number.trim()})`);
      navigate(`/purchases/${purchaseId}`);
    } catch (error) {
      toast.error(parseSupabaseError(error, 'حدث خطأ أثناء حفظ أمر الشراء'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="إنشاء أمر شراء وتوريد جديد"
        description={request ? `تحويل من طلب شراء: ${request.request_number}` : 'توثيق عقد شراء أو فواتير توريد موقعية'}
        onBack={() => navigate(-1)}
        icon={ShoppingCart}
      />

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">البيانات الأساسية للطلب</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم أمر الشراء *</label>
              <input
                type="text"
                required
                value={form.purchase_number}
                onChange={(e) => setForm({ ...form, purchase_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">تاريخ أمر الشراء *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">اختر المورد *</label>
              <select
                required
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              >
                <option value="">اختر مورد...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} {supplier.company ? `(${supplier.company})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رقم فاتورة المورد (إن وجد)</label>
              <input
                type="text"
                placeholder="مثال: INV-9901"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">بنود التوريد والأسعار</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
            >
              <Plus className="w-4 h-4" /> إضافة مادة أخرى
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const quantity = Number(item.quantity) || 0;
              const unitPrice = Number(item.unit_price) || 0;
              const itemTotal = Math.round(quantity * unitPrice * 100) / 100;

              return (
                <div key={index} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded-xl flex flex-col sm:flex-row gap-3 items-end">
                  <div className="w-full sm:w-2/5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">المادة *</label>
                    <select
                      required
                      value={item.material_id}
                      onChange={(e) => {
                        const next = [...items];
                        next[index].material_id = e.target.value;
                        setItems(next);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    >
                      <option value="">اختر مادة...</option>
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.name} ({material.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-1/5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الكمية *</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      required
                      value={item.quantity}
                      onChange={(e) => {
                        const next = [...items];
                        next[index].quantity = e.target.value;
                        setItems(next);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="w-full sm:w-1/5">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">سعر الوحدة ({currency}) *</label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0"
                      required
                      value={item.unit_price}
                      onChange={(e) => {
                        const next = [...items];
                        next[index].unit_price = e.target.value;
                        setItems(next);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="w-full sm:w-1/5 text-left py-2 px-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-[11px] text-slate-400 block">الإجمالي:</span>
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">{formatCurrency(itemTotal, currency)}</span>
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                      aria-label="حذف البند"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات أمر الشراء</label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="تفاصيل التوريد أو الدفع..."
                className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/70 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">المجموع الفرعي:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(subtotal, currency)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">خصم:</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  className="w-28 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-left text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400">ضريبة:</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })}
                  className="w-28 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-left text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-600 dark:text-slate-400">مصاريف نقل وتفريغ:</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.transport_cost}
                  onChange={(e) => setForm({ ...form, transport_cost: e.target.value })}
                  className="w-28 px-2 py-1 border border-slate-300 dark:border-slate-700 rounded-lg text-left text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-between text-sm font-black text-sky-700 dark:text-sky-400 pt-1">
                <span>الإجمالي النهائي:</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">تُعاد مراجعة الإجماليات وحسابها داخل قاعدة البيانات عند الحفظ.</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-2xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'جاري الحفظ...' : 'حفظ أمر الشراء'}
          </button>
        </div>
      </form>
    </div>
  );
}
