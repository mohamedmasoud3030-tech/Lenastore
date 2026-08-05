import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useNavigate } from 'react-router-dom';
import { Save, X, Plus, Trash2 } from 'lucide-react';

export default function CreatePurchaseRequest() {
  const { project } = useProject();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    request_number: `PR-${Math.floor(Math.random() * 10000)}`,
    date: new Date().toISOString().split('T')[0],
    reason: '',
    priority: 'NORMAL',
    needed_date: '',
    notes: ''
  });

  const [items, setItems] = useState<any[]>([{ material_id: '', quantity: 1 }]);

  useEffect(() => {
    if (!supabase || !project) return;
    const fetchData = async () => {
      const { data } = await supabase.from('materials').select('*').eq('project_id', project.id);
      setMaterials(data || []);
    };
    fetchData();
  }, [project]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;
    
    if (items.some(i => !i.material_id || i.quantity <= 0)) {
      alert('يرجى التحقق من بيانات المواد المدخلة');
      return;
    }

    setLoading(true);
    try {
      const { data: requestData, error: reqError } = await supabase.from('purchase_requests').insert([{
        project_id: project.id,
        request_number: form.request_number,
        date: form.date,
        reason: form.reason,
        priority: form.priority,
        needed_date: form.needed_date || null,
        notes: form.notes,
        status: 'REQUESTED'
      }]).select().single();

      if (reqError) throw reqError;

      const requestItems = items.map(item => ({
        request_id: requestData.id,
        material_id: item.material_id,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabase.from('purchase_request_items').insert(requestItems);
      if (itemsError) throw itemsError;

      navigate(`/requests/${requestData.id}`);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">طلب شراء جديد</h2>
        <button type="button" onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">البيانات الأساسية</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">رقم الطلب</label>
              <input type="text" required value={form.request_number} onChange={e => setForm({...form, request_number: e.target.value})}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">تاريخ الطلب</label>
              <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">تاريخ الاحتياج</label>
              <input type="date" value={form.needed_date} onChange={e => setForm({...form, needed_date: e.target.value})}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none" />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700">الأولوية</label>
              <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none">
                <option value="NORMAL">عادي</option>
                <option value="URGENT">عاجل</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">سبب الطلب / الغرض</label>
              <input type="text" required value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">المواد المطلوبة</h3>
            <button type="button" onClick={() => setItems([...items, { material_id: '', quantity: 1 }])}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus size={16} /> إضافة مادة
            </button>
          </div>
          
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-gray-50 p-3 rounded-md border border-gray-200">
                <div className="w-full sm:w-1/2">
                  <select required value={item.material_id} onChange={e => {
                      const newItems = [...items];
                      newItems[index].material_id = e.target.value;
                      setItems(newItems);
                    }}
                    className="block w-full rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:border-blue-500 focus:outline-none">
                    <option value="">المادة...</option>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="w-full sm:w-1/3 flex gap-2">
                  <div className="w-full">
                    <input type="number" required min="0.01" step="0.01" placeholder="الكمية" value={item.quantity} onChange={e => {
                        const newItems = [...items];
                        newItems[index].quantity = e.target.value;
                        setItems(newItems);
                      }}
                      className="block w-full rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                </div>
                <div className="w-full sm:w-1/6 flex items-center justify-end gap-3">
                  <button type="button" onClick={() => {
                      if (items.length > 1) {
                        setItems(items.filter((_, i) => i !== index));
                      }
                    }} className="text-red-500 hover:text-red-700">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
             <div>
                <label className="block text-sm font-medium text-gray-700">ملاحظات إضافية</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none"></textarea>
              </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            إلغاء
          </button>
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            <Save size={18} />
            {loading ? 'جاري الحفظ...' : 'حفظ الطلب'}
          </button>
        </div>
      </form>
    </div>
  );
}
