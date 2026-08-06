-- Production-readiness regression test.
-- Verifies safe demo seeding, integrity reporting, snapshot export and runtime error monitoring.
-- Transactional: leaves no data behind.

begin;

insert into public.projects(id,user_id,name,start_date,currency)
values(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Production Readiness Test',
  current_date,
  'EGP'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);

do $$
declare
  v_seeded uuid;
  v_snapshot jsonb;
  v_error_id uuid;
  v_failed boolean;
  v_issue_count bigint;
  v_unresolved bigint;
  v_expected_keys text[] := array[
    'attachments_metadata',
    'audit_events',
    'client_error_events',
    'exported_at',
    'goods_receipt_items',
    'goods_receipts',
    'materials',
    'payments',
    'project',
    'purchase_items',
    'purchase_request_items',
    'purchase_requests',
    'purchase_return_items',
    'purchase_returns',
    'purchases',
    'schema_version',
    'stock_issue_items',
    'stock_issues',
    'stock_movements',
    'suppliers'
  ];
  v_key text;
begin
  v_seeded := public.seed_demo_project_if_empty('11111111-1111-4111-8111-111111111111');
  if v_seeded <> '11111111-1111-4111-8111-111111111111' then
    raise exception 'safe demo seed returned a different project';
  end if;

  if (select currency from public.projects where id=v_seeded) <> 'EGP' then
    raise exception 'safe demo seed did not enforce EGP';
  end if;
  if (select count(*) from public.materials where project_id=v_seeded) <> 2 then
    raise exception 'safe demo material count mismatch';
  end if;
  if (select count(*) from public.suppliers where project_id=v_seeded) <> 1 then
    raise exception 'safe demo supplier count mismatch';
  end if;
  if (select count(*) from public.purchase_requests where project_id=v_seeded) <> 1 then
    raise exception 'safe demo request count mismatch';
  end if;
  if (select count(*) from public.purchases where project_id=v_seeded) <> 1 then
    raise exception 'safe demo purchase count mismatch';
  end if;
  if (select count(*) from public.goods_receipts where project_id=v_seeded and status='COMPLETED') <> 1 then
    raise exception 'safe demo receipt count mismatch';
  end if;
  if (select count(*) from public.payments where project_id=v_seeded and status='POSTED') <> 1 then
    raise exception 'safe demo payment count mismatch';
  end if;
  if (select count(*) from public.stock_issues where project_id=v_seeded and status='COMPLETED') <> 1 then
    raise exception 'safe demo issue count mismatch';
  end if;

  v_failed := false;
  begin
    perform public.seed_demo_project_if_empty(v_seeded);
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'safe demo seed accepted a non-empty project';
  end if;

  select coalesce(sum(issue_count),0)
  into v_issue_count
  from public.system_integrity_report(v_seeded);
  if v_issue_count <> 0 then
    raise exception 'seeded project failed integrity report with % issues', v_issue_count;
  end if;

  v_snapshot := public.export_project_snapshot(v_seeded);
  if v_snapshot is null or jsonb_typeof(v_snapshot) <> 'object' then
    raise exception 'project snapshot is not a JSON object';
  end if;

  foreach v_key in array v_expected_keys loop
    if not (v_snapshot ? v_key) then
      raise exception 'project snapshot missing key %', v_key;
    end if;
  end loop;

  if jsonb_array_length(v_snapshot->'materials') <> 2 then
    raise exception 'snapshot material count mismatch';
  end if;
  if jsonb_array_length(v_snapshot->'purchases') <> 1 then
    raise exception 'snapshot purchase count mismatch';
  end if;
  if jsonb_array_length(v_snapshot->'audit_events') < 1 then
    raise exception 'snapshot audit trail missing';
  end if;

  v_error_id := public.report_client_error(
    v_seeded,
    'Synthetic browser error for transactional verification',
    'synthetic stack',
    '/integrity-test',
    'production-readiness-test-agent'
  );
  if v_error_id is null then
    raise exception 'client error reporter returned null';
  end if;

  select issue_count
  into v_unresolved
  from public.system_integrity_report(v_seeded)
  where check_name='unresolved_client_errors';
  if v_unresolved <> 1 then
    raise exception 'unresolved client error count mismatch: %', v_unresolved;
  end if;

  v_failed := false;
  begin
    perform public.system_integrity_report('22222222-2222-4222-8222-222222222222');
  exception when others then
    v_failed := true;
  end;
  if not v_failed then
    raise exception 'integrity report allowed an unauthorized project';
  end if;
end $$;

reset role;
select 'PASS' as result, 19 as assertions_passed, 0 as assertions_failed;
rollback;
