import React, { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, BarChart3, Layers3, PackageSearch, WalletCards } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { formatCurrency } from '../lib/formatters';
import { ErrorState } from './common/ErrorState';

interface AnalyticsChartsProps {
  compact?: boolean;
}

interface MaterialRelation {
  name?: string | null;
  unit?: string | null;
  category?: string | null;
}

interface MovementRow {
  type: 'IN' | 'OUT';
  quantity: number | string;
  date: string | null;
  materials: MaterialRelation | MaterialRelation[] | null;
}

interface PurchaseItemRelation {
  total: number | string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  materials: MaterialRelation | MaterialRelation[] | null;
}

interface PurchaseRow {
  id: string;
  total: number | string | null;
  date: string | null;
  purchase_items: PurchaseItemRelation[] | null;
}

interface PaymentRow {
  amount: number | string | null;
  date: string | null;
}

interface MonthlyExpenditurePoint {
  monthKey: string;
  monthLabel: string;
  amount: number;
}

interface CategoryCostPoint {
  name: string;
  value: number;
  color: string;
}

interface MovementCountPoint {
  date: string;
  incoming: number;
  outgoing: number;
}

interface MaterialActivityPoint {
  name: string;
  issueCount: number;
}

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const CATEGORY_COLORS = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#64748b'];

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function relationOne(value: MaterialRelation | MaterialRelation[] | null): MaterialRelation | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function formatMonthYearLabel(value: string): string {
  const [year, monthText] = value.split('-');
  const month = Number(monthText);
  if (!year || month < 1 || month > 12) return value;
  return `${ARABIC_MONTHS[month - 1]} ${year}`;
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="grid h-64 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
      {message}
    </div>
  );
}

function ChartCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 sm:p-5">
      <header className="mb-4 flex items-start gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export default function AnalyticsCharts({ compact = false }: AnalyticsChartsProps) {
  const { project } = useProject();
  const currency = project?.currency || 'EGP';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyExpenditure, setMonthlyExpenditure] = useState<MonthlyExpenditurePoint[]>([]);
  const [categoryCosts, setCategoryCosts] = useState<CategoryCostPoint[]>([]);
  const [movementCounts, setMovementCounts] = useState<MovementCountPoint[]>([]);
  const [materialActivity, setMaterialActivity] = useState<MaterialActivityPoint[]>([]);
  const [financialSummary, setFinancialSummary] = useState({ totalPurchases: 0, totalPaid: 0, remaining: 0 });

  const fetchAnalytics = useCallback(async () => {
    if (!project) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [movementsRes, purchasesRes, paymentsRes] = await Promise.all([
        supabase
          .from('stock_movements')
          .select('type,quantity,date,materials(name,unit,category)')
          .eq('project_id', project.id)
          .order('date', { ascending: true }),
        supabase
          .from('purchases')
          .select('id,total,date,purchase_items(total,quantity,unit_price,materials(name,category,unit))')
          .eq('project_id', project.id)
          .order('date', { ascending: true }),
        supabase.from('payments').select('amount,date').eq('project_id', project.id).order('date', { ascending: true }),
      ]);

      const queryError = movementsRes.error ?? purchasesRes.error ?? paymentsRes.error;
      if (queryError) throw queryError;

      const movements = (movementsRes.data ?? []) as MovementRow[];
      const purchases = (purchasesRes.data ?? []) as PurchaseRow[];
      const payments = (paymentsRes.data ?? []) as PaymentRow[];

      const monthTotals = new Map<string, number>();
      purchases.forEach((purchase) => {
        if (!purchase.date) return;
        const key = purchase.date.slice(0, 7);
        monthTotals.set(key, (monthTotals.get(key) ?? 0) + toNumber(purchase.total));
      });
      setMonthlyExpenditure(
        [...monthTotals.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([monthKey, amount]) => ({ monthKey, monthLabel: formatMonthYearLabel(monthKey), amount }))
      );

      const categoryTotals = new Map<string, number>();
      purchases.forEach((purchase) => {
        const items = purchase.purchase_items ?? [];
        if (items.length === 0) {
          const total = toNumber(purchase.total);
          if (total > 0) categoryTotals.set('غير مصنف', (categoryTotals.get('غير مصنف') ?? 0) + total);
          return;
        }

        items.forEach((item) => {
          const material = relationOne(item.materials);
          const category = material?.category?.trim() || 'غير مصنف';
          const explicitTotal = toNumber(item.total);
          const calculatedTotal = toNumber(item.quantity) * toNumber(item.unit_price);
          const actualTotal = explicitTotal > 0 ? explicitTotal : calculatedTotal;
          if (actualTotal > 0) categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + actualTotal);
        });
      });
      setCategoryCosts(
        [...categoryTotals.entries()]
          .sort(([, a], [, b]) => b - a)
          .map(([name, value], index) => ({ name, value, color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }))
      );

      const movementByDate = new Map<string, MovementCountPoint>();
      const issueCountsByMaterial = new Map<string, number>();
      movements.forEach((movement) => {
        const date = movement.date || 'غير محدد';
        const current = movementByDate.get(date) ?? { date, incoming: 0, outgoing: 0 };
        if (movement.type === 'IN') current.incoming += 1;
        if (movement.type === 'OUT') {
          current.outgoing += 1;
          const material = relationOne(movement.materials);
          const materialName = material?.name?.trim() || 'مادة غير مسماة';
          issueCountsByMaterial.set(materialName, (issueCountsByMaterial.get(materialName) ?? 0) + 1);
        }
        movementByDate.set(date, current);
      });
      setMovementCounts([...movementByDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-12));
      setMaterialActivity(
        [...issueCountsByMaterial.entries()]
          .sort(([, a], [, b]) => b - a)
          .slice(0, 8)
          .map(([name, issueCount]) => ({ name, issueCount }))
      );

      const totalPurchases = purchases.reduce((sum, purchase) => sum + toNumber(purchase.total), 0);
      const totalPaid = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
      setFinancialSummary({
        totalPurchases,
        totalPaid,
        remaining: Math.max(totalPurchases - totalPaid, 0),
      });
    } catch (analyticsError) {
      console.error('Analytics query failed', analyticsError);
      setError('تعذر تحميل التحليلات من قاعدة البيانات. لم يتم عرض أي أرقام تقديرية.');
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className={compact ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : 'grid grid-cols-1 gap-4 xl:grid-cols-2'}>
        {[0, 1].map((item) => (
          <div key={item} className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState title="تعذر تحميل التحليلات" message={error} onRetry={() => void fetchAnalytics()} />;
  }

  const monthlyCard = (
    <ChartCard
      title="الإنفاق الشهري"
      description="إجمالي أوامر الشراء المسجلة فعليًا لكل شهر."
      icon={<BarChart3 size={19} aria-hidden="true" />}
    >
      {monthlyExpenditure.length === 0 ? (
        <ChartEmpty message="لا توجد أوامر شراء مؤرخة لعرض الإنفاق الشهري." />
      ) : (
        <div className="h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyExpenditure} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={58} />
              <Tooltip formatter={(value) => formatCurrency(toNumber(value), currency)} />
              <Bar dataKey="amount" name="إجمالي الشراء" fill="#0284c7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );

  const categoryCard = (
    <ChartCard
      title="تكلفة فئات المواد"
      description="محسوبة من بنود أوامر الشراء الفعلية فقط، دون تقديرات مخزنية."
      icon={<Layers3 size={19} aria-hidden="true" />}
    >
      {categoryCosts.length === 0 ? (
        <ChartEmpty message="لا توجد بيانات تكلفة كافية لعرض هذا التحليل." />
      ) : (
        <div className="h-64 w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={categoryCosts} dataKey="value" nameKey="name" innerRadius={48} outerRadius={82} paddingAngle={2}>
                {categoryCosts.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(toNumber(value), currency)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );

  if (compact) {
    return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{monthlyCard}{categoryCard}</div>;
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي المشتريات</p>
          <p className="mt-2 text-xl font-black tabular-nums text-slate-950 dark:text-white">
            {formatCurrency(financialSummary.totalPurchases, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">المدفوع للموردين</p>
          <p className="mt-2 text-xl font-black tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(financialSummary.totalPaid, currency)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">المتبقي المستحق</p>
          <p className="mt-2 text-xl font-black tabular-nums text-amber-700 dark:text-amber-400">
            {formatCurrency(financialSummary.remaining, currency)}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {monthlyCard}
        {categoryCard}

        <ChartCard
          title="عدد حركات المخزون"
          description="عدد سندات الوارد والصرف حسب التاريخ؛ لا يجمع وحدات قياس مختلفة."
          icon={<Activity size={19} aria-hidden="true" />}
        >
          {movementCounts.length === 0 ? (
            <ChartEmpty message="لا توجد حركات مخزنية لعرضها." />
          ) : (
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={movementCounts} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={34} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="incoming" name="حركات الوارد" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="outgoing" name="حركات الصرف" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="المواد الأكثر تكرارًا في الصرف"
          description="ترتيب بعدد حركات الصرف، وليس بجمع كميات ذات وحدات مختلفة."
          icon={<PackageSearch size={19} aria-hidden="true" />}
        >
          {materialActivity.length === 0 ? (
            <ChartEmpty message="لا توجد حركات صرف مسجلة بعد." />
          ) : (
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={materialActivity} layout="vertical" margin={{ top: 8, right: 8, left: 28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={94} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="issueCount" name="عدد حركات الصرف" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
        <WalletCards className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
        <p>كل المؤشرات المالية معروضة من أوامر الشراء والمدفوعات المسجلة فقط. لا يستخدم التطبيق أي معامل تقديري لتوليد تكاليف غير حقيقية.</p>
      </div>
    </div>
  );
}
