import React, { useState } from 'react';
import {
  ArrowLeft,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CheckCircle2,
  Landmark,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useProject } from '../lib/ProjectContext';
import BrandMark from './BrandMark';

const fieldClass = 'enterprise-field';

export default function ProjectSetup() {
  const { user } = useAuth();
  const { refreshProject } = useProject();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [manager, setManager] = useState('');
  const [phone, setPhone] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [owner, setOwner] = useState('');
  const [currency, setCurrency] = useState('OMR');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

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
      setError(message || 'تعذر حفظ بيانات المشروع. راجع البيانات وحاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-5 sm:px-7 sm:py-8 lg:px-10" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between rounded-3xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm sm:px-7">
          <BrandMark />
          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 sm:flex">
            <ShieldCheck size={16} />
            مساحة عمل خاصة وآمنة
          </div>
        </header>

        <div className="grid overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.09)] lg:grid-cols-[21rem_minmax(0,1fr)]">
          <aside className="relative overflow-hidden bg-slate-950 p-7 text-white sm:p-9">
            <div className="absolute -left-16 -top-16 h-52 w-52 rounded-full bg-sky-700/20 blur-2xl" />
            <div className="absolute -bottom-16 -right-16 h-52 w-52 rounded-full bg-amber-400/15 blur-2xl" />

            <div className="relative">
              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold text-amber-300">
                تهيئة مساحة العمل
              </span>
              <h1 className="mt-5 text-3xl font-black leading-[1.45]">عرّف مشروعك مرة واحدة</h1>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                ستظهر هذه البيانات في لوحة التحكم، أوامر الشراء، مستندات الاستلام والتقارير التشغيلية.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  'بيانات موحدة لكل المستندات',
                  'عملة افتراضية للمشتريات والمدفوعات',
                  'إمكانية التوسع لاحقًا لمشروعات ومستخدمين إضافيين',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-200">
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-amber-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <p className="text-xs font-bold text-slate-400">حالة الإعداد</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-1/2 rounded-full bg-amber-400" />
                  </div>
                  <span className="text-xs font-extrabold text-amber-300">50%</span>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-400">بعد الحفظ ستنتقل مباشرة إلى لوحة المشروع.</p>
              </div>
            </div>
          </aside>

          <section className="p-5 sm:p-8 lg:p-10">
            <div className="mb-8 border-b border-slate-100 pb-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-sky-800">Project profile</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">بيانات المشروع الأساسية</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">أدخل البيانات الرسمية التي ستستخدم في المستندات والتقارير.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-7">
              {error && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label htmlFor="project-name" className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
                    <Building2 size={17} className="text-sky-800" />
                    اسم المشروع الرسمي
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    required
                    autoFocus
                    placeholder="مثال: مشروع المجمع السكني المتكامل"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="project-location" className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
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
                  <label htmlFor="project-owner" className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
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
                  <label htmlFor="project-manager" className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
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
                  <label htmlFor="project-phone" className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
                    <Phone size={17} className="text-sky-800" />
                    رقم التواصل
                  </label>
                  <input
                    id="project-phone"
                    type="tel"
                    inputMode="tel"
                    dir="ltr"
                    placeholder="+968 0000 0000"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={`${fieldClass} text-left`}
                  />
                </div>

                <div>
                  <label htmlFor="project-start-date" className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
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
                  <label htmlFor="project-currency" className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-700">
                    <BadgeDollarSign size={17} className="text-sky-800" />
                    العملة الأساسية
                  </label>
                  <select
                    id="project-currency"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="OMR">ريال عُماني — OMR</option>
                    <option value="SAR">ريال سعودي — SAR</option>
                    <option value="AED">درهم إماراتي — AED</option>
                    <option value="EGP">جنيه مصري — EGP</option>
                    <option value="USD">دولار أمريكي — USD</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-lg text-xs leading-6 text-slate-400">
                  يمكنك تعديل البيانات التشغيلية لاحقًا من إعدادات المشروع عند إضافة وحدة الإعدادات.
                </p>
                <button
                  type="submit"
                  disabled={loading}
                  className="group inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl bg-slate-950 px-7 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {loading ? 'جاري إنشاء مساحة العمل...' : 'حفظ المشروع والبدء'}
                  {!loading && <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
