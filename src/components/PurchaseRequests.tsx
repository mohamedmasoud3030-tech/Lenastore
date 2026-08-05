import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { Plus, FileText, ArrowLeftRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PurchaseRequests() {
  const { project } = useProject();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!supabase || !project) return;
    try {
      const { data, error } = await supabase
        .from('purchase_requests')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRequests(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [project]);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">طلبات الشراء</h2>
          <p className="mt-1 text-sm text-gray-500">إدارة طلبات توفير المواد.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            to="/requests/new"
            className="inline-flex items-center gap-2 justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={20} />
            طلب جديد
          </Link>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {loading ? (
            <li className="px-4 py-8 text-center text-gray-500">جاري التحميل...</li>
          ) : requests.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500">لا توجد طلبات شراء.</li>
          ) : (
            requests.map((req) => {
              return (
                <li key={req.id} className="hover:bg-gray-50">
                  <Link to={`/requests/${req.id}`} className="block px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="text-gray-400 h-6 w-6" />
                        <div>
                          <p className="text-sm font-bold text-blue-600">{req.request_number}</p>
                          <p className="text-xs text-gray-500">{req.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          req.status === 'PURCHASED' ? 'bg-green-100 text-green-800' :
                          req.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                          req.status === 'PURCHASING' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {req.status === 'DRAFT' ? 'مسودة' : req.status === 'REQUESTED' ? 'مطلوب' : req.status === 'PURCHASING' ? 'جاري الشراء' : req.status === 'PURCHASED' ? 'تم الشراء' : 'ملغي'}
                        </p>
                         <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          req.priority === 'URGENT' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {req.priority === 'URGENT' ? 'عاجل' : 'عادي'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500 truncate">
                      السبب: {req.reason || 'بدون'}
                    </div>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
