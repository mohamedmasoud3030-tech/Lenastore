import React, { useState } from 'react';
import {
  ArrowLeft,
  Boxes3,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import BrandMark from './BrandMark';

const translateAuthError = (message: string) => {
  if (message.includes('Invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (message.includes('Email not confirmed')) return 'البريد الإلكتروني غير مؤكّد بعد.';
  if (message.includes('Password should be')) return 'كلمة المرور يجب ألا تقل عن 6 أحرف.';
  if (message.includes('User already registered')) return 'هذا البريد مسجل بالفعل.';
  return message || 'تعذر إكمال العملية. حاول مرة أخرى.';
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [notice, setNotice] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setNotice('تم إنشاء الحساب. سجّل الدخول للمتابعة.');
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : '';
      setError(translateAuthError(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(32rem,0.78fr)]" dir="rtl">
      <section className="relative hidden overflow-hidden border-l border-white/10 bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(245,158,11,0.18),transparent_23rem),radial-gradient(circle_at_75%_80%,rgba(14,116,144,0.28),transparent_30rem)]" />
        <div className="absolute -left-24 top-20 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute -left-8 top-36 h-48 w-48 rounded-full border border-white/10" />

        <div className="relative z-10">
          <BrandMark inverse />
        </div>

        <div className="relative z-10 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-bold text-amber-200">
            <ShieldCheck size={15} />
            تشغيل منضبط للمشتريات والمخزون
          </span>
          <h1 className="mt-7 text-4xl font-black leading-[1.45] tracking-tight xl:text-5xl">
            رؤية واضحة للمواد
            <br />
            من الطلب حتى موقع التنفيذ
          </h1>
          <p className="mt-5 max-w-lg text-base leading-8 text-slate-300">
            منصة عربية موحدة لمتابعة طلبات الشراء، أوامر التوريد، الاستلام، حركة المخزون، الموردين والمدفوعات.
          </p>

          <div className="mt-9 grid grid-cols-3 gap-3">
            {[
              { icon: ClipboardCheck, label: 'دورة شراء موثقة' },
              { icon: Boxes3, label: 'رصيد لحظي للمواد' },
              { icon: ShieldCheck, label: 'صلاحيات وعزل بيانات' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <Icon size={21} className="text-amber-300" />
                <p className="mt-3 text-xs font-bold leading-5 text-slate-200">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs font-medium text-slate-500">Construction Supply Operations Platform</p>
      </section>

      <section className="relative flex min-h-screen items-center justify-center bg-[#f6f8fb] px-5 py-10 sm:px-10 lg:px-14">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-amber-400 via-sky-700 to-slate-950 lg:hidden" />
        <div className="w-full max-w-md">
          <BrandMark className="mb-10 lg:hidden" />

          <div className="mb-8">
            <p className="text-sm font-bold text-sky-800">بوابة العمليات</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {isSignUp ? 'إنشاء حساب جديد' : 'مرحبًا بعودتك'}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              {isSignUp
                ? 'أنشئ حسابًا للوصول إلى مساحة عمل المشروع.'
                : 'سجّل الدخول للوصول إلى بيانات المشروع والتقارير التشغيلية.'}
            </p>
          </div>

          <div className="surface-card p-5 sm:p-7">
            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {notice && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                  {notice}
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-bold text-slate-700">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    dir="ltr"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="enterprise-field pr-12 text-left"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-bold text-slate-700">
                  كلمة المرور
                </label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    dir="ltr"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="enterprise-field px-12 text-left"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group flex min-h-13 w-full items-center justify-center gap-3 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-slate-950/15 transition hover:-translate-y-0.5 hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {loading ? 'جاري التحقق...' : isSignUp ? 'إنشاء الحساب' : 'دخول إلى المنصة'}
                {!loading && <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-1" />}
              </button>
            </form>

            <div className="mt-6 border-t border-slate-100 pt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp((current) => !current);
                  setError('');
                  setNotice('');
                }}
                className="text-sm font-bold text-sky-800 transition hover:text-sky-950"
              >
                {isSignUp ? 'لديك حساب؟ تسجيل الدخول' : 'ليس لديك حساب؟ إنشاء حساب جديد'}
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs leading-6 text-slate-400">
            بالدخول إلى المنصة أنت تستخدم مساحة عمل خاصة وآمنة ببيانات مشروعك.
          </p>
        </div>
      </section>
    </main>
  );
}
