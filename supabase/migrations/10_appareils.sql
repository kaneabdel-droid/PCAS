-- PCAS — Lot 10 : applications mobiles.
-- Appareils (téléphones, tablettes) enregistrés pour recevoir les notifications push (Firebase Cloud Messaging, qui
-- relaie aussi vers les iPhone via APNs). Chaque utilisateur ne voit et ne gère que ses propres appareils.

create table public.appareils (
  id uuid primary key default gen_random_uuid(),
  utilisateur_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  jeton text not null unique check (length(jeton) between 20 and 4096),
  plateforme text not null check (plateforme in ('android', 'ios')),
  created_at timestamptz not null default now(),
  vu_le timestamptz not null default now()
);

create index appareils_utilisateur_idx on public.appareils (utilisateur_id);

alter table public.appareils enable row level security;
create policy appareils_proprietaire on public.appareils for all to authenticated
  using (utilisateur_id = auth.uid()) with check (utilisateur_id = auth.uid());

-- Enregistrement (ou réattribution, si le téléphone change d'utilisateur) du jeton push de l'appareil.
create or replace function public.enregistrer_appareil(p_jeton text, p_plateforme text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.mon_role() is null then
    raise exception 'Connexion requise';
  end if;
  insert into public.appareils (utilisateur_id, jeton, plateforme)
  values (auth.uid(), p_jeton, p_plateforme)
  on conflict (jeton) do update set utilisateur_id = auth.uid(), plateforme = excluded.plateforme, vu_le = now();
end;
$$;

revoke execute on function public.enregistrer_appareil(text, text) from public, anon;
grant execute on function public.enregistrer_appareil(text, text) to authenticated;

alter table public.notifications add column push_envoye_le timestamptz;
create index notifications_push_idx on public.notifications (created_at) where push_envoye_le is null;
