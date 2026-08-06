import React, { useState } from 'react';
import { ArrowLeft, BadgeDollarSign, Building2, CalendarDays, Landmark, MapPin, Phone, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useProject } from '../lib/ProjectContext';
import BRAND from '../config/brand';
import BrandMark from './BrandMark';

const fieldClass = 'enterprise-field min-h-11';

function translateProjectError(message: string): string {
  if (message.includes('projects_user_id_key')) return 'المشروع مسجل بالفعل. سيتم تحميل بياناته الحالية.';
  if (message.includes('duplicate key')) return 'توجد بيانات مكررة. راجع القيم المدخلة.';
  if (message.includes('permission') || message.includes('unauthorized')) return 'لا تملك صلاحية تنفيذ هذه العملية.';
  return 'تعذر حفظ بيانات المشروع. راجع البيانات والاتصال ثم حاول مرة أخرى.';
}

export default function ProjectSetup() {
  const { user } = useAuth();
  const { refreshProject } = useProject();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [manager, setManager] = useState('');
  const [phone, setPhone] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [owner, setOwner] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || loading) return;

    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase.from('projects').insert([
        {
          name: name.trim(),
          location: location.trim(),
          manager_name: manager.trim(),
          phone: phone.trim() || null,
          start_date: startDate,
          owner_name: owner.trim() || null,
          currency,
          user_id: user.id,
        },
      ]);

      if (insertError) throw insertError;
      await refreshProject();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '';
      console.error('Project setup failed', submitError);
      setError(translateProjectError(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 sm:py-8" dir="rtl">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <BrandMark />
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="project-setup-title">
          <div className="mb-6 border-b border-slate-100 pb-5">
            <h1 id="project-setup-title" className="text-2xl font-black text-slate-950">إعداد المشروع</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              أدخل البيانات التي ستظهر في أوامر الشراء وسندات المخزون وتقارير {BRAND.fullName}.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="project-name" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Building2 size={17} className="text-sky-800" />
                  اسم المشروع الرسمي
                </label>
                <input
                  id="project-name"
                  type="text"
                  required
                  autoFocus
                  placeholder="مثال: مشروع المجمع السكني"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="project-location" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <MapPin size={17} className="text-sky-800" />
                  موقع المشروع
                </label>
                <input
                  id="project-location"
                  type="text"
                  required
                  placeholder="المدينة، المنطقة"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="project-owner" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Landmark size={17} className="text-sky-800" />
                  الجهة المالكة / العميل
                </label>
                <input
                  id="project-owner"
                  type="text"
                  placeholder="اسم الشركة أو الجهة المالكة"
                  value={owner}
                  onChange={(event) => setOwner(event.target.value)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="project-manager" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <UserRound size={17} className="text-sky-800" />
                  المسؤول عن النظام
                </label>
                <input
                  id="project-manager"
                  type="text"
                  required
                  placeholder="الاسم الكامل"
                  value={manager}
                  onChange={(event) => setManager(event.target.value)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="project-phone" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Phone size={17} className="text-sky-800" />
                  رقم التواصل
                </label>
                <input
                  id="project-phone"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  placeholder="+20 000 000 0000"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className={`${fieldClass} text-left`}
                />
              </div>

              <div>
                <label htmlFor="project-start-date" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <CalendarDays size={17} className="text-sky-800" />
                  تاريخ بداية المشروع
                </label>
                <input
                  id="project-start-date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="project-currency" className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <BadgeDollarSign size={17} className="text-sky-800" />
                  العملة الأساسية
                </label>
                <select
                  id="project-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className={fieldClass}
                >
                  <option value="EGP">جنيه مصري — EGP</option>
                  <option value="SAR">ريال سعودي — SAR</option>
                  <option value="OMR">ريال عُماني — OMR</option>
                  <option value="AED">درهم إماراتي — AED</option>
                  <option value="USD">دولار أمريكي — USD</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-h-11 w-full items-center justify-center gap-3 rounded-xl bg-slate-950 px-6 py-3 text-sm font-extrabold text-white transition hover:bg-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loading ? 'جاري الحفظ...' : 'حفظ المشروع والبدء'}
                {!loading && <ArrowLeft size={18} aria-hidden="true" />}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
