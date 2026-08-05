-- Make one-project onboarding safe to retry.
-- A stale client or double submission updates the existing project instead of
-- raising projects_user_id_key. Currency is intentionally preserved on retry.

create or replace function public.upsert_existing_project_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_id uuid;
begin
  select id
    into v_existing_id
    from public.projects
   where user_id = new.user_id
   for update;

  if v_existing_id is null then
    return new;
  end if;

  if auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'unauthorized';
  end if;

  update public.projects
     set name = new.name,
         location = new.location,
         manager_name = new.manager_name,
         phone = new.phone,
         start_date = new.start_date,
         owner_name = new.owner_name,
         is_active = new.is_active,
         updated_at = now()
   where id = v_existing_id;

  return null;
end;
$$;

revoke all on function public.upsert_existing_project_on_insert()
from public, anon, authenticated;

drop trigger if exists projects_idempotent_insert on public.projects;
create trigger projects_idempotent_insert
before insert on public.projects
for each row
execute function public.upsert_existing_project_on_insert();
