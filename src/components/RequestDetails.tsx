import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ShoppingCart, CheckCircle } from 'lucide-react';
import Attachments from './Attachments';

export default function RequestDetails() {
  const { id } = useParams<{ id: string }>();
  const { project } = useProject();
  const navigate = useNavigate();
  
  const [request, setRequest] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!supabase || !project || !id) return;
    try {
      const [reqRes, itemsRes] = await Promise.all([
        supabase.from('purchase_requests').select('*').eq('id', id).single(),
        supabase.from('purchase_request_items').select('*, materials(name, unit)').eq('request_id', id)
      ]);
      setRequest(reqRes.data);
      setItems(itemsRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, project]);

  const handleConvertToPurchase = () => {
    navigate('/purchases/new', { state: { request, items } });
  };

  if (loading) return <div className="p-8 text-center text-gray-500">جاري التحميل...</div>;
  if (!request) return <div className="p-8 text-center text-red-500">لم يتم العثور على الطلب</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-200">
          <ArrowRight size={20} className="text-gray-600" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            طلب شراء: <span className="text-blue-600" dir="ltr">{request.request_number}</span>
          </h2>
          <p className="text-sm text-gray-500">التاريخ: {request.date}</p>
        </div>
        
        <div className="ms-auto flex gap-2">
            {request.status !== 'PURCHASED' && request.status !== 'CANCELLED' && (
                <button onClick={handleConvertToPurchase} className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                    <ShoppingCart size={18} />
                    تحويل إلى أمر شراء
                </button>
            )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
         <div className="p-5 border-b border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-gray-500">الحالة</p><p className="font-medium text-gray-900">{request.status}</p></div>
                <div><p className="text-gray-500">الأولوية</p><p className="font-medium text-gray-900">{request.priority}</p></div>
                <div><p className="text-gray-500">تاريخ الاحتياج</p><p className="font-medium text-gray-900">{request.needed_date || '-'}</p></div>
                <div><p className="text-gray-500">السبب</p><p className="font-medium text-gray-900">{request.reason}</p></div>
            </div>
         </div>
        
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">المواد المطلوبة</h3>
          <ul className="divide-y divide-gray-200 border rounded-md">
            {items.map((item) => (
              <li key={item.id} className="px-4 py-3 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900">{item.materials?.name}</span>
                <span className="text-sm text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded-full">
                  {item.quantity} {item.materials?.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <Attachments entityType="PURCHASE_REQUEST" entityId={request.id} />
    </div>
  );
}
