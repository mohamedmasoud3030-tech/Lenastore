import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useProject } from '../lib/ProjectContext';
import { Building2 } from 'lucide-react';

export default function ProjectSetup() {
  const { user } = useAuth();
  const { refreshProject } = useProject();
  
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [manager, setManager] = useState('');
  const [phone, setPhone] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [owner, setOwner] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user) return;
    
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.from('projects').insert([
        {
          name,
          location,
          manager_name: manager,
          phone,
          start_date: startDate,
          owner_name: owner,
          user_id: user.id
        }
      ]);
      
      if (error) throw error;
      
      await refreshProject(); // This will trigger the app to move past the setup screen
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ بيانات المشروع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          <Building2 size={48} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          إعداد المشروع
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          يبدو أنك لم تقم بإعداد مشروع بعد. أدخل بيانات المشروع للبدء.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md lg:max-w-xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">اسم المشروع</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">موقع المشروع</label>
              <input type="text" required value={location} onChange={(e) => setLocation(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">اسم المسؤول</label>
                <input type="text" required value={manager} onChange={(e) => setManager(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">رقم الهاتف</label>
                <input type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">تاريخ البداية</label>
                <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">اسم المالك / المقاول</label>
                <input type="text" value={owner} onChange={(e) => setOwner(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'جاري الحفظ...' : 'حفظ المشروع والبدء'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
