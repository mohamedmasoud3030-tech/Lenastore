import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useNavigate } from 'react-router-dom';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { useToast } from './common/ToastProvider';
import { PageHeader } from './common/PageHeader';
import { Material } from '../types';
import { Save, Plus, Trash2, FileText } from 'lucide-react';

interface RequestItemInput {
  material_id: string;
  quantity: string;
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
  return `request-${randomPart}`;
}

export default function CreatePurchaseRequest() {
  const { project } = useProject();
  const navigate = useNavigate();
  const toast = useToast();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [submissionAttempt, setSubmissionAttempt] = useState<SubmissionAttempt | null>(null);

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
          .select('id, project_id, name, category, unit, min_stock, notes, created_at, updated_at')
          .eq('project_id', project.id)
          .order('name');
        if (error) throw error;
        setMaterials((data as Material[]) || []);
      } catch (error) {
        console.error(error);
        toast.error(parseSupabaseError(error, 'تعذر تحميل قائمة المواد'));
      }
    };
    void fetchMaterials();
  }, [project, toast]);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { material_id: '', quantity: '1' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !project) return;

    if (!form.reason.trim()) {
      toast.error('يرجى كتابة سبب أو غرض الطلب');
      return;
    }

    const validItems: { material_id: string; quantity: number }[] = [];
    for (const item of items) {
      if (!item.material_id) {
        toast.error('يرجى اختيار المادة لكل البنود');
        return;
      }
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error('الكمية المطلوبة يجب أن تكون أكبر من صفر');
        return;
      }
      validItems.push({ material_id: item.material_id, quantity });
    }

    const payload = {
      p_project_id: project.id,
      p_request_number: form.request_number.trim(),
      p_request_date: form.date,
      p_reason: form.reason.trim(),
      p_priority: form.priority,
      p_needed_date: form.needed_date || null,
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
      const { data: requestId, error } = await supabase.rpc('create_purchase_request_atomic', {
        ...payload,
        p_idempotency_key: attempt.key,
      });
      if (error) throw error;
      if (!requestId) throw new Error('لم تُرجع قاعدة البيانات رقم طلب الشراء');

      setSubmissionAttempt(null);
      toast.success(`تم إنشاء طلب الشراء بنجاح (${form.request_number.trim()})`);
      navigate(`/requests/${requestId}`);
    } catch (error) {
      toast.error(parseSupabaseError(error, 'حدث خطأ أثناء حفظ طلب الشراء'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="إنشاء طلب شراء موقعي جديد"
        description="توثيق احتياج الأعمال الهندسية من مواد وتوريدات"
        onBack={() => navigate(-1)}
        icon={FileText}
      />

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-3">البيانات الأساسية للطلب</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">رقم الطلب *</label>
              <input
                type="text"
                required
                value={form.request_number}
                onChange={(e) => setForm({ ...form, request_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">تاريخ الطلب *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">تاريخ الاحتياج بالموقع</label>
              <input
                type="date"
                value={form.needed_date}
                onChange={(e) => setForm({ ...form, needed_date: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">الأولوية *</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as 'NORMAL' | 'URGENT' })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              >
                <option value="NORMAL">عادي (اعتيادي)</option>
                <option value="URGENT">عاجل جداً (توقف أعمال)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">سبب الطلب / الغرض *</label>
              <input
                type="text"
                required
                placeholder="مثال: توريد أسمنت صبة سقف الدور الأول"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">المواد المطلوبة</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700"
            >
              <Plus className="w-4 h-4" /> إضافة مادة أخرى
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const selectedMaterial = materials.find((material) => material.id === item.material_id);
              return (
                <div key={index} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row gap-3 items-end">
                  <div className="w-full sm:flex-1">
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">اختر المادة *</label>
                    <select
                      required
                      value={item.material_id}
                      onChange={(e) => {
                        const next = [...items];
                        next[index].material_id = e.target.value;
                        setItems(next);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    >
                      <option value="">اختر مادة من الكتالوج...</option>
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.name} ({material.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full sm:w-36">
                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">الكمية المطلوبة *</label>
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
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>

                  {selectedMaterial && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 py-2 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap">
                      الوحدة: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedMaterial.unit}</span>
                    </div>
                  )}

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
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

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ملاحظات إضافية</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="أية شروط أو ملاحظات تسليم موقعية..."
            className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
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
