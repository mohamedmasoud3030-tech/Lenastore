import React, { useState } from 'react';
import { saveSupabaseConfig } from '../lib/supabase';
import { Database } from 'lucide-react';

export default function SupabaseSetup() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && key) {
      saveSupabaseConfig(url, key);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-blue-600">
          <Database size={48} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          إعداد قاعدة البيانات
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          الرجاء إدخال بيانات اتصال Supabase الخاصة بك للبدء
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700">
                Supabase URL
              </label>
              <div className="mt-1">
                <input
                  id="url"
                  name="url"
                  type="url"
                  required
                  dir="ltr"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="https://xxxx.supabase.co"
                />
              </div>
            </div>

            <div>
              <label htmlFor="key" className="block text-sm font-medium text-gray-700">
                Supabase Anon Key
              </label>
              <div className="mt-1">
                <input
                  id="key"
                  name="key"
                  type="password"
                  required
                  dir="ltr"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                حفظ وبدء الاستخدام
              </button>
            </div>
          </form>
          
          <div className="mt-6 text-sm text-gray-500">
            <h4 className="font-semibold mb-2">تعليمات الإعداد:</h4>
            <ul className="list-disc ps-5 space-y-1">
              <li>قم بإنشاء مشروع جديد في <a href="https://supabase.com" target="_blank" className="text-blue-600">Supabase</a></li>
              <li>انسخ ملف <code>supabase/schema.sql</code> وقم بتشغيله في SQL Editor داخل مشروعك.</li>
              <li>انسخ URL و Anon Key والصقها هنا.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
