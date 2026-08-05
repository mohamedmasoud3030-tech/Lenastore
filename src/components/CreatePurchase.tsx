import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Save, X, Plus, Trash2 } from 'lucide-react';

export default function CreatePurchase() {
  const { project } = useProject();
  const navigate = useNavigate();
  const location = useLocation();
  const { request, items: requestItems } = location.state || {};
  
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    purchase_number: `PUR-${Math.floor(Math.random() * 10000)}`,
    supplier_id: '',
    date: new Date().toISOString().split('T')[0],
    discount: 0,
    tax: 0,
    transport_cost: 0,
    notes: '',
    request_id: request?.id || null
  });

  const initialItems = requestItems 
    ? requestItems.map((ri: any) => ({ material_id: ri.material_id, quantity: ri.quantity, unit_price: 0 }))
    : [{ material_id: '', quantity: 1, unit_price: 0 }];

  const [items, setItems] = useState<any[]>(initialItems);

  useEffect(() => {
    if (!supabase || !project) return;
    const fetchData = async () => {
      const [supRes, matRes] = await Promise.all([
        supabase.from('suppliers').select('*').eq('project_id', project.id),
        supabase.from('materials').select('*').eq('project_id', project.id)
      ]);
      setSuppliers(supRes.data || []);
      setMaterials(matRes.data || []);
    };
    fetchData();
  }, [project]);

  const subtotal = items.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unit_price)), 0);
  const total = subtotal - Number(form.discount) + Number(form.tax) + Number(form.transport_cost);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !project) return;
    
    if (items.some(i => !i.material_id || i.quantity <= 0 || i.unit_price < 0)) {
      alert('يرجى التحقق من بيانات المواد المدخلة');
      return;
    }

    setLoading(true);
    try {
      const { data: purchaseData, error: purchaseError } = await supabase.from('purchases').insert([{
        project_id: project.id,
        request_id: form.request_id,
        purchase_number: form.purchase_number,
        supplier_id: form.supplier_id,
        date: form.date,
        subtotal,
        discount: form.discount,
        tax: form.tax,
        transport_cost: form.transport_cost,
        total,
        notes: form.notes,
        receipt_status: 'UNRECEIVED'
      }]).select().single();

      if (purchaseError) throw purchaseError;

      const purchaseItems = items.map(item => ({
        purchase_id: purchaseData.id,
        material_id: item.material_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: Number(item.quantity) * Number(item.unit_price),
        received_quantity: 0
      }));

      const { error: itemsError } = await supabase.from('purchase_items').insert(purchaseItems);
      if (itemsError) throw itemsError;
      
      if (form.request_id) {
          await supabase.from('purchase_requests').update({ status: 'PURCHASED' }).eq('id', form.request_id);
      }

      navigate(`/purchases/${purchaseData.id}`);
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء حفظ عملية الشراء');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">شراء جديد</h2>
        <button type="button" onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700">
          <X size={24} />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">البيانات الأساسية</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">رقم الشراء</label>
              <input type="text" required value={form.purchase_number} onChange={e => setForm({...form, purchase_number: e.target.value})}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">التاريخ</label>
              <input type="date" required value={form.date} onChange={e => setForm({...form, date: e.target.value})}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">المورد</label>
              <select required value={form.supplier_id} onChange={e => setForm({...form, supplier_id: e.target.value})}
                className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none">
                <option value="">اختر المورد...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">المواد</h3>
            <button type="button" onClick={() => setItems([...items, { material_id: '', quantity: 1, unit_price: 0 }])}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus size={16} /> إضافة مادة
            </button>
          </div>
          
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-gray-50 p-3 rounded-md border border-gray-200">
                <div className="w-full sm:w-1/3">
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
                <div className="w-full sm:w-1/5 flex gap-2">
                  <div className="w-full">
                    <input type="number" required min="0.01" step="0.01" placeholder="الكمية" value={item.quantity} onChange={e => {
                        const newItems = [...items];
                        newItems[index].quantity = e.target.value;
                        setItems(newItems);
                      }}
                      className="block w-full rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                </div>
                <div className="w-full sm:w-1/4 flex gap-2">
                  <div className="w-full relative">
                    <input type="number" required min="0" step="0.01" placeholder="السعر" value={item.unit_price} onChange={e => {
                        const newItems = [...items];
                        newItems[index].unit_price = e.target.value;
                        setItems(newItems);
                      }}
                      className="block w-full rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                </div>
                <div className="w-full sm:w-1/6 flex items-center justify-between sm:justify-end gap-3">
                  <span className="text-sm font-bold w-full text-left" dir="ltr">{(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</span>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">ملاحظات الشراء</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                  className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-blue-500 focus:outline-none"></textarea>
              </div>
            </div>
            
            <div className="space-y-3 bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">المجموع الفرعي:</span>
                <span className="font-bold">{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">خصم:</span>
                <input type="number" min="0" step="0.01" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})}
                  className="w-24 rounded border border-gray-300 py-1 px-2 text-right text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">ضريبة:</span>
                <input type="number" min="0" step="0.01" value={form.tax} onChange={e => setForm({...form, tax: e.target.value})}
                  className="w-24 rounded border border-gray-300 py-1 px-2 text-right text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="flex justify-between items-center text-sm border-b border-gray-200 pb-2">
                <span className="text-gray-600">نقل / مصاريف:</span>
                <input type="number" min="0" step="0.01" value={form.transport_cost} onChange={e => setForm({...form, transport_cost: e.target.value})}
                  className="w-24 rounded border border-gray-300 py-1 px-2 text-right text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="flex justify-between text-lg font-bold text-blue-700 pt-2">
                <span>الإجمالي النهائي:</span>
                <span>{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            إلغاء
          </button>
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
            <Save size={18} />
            {loading ? 'جاري الحفظ...' : 'حفظ الشراء'}
          </button>
        </div>
      </form>
    </div>
  );
}
