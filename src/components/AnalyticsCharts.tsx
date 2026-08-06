import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Activity, BarChart2, TrendingUp, PieChart as PieIcon, ArrowLeft, Calendar, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProject } from '../lib/ProjectContext';
import { useTheme } from '../lib/ThemeContext';
import { formatCurrency } from '../lib/formatters';

interface AnalyticsChartsProps {
  compact?: boolean;
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

function formatMonthYearLabel(ym: string): string {
  if (!ym) return 'غير محدد';
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) return ym;
  return `${ARABIC_MONTHS[monthNum - 1]} ${year}`;
}

const CATEGORY_COLORS = [
  '#0284c7', // Sky Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#64748b', // Slate
];

export default function AnalyticsCharts({ compact = false }: AnalyticsChartsProps) {
  const { project } = useProject();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const currency = project?.currency || 'OMR';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'monthlyExp' | 'categoryCost' | 'consumption' | 'topMaterials' | 'inOut' | 'financial'
  >('monthlyExp');

  const [monthlyExpenditure, setMonthlyExpenditure] = useState<any[]>([]);
  const [categoryCosts, setCategoryCosts] = useState<any[]>([]);
  const [consumptionTrend, setConsumptionTrend] = useState<any[]>([]);
  const [topMaterialsData, setTopMaterialsData] = useState<any[]>([]);
  const [inOutData, setInOutData] = useState<any[]>([]);
  const [financialData, setFinancialData] = useState<any[]>([]);

  useEffect(() => {
    if (!project) return;

    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const [movementsRes, materialsRes, purchasesRes, paymentsRes] = await Promise.all([
          supabase
            .from('stock_movements')
            .select('type,quantity,date,materials(name,unit,category)')
            .eq('project_id', project.id)
            .order('date', { ascending: true }),
          supabase
            .from('material_stock')
            .select('name,current_stock,min_stock,unit,category')
            .eq('project_id', project.id),
          supabase
            .from('purchases')
            .select('id,total,date,purchase_items(id,total,quantity,unit_price,materials(id,name,category))')
            .eq('project_id', project.id)
            .order('date', { ascending: true }),
          supabase.from('payments').select('amount,date').eq('project_id', project.id),
        ]);

        const movements = movementsRes.data || [];
        const materials = materialsRes.data || [];
        const purchases = purchasesRes.data || [];
        const payments = paymentsRes.data || [];

        // 1. Calculate Monthly Expenditure (إجمالي الإنفاق الشهري)
        const monthExpMap: Record<string, number> = {};
        purchases.forEach((p) => {
          if (!p.date) return;
          const ym = p.date.substring(0, 7); // e.g. "2026-08"
          const total = Number(p.total) || 0;
          monthExpMap[ym] = (monthExpMap[ym] || 0) + total;
        });

        const sortedMonths = Object.keys(monthExpMap).sort();
        const formattedMonthlyExp = sortedMonths.map((ym) => ({
          monthKey: ym,
          monthLabel: formatMonthYearLabel(ym),
          الإنفاق: monthExpMap[ym],
        }));

        setMonthlyExpenditure(formattedMonthlyExp);

        // 2. Calculate Cost Distribution by Material Category (توزيع التكاليف حسب فئة المواد)
        const categoryCostMap: Record<string, number> = {};

        purchases.forEach((p) => {
          const items = (p as any).purchase_items || [];
          if (items && items.length > 0) {
            items.forEach((item: any) => {
              const itemTotal = Number(item.total) || Number(item.quantity) * Number(item.unit_price) || 0;
              const matData = Array.isArray(item.materials) ? item.materials[0] : item.materials;
              const catName = matData?.category?.trim() || 'مواد عامة';
              categoryCostMap[catName] = (categoryCostMap[catName] || 0) + itemTotal;
            });
          } else {
            // Attribute purchase with no items to general category
            const catName = 'مواد وأدوات عامة';
            categoryCostMap[catName] = (categoryCostMap[catName] || 0) + (Number(p.total) || 0);
          }
        });

        // If no purchase items were found, attempt to estimate using stock movements or materials
        if (Object.keys(categoryCostMap).length === 0 && materials.length > 0) {
          materials.forEach((m) => {
            const catName = m.category?.trim() || 'مواد عامة';
            const approxVal = (Number(m.current_stock) || 0) * 10;
            if (approxVal > 0) {
              categoryCostMap[catName] = (categoryCostMap[catName] || 0) + approxVal;
            }
          });
        }

        const totalCategorySpending = Object.values(categoryCostMap).reduce((s, v) => s + v, 0);

        const formattedCategoryCosts = Object.entries(categoryCostMap)
          .map(([name, value], index) => ({
            name,
            value,
            percentage: totalCategorySpending > 0 ? Number(((value / totalCategorySpending) * 100).toFixed(1)) : 0,
            color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
          }))
          .sort((a, b) => b.value - a.value);

        setCategoryCosts(formattedCategoryCosts);

        // 3. Group Outward Consumption by Date
        const dateMap: Record<string, number> = {};
        const inOutMap: Record<string, { date: string; in: number; out: number }> = {};
        const matUsageMap: Record<string, { name: string; totalConsumed: number; unit: string }> = {};

        movements.forEach((m) => {
          const date = m.date || 'غير محدد';
          const qty = Number(m.quantity) || 0;
          const matData = (m as any).materials;
          const matName = Array.isArray(matData) ? matData[0]?.name : matData?.name || 'مادة';
          const unit = Array.isArray(matData) ? matData[0]?.unit : matData?.unit || '';

          if (m.type === 'OUT') {
            dateMap[date] = (dateMap[date] || 0) + qty;

            if (!matUsageMap[matName]) {
              matUsageMap[matName] = { name: matName, totalConsumed: 0, unit };
            }
            matUsageMap[matName].totalConsumed += qty;
          }

          if (!inOutMap[date]) {
            inOutMap[date] = { date, in: 0, out: 0 };
          }
          if (m.type === 'IN') {
            inOutMap[date].in += qty;
          } else {
            inOutMap[date].out += qty;
          }
        });

        const formattedConsumption = Object.entries(dateMap)
          .map(([date, quantity]) => ({ date, كمية_الصرف: quantity }))
          .slice(-10);

        const formattedTopMaterials = Object.values(matUsageMap)
          .sort((a, b) => b.totalConsumed - a.totalConsumed)
          .slice(0, 6)
          .map((m) => ({ name: m.name, إجمالي_المصروف: m.totalConsumed, unit: m.unit }));

        const formattedInOut = Object.values(inOutMap).slice(-10);

        // Financial Totals
        const totalPurchases = purchases.reduce((s, p) => s + (Number(p.total) || 0), 0);
        const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        const totalRemaining = Math.max(totalPurchases - totalPaid, 0);

        const formattedFinancial = [
          { name: 'المدفوع للموردين', value: totalPaid, color: '#10b981' },
          { name: 'الرصيد المستحق', value: totalRemaining, color: '#f59e0b' },
        ];

        setConsumptionTrend(formattedConsumption);
        setTopMaterialsData(formattedTopMaterials);
        setInOutData(formattedInOut);
        setFinancialData(formattedFinancial);
      } catch (err) {
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchAnalytics();
  }, [project]);

  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#f8fafc' : '#0f172a';

  const CustomCurrencyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md text-xs space-y-1">
          <p className="font-bold text-slate-900 dark:text-slate-100">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="font-medium text-sky-600 dark:text-sky-400">
              {entry.name || 'إجمالي الإنفاق'}: <span className="font-bold">{formatCurrency(entry.value, currency)}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md text-xs space-y-1">
          <p className="font-bold text-slate-900 dark:text-slate-100">{data.name}</p>
          <p className="text-slate-600 dark:text-slate-300">
            التكلفة: <span className="font-bold text-sky-600 dark:text-sky-400">{formatCurrency(data.value, currency)}</span>
          </p>
          <p className="text-slate-500 dark:text-slate-400">
            النسبة من الإجمالي: <span className="font-bold">{data.percentage}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="h-60 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  // Dashboard Compact View: Renders both Monthly Expenditure and Category Cost Distribution side-by-side
  if (compact) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Monthly Expenditure (إجمالي الإنفاق الشهري) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                إجمالي الإنفاق الشهري
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                تتبع حركة المشتريات والالتزامات المالية شهرياً
              </p>
            </div>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
            >
              التقارير <ArrowLeft size={12} />
            </Link>
          </div>

          <div className="h-56 w-full pt-1">
            {monthlyExpenditure.length === 0 ? (
              <div className="h-full grid place-items-center text-xs text-slate-400">
                لا توجد بيانات مشتريات شهرية مسجلة بعد
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyExpenditure} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="monthlyBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284c7" stopOpacity={1} />
                      <stop offset="100%" stopColor="#0369a1" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                  <XAxis dataKey="monthLabel" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={10} />
                  <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={10} />
                  <Tooltip content={<CustomCurrencyTooltip />} />
                  <Bar
                    dataKey="الإنفاق"
                    name="إجمالي الإنفاق"
                    fill="url(#monthlyBarGrad)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Cost Distribution by Material Category (توزيع التكاليف حسب فئة المواد) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                توزيع التكاليف حسب فئة المواد
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                نسبة المصروفات حسب فئات وتصنيفات التوريد
              </p>
            </div>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
            >
              التفاصيل <ArrowLeft size={12} />
            </Link>
          </div>

          <div className="h-56 w-full pt-1">
            {categoryCosts.length === 0 ? (
              <div className="h-full grid place-items-center text-xs text-slate-400">
                لا توجد تكاليف مواد مقسمة حس الفئات بعد
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryCosts}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryCosts.map((entry, index) => (
                      <Cell key={`cell-cat-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                    formatter={(value, entry: any) => (
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {value} ({entry.payload?.percentage}%)
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full Analytics View (for Reports or Analytics Hub)
  return (
    <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            تحليلات الإنفاق والتكاليف البيانية التفاعلية
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            متابعة تفصيلية لتوزيع التكاليف، الإنفاق الشهري، ومعدلات الاستهلاك لمواد البناء.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto text-xs">
          <button
            onClick={() => setActiveTab('monthlyExp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'monthlyExp'
                ? 'bg-white dark:bg-slate-900 text-sky-900 dark:text-sky-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Calendar size={14} /> الإنفاق الشهري
          </button>
          <button
            onClick={() => setActiveTab('categoryCost')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'categoryCost'
                ? 'bg-white dark:bg-slate-900 text-sky-900 dark:text-sky-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Layers size={14} /> تكاليف الفئات
          </button>
          <button
            onClick={() => setActiveTab('consumption')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'consumption'
                ? 'bg-white dark:bg-slate-900 text-sky-900 dark:text-sky-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <TrendingUp size={14} /> اتجاه الصرف
          </button>
          <button
            onClick={() => setActiveTab('topMaterials')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'topMaterials'
                ? 'bg-white dark:bg-slate-900 text-sky-900 dark:text-sky-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <BarChart2 size={14} /> الأكثر استهلاكاً
          </button>
          <button
            onClick={() => setActiveTab('inOut')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'inOut'
                ? 'bg-white dark:bg-slate-900 text-sky-900 dark:text-sky-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Activity size={14} /> الاستلام vs الصرف
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
              activeTab === 'financial'
                ? 'bg-white dark:bg-slate-900 text-sky-900 dark:text-sky-400 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <PieIcon size={14} /> الموقف المالي
          </button>
        </div>
      </div>

      {/* Chart Display Container */}
      <div className="h-64 sm:h-72 w-full pt-2">
        {activeTab === 'monthlyExp' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyExpenditure} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="fullMonthlyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0284c7" stopOpacity={1} />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
              <XAxis dataKey="monthLabel" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} />
              <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} />
              <Tooltip content={<CustomCurrencyTooltip />} />
              <Bar
                dataKey="الإنفاق"
                name="إجمالي الإنفاق الشهري"
                fill="url(#fullMonthlyGrad)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'categoryCost' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryCosts}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={5}
                dataKey="value"
              >
                {categoryCosts.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomPieTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
            </PieChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'consumption' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={consumptionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorConsumption" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
              <XAxis dataKey="date" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} />
              <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderColor: tooltipBorder,
                  color: textColor,
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="كمية_الصرف"
                stroke="#0284c7"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorConsumption)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'topMaterials' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topMaterialsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
              <XAxis dataKey="name" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} />
              <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderColor: tooltipBorder,
                  color: textColor,
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="إجمالي_المصروف" fill="#0f766e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'inOut' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={inOutData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
              <XAxis dataKey="date" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} />
              <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderColor: tooltipBorder,
                  color: textColor,
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="in" name="استلام توريدات" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="out" name="صرف موقعي" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'financial' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={financialData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={5}
                dataKey="value"
              >
                {financialData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderColor: tooltipBorder,
                  color: textColor,
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
