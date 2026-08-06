import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Supplier, Material } from '../types';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { useToast } from './common/ToastProvider';
import { formatCurrency } from '../lib/formatters';
import { Save, X, Plus, Trash2, ArrowRight, ShoppingCart } from 'lucide-react';

interface PurchaseItemInput {
  material_id: string;
  quantity: string;
  unit_price: string;
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

  const currency = project?.currency || 'SAR';

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
    ? requestItems.map((ri: any) => ({
        material_id: ri.material_id,
        quantity: String(ri.quantity || 1),
        unit_price: '0',
      }))
    : [{ material_id: '', quantity: '1', unit_price: '0' }];

  const [items, setItems] = useState<PurchaseItemInput[]>(initialItems);

  useEffect(() => {
    if (!supabase || !project) return;
    const fetchData = async () => {
      try {
        const [supRes, matRes] = await Promise.all([
          supabase.from('suppliers').select('*').eq('project_id', project.id).order('name'),
          supabase.from('materials').select('*').eq('project_id', project.id).order('name'),
        ]);

        if (!supRes.error && supRes.data) setSuppliers(supRes.data as Supplier[]);
        if (!matRes.error && matRes.data) setMaterials(matRes.data as Material[]);
      } catch (e) {
        console.error(e);
      }
    };
    void fetchData();
  }, [project]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { material_id: '', quantity: '1', unit_price: '0' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Financial summary
  const subtotal = items.reduce((acc, item) => {
    const q = Number(item.quantity) || 0;
    const p = Number(item.unit_price) || 0;
    return acc + q * p;
  }, 0);

  const discountVal = Number(form.discount) || 0;
  const taxVal = Number(form.tax) || 0;
  const transportVal = Number(form.transport_cost) || 0;
  const total = Math.max(0, subtotal - discountVal + taxVal + transportVal);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;

    if (!form.supplier_id) {
      toast.error('يرجى اختيار المورد');
      return;
    }

    const validItems = [];
    for (const item of items) {
      if (!item.material_id) {
        toast.error('يرجى اختيار المادة لجميع البنود');
        return;
      }
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      if (isNaN(qty) || qty <= 0) {
        toast.error('الكمية يجب أن تكون أكبر من صفر');
        return;
      }
      if (isNaN(price) || price < 0) {
        toast.error('سعر الوحدة يجب أن يكون صفرًا أو أكثر');
        return;
      }
      validItems.push({
        material_id: item.material_id,
        quantity: qty,
        unit_price: price,
        total: qty * price,
      });
    }

    setLoading(true);

    try {
      // 1. Insert Purchase Header
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .insert([
          {
            project_id: project.id,
            request_id: form.request_id || null,
            purchase_number: form.purchase_number.trim(),
            supplier_id: form.supplier_id,
            date: form.date,
            invoice_number: form.invoice_number.trim() || null,
            subtotal,
            discount: discountVal,
            tax: taxVal,
            transport_cost: transportVal,
            total,
            notes: form.notes.trim() || null,
            receipt_status: 'UNRECEIVED',
          },
        ])
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // 2. Insert Purchase Items
      const purchaseItemsPayload = validItems.map((item) => ({
        purchase_id: purchaseData.id,
        material_id: item.material_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        received_quantity: 0,
      }));

      const { error: itemsError } = await supabase.from('purchase_items').insert(purchaseItemsPayload);

      if (itemsError) {
        // Rollback purchase header
        await supabase.from('purchases').delete().eq('id', purchaseData.id);
        throw itemsError;
      }

      // 3. Update related purchase request status if applicable
      if (form.request_id) {
        await supabase.from('purchase_requests').update({ status: 'PURCHASED' }).eq('id', form.request_id);
      }

      toast.success(`تم إنشاء امر الشراء بنجاح (${purchaseData.purchase_number})`);
      navigate(`/purchases/${purchaseData.id}`);
    } catch (err: any) {
      toast.error(parseSupabaseError(err, 'حدث خطأ أثناء حفظ امر الشراء'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">إنشاء أمر شراء وتوريد جديد</h1>
          <p className="text-xs text-slate-500">
            {request ? `تحويل من طلب شراء: ${request.request_number}` : 'توثيق عقد شراء أو فواتير توريد موقعية'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Header Metadata */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">البيانات الأساسية للطلب</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">رقم أمر الشراء *</label>
              <input
                type="text"
                required
                value={form.purchase_number}
                onChange={(e) => setForm({ ...form, purchase_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">تاريخ أمر الشراء *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">اختر المورد *</label>
              <select
                required
                value={form.supplier_id}
                onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              >
                <option value="">اختر مورد...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.company ? `(${s.company})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">رقم فاتورة المورد (إن وجد)</label>
              <input
                type="text"
                placeholder="مثال: INV-9901"
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Materials & Unit Prices */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">بنود التوريد والأسعار</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
            >
              <Plus className="w-4 h-4" /> إضافة مادة أخرى
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const selectedMat = materials.find((m) => m.id === item.material_id);
              const q = Number(item.quantity) || 0;
              const p = Number(item.unit_price) || 0;
              const itemTotal = q * p;

              return (
                <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-3 items-end">
                  <div className="w-full sm:w-2/5">
                    <label className="block text-xs text-slate-600 mb-1">المادة *</label>
                    <select
                      required
                      value={item.material_id}
                      onChange={(e) => {
                        const next = [...items];
                        next[index].material_id = e.target.value;
                        setItems(next);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    >
                      <option value="">اختر مادة...</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-1/5">
                    <label className="block text-xs text-slate-600 mb-1">الكمية *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={item.quantity}
                      onChange={(e) => {
                        const next = [...items];
                        next[index].quantity = e.target.value;
                        setItems(next);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="w-full sm:w-1/5">
                    <label className="block text-xs text-slate-600 mb-1">سعر الوحدة ({currency}) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={item.unit_price}
                      onChange={(e) => {
                        const next = [...items];
                        next[index].unit_price = e.target.value;
                        setItems(next);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="w-full sm:w-1/5 text-left py-2 px-2 bg-white rounded-lg border border-slate-200">
                    <span className="text-[11px] text-slate-400 block">الإجمالي:</span>
                    <span className="text-xs font-bold text-slate-900">{formatCurrency(itemTotal, currency)}</span>
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Financial Summary & Notes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات أمر الشراء</label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="تفاصيل التوريد أو الدفع..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              ></textarea>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">المجموع الفرعي:</span>
                <span className="font-bold text-slate-900">{formatCurrency(subtotal, currency)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">خصم:</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: e.target.value })}
                  className="w-28 px-2 py-1 border border-slate-300 rounded-lg text-left text-xs bg-white"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">ضريبة:</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.tax}
                  onChange={(e) => setForm({ ...form, tax: e.target.value })}
                  className="w-28 px-2 py-1 border border-slate-300 rounded-lg text-left text-xs bg-white"
                />
              </div>

              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-slate-600">مصاريف نقل وتفريغ:</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.transport_cost}
                  onChange={(e) => setForm({ ...form, transport_cost: e.target.value })}
                  className="w-28 px-2 py-1 border border-slate-300 rounded-lg text-left text-xs bg-white"
                />
              </div>

              <div className="flex justify-between text-sm font-bold text-sky-700 pt-1">
                <span>الإجمالي النهائي:</span>
                <span>{formatCurrency(total, currency)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'جاري الحفظ...' : 'حفظ أمر الشراء'}
          </button>
        </div>
      </form>
    </div>
  );
}
