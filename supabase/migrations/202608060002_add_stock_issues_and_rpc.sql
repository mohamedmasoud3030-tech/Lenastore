-- Lenastore Migration: Add stock_issues, stock_issue_items, and issue_stock RPC

create table if not exists public.stock_issues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  issue_number varchar(100) not null,
  date date not null,
  receiver_name varchar(255) not null,
  destination varchar(255),
  reference_number varchar(100),
  notes text,
  idempotency_key varchar(100) not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique(project_id, issue_number),
  unique(project_id, idempotency_key)
);

create table if not exists public.stock_issue_items (
  id uuid primary key default gen_random_uuid(),
  stock_issue_id uuid not null references public.stock_issues(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  quantity numeric(18,3) not null check(quantity > 0)
);

create index if not exists stock_issues_project_idx on public.stock_issues(project_id);
create index if not exists stock_issue_items_issue_idx on public.stock_issue_items(stock_issue_id);
create index if not exists stock_issue_items_material_idx on public.stock_issue_items(material_id);

alter table public.stock_issues enable row level security;
alter table public.stock_issue_items enable row level security;

drop policy if exists stock_issues_select on public.stock_issues;
create policy stock_issues_select on public.stock_issues for select to authenticated using(public.owns_project(project_id));

drop policy if exists stock_issue_items_select on public.stock_issue_items;
create policy stock_issue_items_select on public.stock_issue_items for select to authenticated using(exists(select 1 from public.stock_issues si where si.id=stock_issue_id and public.owns_project(si.project_id)));

grant select on public.stock_issues, public.stock_issue_items to authenticated;

create or replace function public.issue_stock(
  p_project_id uuid,
  p_issue_number varchar,
  p_issue_date date,
  p_receiver_name varchar,
  p_destination varchar,
  p_reference_number varchar,
  p_notes text,
  p_items jsonb,
  p_idempotency_key varchar
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_issue_id uuid;
  v_item record;
  v_balance numeric(18,3);
  v_count int := 0;
begin
  if auth.uid() is null or not public.owns_project(p_project_id) then
    raise exception 'unauthorized';
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'idempotency key required';
  end if;

  select id into v_issue_id
  from public.stock_issues
  where project_id = p_project_id and idempotency_key = p_idempotency_key;

  if found then
    return v_issue_id;
  end if;

  if p_receiver_name is null or btrim(p_receiver_name) = '' then
    raise exception 'receiver name is required';
  end if;

  insert into public.stock_issues (
    project_id, issue_number, date, receiver_name, destination, reference_number, notes, idempotency_key, created_by
  )
  values (
    p_project_id, p_issue_number, p_issue_date, p_receiver_name, p_destination, p_reference_number, p_notes, p_idempotency_key, auth.uid()
  )
  on conflict (project_id, idempotency_key) do nothing
  returning id into v_issue_id;

  if v_issue_id is null then
    select id into v_issue_id
    from public.stock_issues
    where project_id = p_project_id and idempotency_key = p_idempotency_key;
    return v_issue_id;
  end if;

  for v_item in 
    select (e->>'material_id')::uuid material_id, sum((e->>'quantity')::numeric) quantity
    from jsonb_array_elements(p_items) e
    group by (e->>'material_id')::uuid
  loop
    v_count := v_count + 1;
    if v_item.quantity <= 0 then
      raise exception 'issued quantity must be positive';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_item.material_id::text, 0));

    if not exists (select 1 from public.materials where id = v_item.material_id and project_id = p_project_id) then
      raise exception 'material % does not belong to project', v_item.material_id;
    end if;

    select coalesce(sum(case when sm.type = 'IN' then sm.quantity else -sm.quantity end), 0)
    into v_balance
    from public.stock_movements sm
    where sm.project_id = p_project_id and sm.material_id = v_item.material_id;

    if v_balance < v_item.quantity then
      raise exception 'insufficient stock. available: %, requested: %', v_balance, v_item.quantity;
    end if;

    insert into public.stock_issue_items (stock_issue_id, material_id, quantity)
    values (v_issue_id, v_item.material_id, v_item.quantity);

    insert into public.stock_movements (
      project_id, type, material_id, quantity, date, reference_number, receiver_name, location_used, notes, created_by
    )
    values (
      p_project_id, 'OUT', v_item.material_id, v_item.quantity, p_issue_date, p_issue_number, p_receiver_name, p_destination, p_notes, auth.uid()
    );
  end loop;

  if v_count = 0 then
    raise exception 'at least one issue item is required';
  end if;

  return v_issue_id;
end;
$$;

revoke all on function public.issue_stock(uuid,varchar,date,varchar,varchar,varchar,text,jsonb,varchar) from public, anon;
grant execute on function public.issue_stock(uuid,varchar,date,varchar,varchar,varchar,text,jsonb,varchar) to authenticated;
