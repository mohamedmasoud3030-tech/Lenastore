import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileWarning,
  FlaskConical,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { parseSupabaseError } from '../lib/supabaseErrors';
import { useToast } from './common/ToastProvider';
import { PageHeader } from './common/PageHeader';
import { LoadingSkeleton } from './common/LoadingSkeleton';
import { ErrorState } from './common/ErrorState';

interface IntegrityCheck {
  check_name: string;
  severity: 'critical' | 'high' | 'warning' | string;
  issue_count: number | string;
  description: string;
}

interface ClientErrorRow {
  id: string;
  message: string;
  path: string | null;
  user_agent: string | null;
  resolved: boolean;
  created_at: string;
}

export default function SystemIntegrity() {
  const { project } = useProject();
  const toast = useToast();
  const [checks, setChecks] = useState<IntegrityCheck[]>([]);
  const [clientErrors, setClientErrors] = useState<ClientErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operationalRows, setOperationalRows] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !project) return;
    setLoading(true);
    setError(null);

    try {
      const [reportResult, errorResult, materialCount, supplierCount, purchaseCount, movementCount] = await Promise.all([
        supabase.rpc('system_integrity_report', { p_project_id: project.id }),
        supabase
          .from('client_error_events')
          .select('id,message,path,user_agent,resolved,created_at')
          .eq('project_id', project.id)
          .eq('resolved', false)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('materials').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
        supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
        supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('project_id', project.id),
      ]);

      const failed = [reportResult, errorResult, materialCount, supplierCount, purchaseCount, movementCount].find(
        (result) => result.error
      )?.error;
      if (failed) throw failed;

      setChecks((reportResult.data as unknown as IntegrityCheck[]) || []);
      setClientErrors((errorResult.data as unknown as ClientErrorRow[]) || []);
      setOperationalRows(
        (materialCount.count || 0) +
          (supplierCount.count || 0) +
          (purchaseCount.count || 0) +
          (movementCount.count || 0)
      );
      setLastCheckedAt(new Date());
    } catch (loadError) {
      console.error(loadError);
      setError(parseSupabaseError(loadError, 'تعذر تشغيل فحوصات سلامة النظام'));
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const issueChecks = checks.filter((check) => Number(check.issue_count) > 0);
    return {
      totalIssues: issueChecks.reduce((sum, check) => sum + Number(check.issue_count || 0), 0),
      critical: issueChecks
        .filter((check) => check.severity === 'critical')
        .reduce((sum, check) => sum + Number(check.issue_count || 0), 0),
      warnings: issueChecks
        .filter((check) => check.severity !== 'critical')
        .reduce((sum, check) => sum + Number(check.issue_count || 0), 0),
      passed: checks.filter((check) => Number(check.issue_count) === 0).length,
    };
  }, [checks]);

  const exportSnapshot = async () => {
    if (!supabase || !project) return;
    setExporting(true);
    try {
      const { data, error: exportError } = await supabase.rpc('export_project_snapshot', {
        p_project_id: project.id,
      });
      if (exportError) throw exportError;
      if (!data) throw new Error('لم تُرجع قاعدة البيانات ملف التصدير');

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeName = (project.name || 'lenastore-project').replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-|-$/g, '');
      link.href = url;
      link.download = `${safeName || 'lenastore-project'}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('تم تجهيز وتنزيل نسخة بيانات المشروع');
    } catch (exportError) {
      toast.error(parseSupabaseError(exportError, 'تعذر تصدير بيانات المشروع'));
    } finally {
      setExporting(false);
    }
  };

  const seedDemo = async () => {
    if (!supabase || !project) return;
    if (operationalRows > 0) {
      toast.error('بيانات الديمو لا تعمل إلا داخل مشروع فارغ تمامًا');
      return;
    }
    const confirmed = window.confirm(
      'سيتم إنشاء مواد ومورد وطلب شراء وأمر شراء واستلام ودفعة وصرف تجريبي. لن تُحذف أي بيانات. هل تريد المتابعة؟'
    );
    if (!confirmed) return;

    setSeeding(true);
    try {
      const { error: seedError } = await supabase.rpc('seed_demo_project_if_empty', {
        p_project_id: project.id,
      });
      if (seedError) throw seedError;
      toast.success('تم إنشاء بيانات الديمو الآمنة بنجاح');
      await load();
    } catch (seedError) {
      toast.error(parseSupabaseError(seedError, 'تعذر إنشاء بيانات الديمو'));
    } finally {
      setSeeding(false);
    }
  };

  if (loading && checks.length === 0) return <LoadingSkeleton rows={8} />;
  if (error && checks.length === 0) return <ErrorState message={error} onRetry={load} />;

  const healthy = summary.totalIssues === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="سلامة النظام والنسخ الاحتياطي"
        description="فحوصات مباشرة على الحسابات والمخزون والعلاقات، مع تصدير كامل ورصد أخطاء الواجهة."
        icon={ShieldCheck}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> إعادة الفحص
            </button>
            <button
              type="button"
              onClick={() => void exportSnapshot()}
              disabled={exporting}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300"
            >
              <Download className="h-4 w-4" /> {exporting ? 'جاري التصدير...' : 'تصدير نسخة المشروع'}
            </button>
          </div>
        }
      />

      <section
        className={`rounded-2xl border p-5 shadow-2xs ${
          healthy
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
            : 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20'
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${
                healthy
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
              }`}
            >
              {healthy ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
            </span>
            <div>
              <h2 className={`text-base font-black ${healthy ? 'text-emerald-900 dark:text-emerald-100' : 'text-rose-900 dark:text-rose-100'}`}>
                {healthy ? 'كل فحوصات السلامة ناجحة' : `تم رصد ${summary.totalIssues} مشكلة تحتاج مراجعة`}
              </h2>
              <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
                {summary.passed} فحص ناجح • {summary.critical} حرِج • {summary.warnings} تحذير
                {lastCheckedAt ? ` • آخر فحص ${lastCheckedAt.toLocaleTimeString('ar-EG')}` : ''}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-slate-700 shadow-2xs dark:bg-slate-900/70 dark:text-slate-200">
            قاعدة حقيقية • {project?.currency || 'EGP'}
          </span>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
              <Database className="h-5 w-5" /> نتائج الفحص المباشر
            </h3>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {checks.map((check) => {
              const count = Number(check.issue_count || 0);
              return (
                <div key={check.check_name} className="grid gap-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-xl ${
                      count === 0
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300'
                        : check.severity === 'critical'
                          ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                    }`}
                  >
                    {count === 0 ? <CheckCircle2 className="h-4 w-4" /> : <FileWarning className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-slate-100">{check.description}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-400" dir="ltr">
                      {check.check_name}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                      count === 0
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                    }`}
                  >
                    {count === 0 ? 'سليم' : count}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                <FlaskConical className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">بيانات الديمو الآمنة</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  تعمل فقط إذا المشروع فارغ تمامًا، ولا تحذف أو تستبدل أي بيانات.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void seedDemo()}
              disabled={seeding || operationalRows > 0}
              className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-black text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FlaskConical className="h-4 w-4" />
              {seeding ? 'جاري الإنشاء...' : operationalRows > 0 ? 'المشروع يحتوي بيانات' : 'إنشاء بيانات ديمو'}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-slate-100">
              <FileWarning className="h-5 w-5" /> أخطاء الواجهة غير المحلولة
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">آخر 20 خطأ تم التقاطه تلقائيًا.</p>
            <div className="mt-4 space-y-3">
              {clientErrors.length === 0 ? (
                <p className="rounded-xl bg-emerald-50 p-4 text-center text-xs font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  لا توجد أخطاء واجهة مسجلة.
                </p>
              ) : (
                clientErrors.map((clientError) => (
                  <article key={clientError.id} className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
                    <p className="line-clamp-3 text-xs font-bold leading-5 text-rose-900 dark:text-rose-100">{clientError.message}</p>
                    <p className="mt-2 truncate text-[10px] text-rose-500 dark:text-rose-300" dir="ltr">
                      {clientError.path || '/'}
                    </p>
                    <time className="mt-1 block text-[10px] text-slate-400" dateTime={clientError.created_at}>
                      {new Date(clientError.created_at).toLocaleString('ar-EG')}
                    </time>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
