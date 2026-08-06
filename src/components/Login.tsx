import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import BRAND from '../config/brand';
import BrandMark from './BrandMark';

const translateAuthError = (message: string) => {
  if (message.includes('Invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
  if (message.includes('Email not confirmed')) return 'البريد الإلكتروني غير مؤكّد بعد.';
  if (message.includes('Password should be')) return 'كلمة المرور يجب ألا تقل عن 6 أحرف.';
  if (message.includes('User already registered')) return 'هذا البريد مسجل بالفعل.';
  return 'تعذر إكمال العملية. تحقق من الاتصال وحاول مرة أخرى.';
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
    if (loading) return;

    setLoading(true);
    setError('');
    setNotice('');

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) throw signUpError;
        setNotice('تم إنشاء الحساب. سجّل الدخول للمتابعة.');
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
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
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6" dir="rtl">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-labelledby="login-title">
          <BrandMark className="mb-7" />

          <div className="mb-6">
            <h1 id="login-title" className="text-2xl font-black tracking-tight text-slate-950">
              {isSignUp ? 'إنشاء حساب' : 'تسجيل الدخول'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isSignUp ? 'أنشئ حسابًا للوصول إلى مساحة عمل المشروع.' : BRAND.descriptor}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {notice && (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
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
                  inputMode="email"
                  dir="ltr"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="enterprise-field min-h-11 pr-12 text-left"
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
                  className="enterprise-field min-h-11 px-12 text-left"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-11 w-full items-center justify-center gap-3 rounded-xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white transition hover:bg-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'جاري التحقق...' : isSignUp ? 'إنشاء الحساب' : 'دخول'}
              {!loading && <ArrowLeft size={18} aria-hidden="true" />}
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
              className="min-h-11 rounded-xl px-3 text-sm font-bold text-sky-800 transition hover:bg-sky-50 hover:text-sky-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              {isSignUp ? 'لديك حساب؟ تسجيل الدخول' : 'إنشاء حساب جديد'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
