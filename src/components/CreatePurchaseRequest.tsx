import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useNavigate } from 'react-router-dom';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { useToast } from './common/ToastProvider';
import { PageHeader } from './common/PageHeader';
import { Material } from '../types';
import { Save, X, Plus, Trash2, ArrowRight, FileText } from 'lucide-react';

interface RequestItemInput {
  material_id: string;
  quantity: string;
}

export default function CreatePurchaseRequest() {
  const { project } = useProject();
  const navigate = useNavigate();
  const toast = useToast();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    request_number: `PR-${Date.now().toString().slice(-5)}`,
    date: new Date().toISOString().split('T')[0],
    reason: '',
    priority: 'NORMAL' as 'NORMAL' | 'URGENT',
    needed_date: '',
    notes: '',
  });

  const [items, setItems] = useState<RequestItemInput[]>([{ material_id: '', quantity: '1' }]);

  useEffect(() => {
    if (!supabase || !project) return;
    const fetchMaterials = async () => {
      try {
        const { data, error } = await supabase
          .from('materials')
          .select('*')
          .eq('project_id', project.id)
          .order('name');
        if (!error && data) {
          setMaterials(data as Material[]);
        }
      } catch (e) {
        console.error(e);
      }
    };
    void fetchMaterials();
  }, [project]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { material_id: '', quantity: '1' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;

    if (!form.reason.trim()) {
      toast.error('يرجى كتابة سبب أو غرض الطلب');
      return;
    }

    const validItems = [];
    for (const item of items) {
      if (!item.material_id) {
        toast.error('يرجى اختيار المادة لكل البنود');
        return;
      }
      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        toast.error('الكمية المطلوبة يجب أن تكون أكبر من صفر');
        return;
      }
      validItems.push({
        material_id: item.material_id,
        quantity: qty,
      });
    }

    setLoading(true);

    try {
      // 1. Create Purchase Request header
      const { data: requestData, error: reqError } = await supabase
        .from('purchase_requests')
        .insert([
          {
            project_id: project.id,
            request_number: form.request_number.trim(),
            date: form.date,
            reason: form.reason.trim(),
            priority: form.priority,
            needed_date: form.needed_date || null,
            notes: form.notes.trim() || null,
            status: 'REQUESTED',
          },
        ])
        .select()
        .single();

      if (reqError) throw reqError;

      // 2. Create Purchase Request items
      const requestItems = validItems.map((item) => ({
        request_id: requestData.id,
        material_id: item.material_id,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase.from('purchase_request_items').insert(requestItems);

      if (itemsError) {
        // Rollback request header if items insertion failed
        await supabase.from('purchase_requests').delete().eq('id', requestData.id);
        throw itemsError;
      }

      toast.success(`تم إنشاء طلب الشراء بنجاح (${requestData.request_number})`);
      navigate(`/requests/${requestData.id}`);
    } catch (err: any) {
      toast.error(parseSupabaseError(err, 'حدث خطأ أثناء حفظ طلب الشراء'));
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">إنشاء طلب شراء موقعي جديد</h1>
          <p className="text-xs text-slate-500">توثيق احتياج الأعمال الهندسية من مواد وتوريدات</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">البيانات الأساسية للطلب</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">رقم الطلب *</label>
              <input
                type="text"
                required
                value={form.request_number}
                onChange={(e) => setForm({ ...form, request_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">تاريخ الطلب *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">تاريخ الاحتياج بالموقع</label>
              <input
                type="date"
                value={form.needed_date}
                onChange={(e) => setForm({ ...form, needed_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">الأولوية *</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              >
                <option value="NORMAL">عادي (اعتيادي)</option>
                <option value="URGENT">عاجل جداً (توقف أعمال)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">سبب الطلب / الغرض *</label>
              <input
                type="text"
                required
                placeholder="مثال: توريد أسمنت صبة صقف الدور الأول"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Required Materials */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">المواد المطلوبة</h3>
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
              return (
                <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row gap-3 items-end">
                  <div className="w-full sm:flex-1">
                    <label className="block text-xs text-slate-600 mb-1">اختر المادة *</label>
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
                      <option value="">اختر مادة من الكتالوج...</option>
                      {materials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-36">
                    <label className="block text-xs text-slate-600 mb-1">الكمية المطلوبة *</label>
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

                  {selectedMat && (
                    <div className="text-xs text-slate-500 py-2 px-3 bg-white border border-slate-200 rounded-lg whitespace-nowrap">
                      الوحدة: <span className="font-bold text-slate-900">{selectedMat.unit}</span>
                    </div>
                  )}

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

        {/* Notes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <label className="block text-xs font-semibold text-slate-700 mb-1">ملاحظات إضافية</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="أية شروط أو ملاحظات تسليم موقعية..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          ></textarea>
        </div>

        {/* Submit Bar */}
        <div className="flex justify-end gap-3 pt-2">
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
            {loading ? 'جاري حفظ الطلب...' : 'حفظ وإرسال الطلب'}
          </button>
        </div>
      </form>
    </div>
  );
}
