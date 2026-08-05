# Lenastore — إدارة مواد مشروع إنشائي

تطبيق PWA عربي لإدارة مشروع إنشائي واحد: المواد، المخزون، طلبات الشراء، المشتريات، الاستلام الجزئي والكامل، الموردون، المدفوعات، المرفقات والتقارير.

## الحالة الحالية

- Supabase project: `Lena-headstore`
- Project Ref: `bsrshhgjtnrvsckeqsmg`
- Database schema: مطبق فعليًا
- Demo data: مطبقة على المستخدم التجريبي الحالي
- Storage bucket: `attachments` خاص (Private)
- SQL release assertions: `13 passed / 0 failed`
- واجهة PWA: البيانات تحتاج اتصالًا بالإنترنت، بينما يتم تخزين App Shell فقط مؤقتًا

## التشغيل المحلي

```bash
npm install
npm run dev
```

التطبيق مربوط افتراضيًا بمشروع Supabase المخصص له. يمكن تجاوز الإعدادات عبر:

```env
VITE_SUPABASE_URL="https://bsrshhgjtnrvsckeqsmg.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_PUBLISHABLE_KEY"
```

لا تستخدم `service_role` داخل الواجهة أو المستودع.

## أوامر الجودة

```bash
npm run lint
npm test
npm run build
```

## ملفات قاعدة البيانات

1. `supabase/schema.sql` — المخطط الكامل، RLS، Views، RPCs وStorage policies.
2. `supabase/seed.sql` — دالة Demo آمنة لا تعمل إلا بمعرف مستخدم موجود.
3. `supabase/tests/db.test.sql` — اختبارات قاعدة البيانات داخل Transaction مع Rollback.

لتشغيل بيانات Demo على قاعدة جديدة:

```sql
select public.seed_demo_data('AUTH_USER_UUID'::uuid);
```

## ضمانات قاعدة البيانات

- الرصيد يُحسب من `stock_movements` فقط.
- الشراء لا يزيد المخزون.
- `receive_goods` ينفذ الاستلام ذريًا ويمنع التكرار والاستلام الزائد.
- `register_payment` يقفل أمر الشراء ويمنع الدفع الزائد المتزامن.
- صرف كمية أكبر من الرصيد يُمنع داخل PostgreSQL، وليس في الواجهة فقط.
- Views تعمل بـ `security_invoker`.
- RLS يعزل كل مشروع عن المستخدمين الآخرين.
- المرفقات خاصة وتُعرض بروابط مؤقتة Signed URLs.
