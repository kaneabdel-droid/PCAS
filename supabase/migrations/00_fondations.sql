-- PCAS — Fondations : entreprises, utilisateurs, profils, fonctions de contexte et règles d'accès (RLS).
-- Principe : la base fait foi. Toute règle d'accès est posée ici, pas seulement dans le code de l'application.
-- Aucune inscription libre : les comptes sont créés par l'administrateur (invitation Supabase Auth + ligne utilisateurs).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.type_entreprise as enum ('producteur', 'client', 'banque');
create type public.role_base as enum ('administrateur', 'superviseur', 'producteur', 'client', 'financier');
create type public.statut_entreprise as enum ('actif', 'suspendu');

-- ---------------------------------------------------------------------------
-- Horodatage de mise à jour
-- ---------------------------------------------------------------------------

create or replace function public.maj_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Entreprises (producteurs, clients, banques) : toutes des personnes morales
-- ---------------------------------------------------------------------------

create table public.entreprises (
  id uuid primary key default gen_random_uuid(),
  type public.type_entreprise not null,
  denomination text not null check (length(trim(denomination)) > 0),
  sigle text,
  forme_juridique text,
  adresse text,
  region text,
  departement text,
  commune text,
  pays text not null default 'SN',
  telephone text,
  email text,
  site_web text,
  type_identifiant text not null default 'NINEA',
  identifiant_fiscal text,
  rccm text,
  representant_legal text,
  logo_path text,
  statut public.statut_entreprise not null default 'actif',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create index entreprises_type_idx on public.entreprises (type);
create trigger entreprises_updated_at before update on public.entreprises
  for each row execute function public.maj_updated_at();

-- ---------------------------------------------------------------------------
-- Profils personnalisés : un rôle de base + une matrice qui ne peut que restreindre
-- ---------------------------------------------------------------------------

create table public.profils (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  libelle text not null,
  role_base public.role_base not null,
  matrice_permissions jsonb not null default '{}'::jsonb,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profils_updated_at before update on public.profils
  for each row execute function public.maj_updated_at();

-- ---------------------------------------------------------------------------
-- Utilisateurs : administrateur et superviseur appartiennent à la plateforme (pas d'entreprise) ;
-- les autres sont rattachés à une entreprise du type correspondant à leur rôle.
-- ---------------------------------------------------------------------------

create table public.utilisateurs (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nom_complet text not null,
  telephone text,
  fonction text,
  role_base public.role_base not null,
  profil_id uuid references public.profils (id) on delete set null,
  entreprise_id uuid references public.entreprises (id) on delete restrict,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint utilisateurs_rattachement check (
    (role_base in ('administrateur', 'superviseur')) = (entreprise_id is null)
  )
);

create index utilisateurs_entreprise_idx on public.utilisateurs (entreprise_id);
create trigger utilisateurs_updated_at before update on public.utilisateurs
  for each row execute function public.maj_updated_at();

-- Cohérence rôle ↔ type d'entreprise, et profil ↔ rôle de base.
create or replace function public.verifier_rattachement_utilisateur()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type public.type_entreprise;
  v_role_profil public.role_base;
begin
  if new.entreprise_id is not null then
    select type into v_type from public.entreprises where id = new.entreprise_id;
    if (new.role_base = 'producteur' and v_type <> 'producteur')
      or (new.role_base = 'client' and v_type <> 'client')
      or (new.role_base = 'financier' and v_type <> 'banque') then
      raise exception 'Le rôle % ne correspond pas au type d''entreprise %', new.role_base, v_type;
    end if;
  end if;
  if new.profil_id is not null then
    select role_base into v_role_profil from public.profils where id = new.profil_id;
    if v_role_profil <> new.role_base then
      raise exception 'Le profil choisi est prévu pour le rôle %, pas pour %', v_role_profil, new.role_base;
    end if;
  end if;
  return new;
end;
$$;

create trigger utilisateurs_rattachement before insert or update on public.utilisateurs
  for each row execute function public.verifier_rattachement_utilisateur();

-- ---------------------------------------------------------------------------
-- Fonctions de contexte (utilisées par toutes les règles d'accès)
-- Un utilisateur désactivé, ou dont l'entreprise est suspendue, n'a plus aucun rôle : il ne voit ni ne modifie rien.
-- ---------------------------------------------------------------------------

create or replace function public.mon_role()
returns public.role_base
language sql
stable
security definer
set search_path = ''
as $$
  select u.role_base
  from public.utilisateurs u
  left join public.entreprises e on e.id = u.entreprise_id
  where u.id = auth.uid()
    and u.actif
    and (u.entreprise_id is null or e.statut = 'actif')
$$;

create or replace function public.mon_entreprise_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.entreprise_id
  from public.utilisateurs u
  join public.entreprises e on e.id = u.entreprise_id
  where u.id = auth.uid() and u.actif and e.statut = 'actif'
$$;

create or replace function public.est_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.mon_role() = 'administrateur', false)
$$;

create or replace function public.est_plateforme()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.mon_role() in ('administrateur', 'superviseur'), false)
$$;

revoke execute on function public.mon_role() from public, anon;
revoke execute on function public.mon_entreprise_id() from public, anon;
grant execute on function public.mon_role() to authenticated;
grant execute on function public.mon_entreprise_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Garde-fous sur les modifications faites par un non-administrateur
-- ---------------------------------------------------------------------------

-- Une entreprise met à jour sa fiche elle-même, mais ne change ni son type (qui détermine les droits) ni son statut.
create or replace function public.proteger_entreprise()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.est_admin() and auth.uid() is not null then
    if new.type is distinct from old.type then
      raise exception 'Seul l''administrateur peut changer le type d''une entreprise';
    end if;
    if new.statut is distinct from old.statut then
      raise exception 'Seul l''administrateur peut suspendre ou réactiver une entreprise';
    end if;
  end if;
  return new;
end;
$$;

create trigger entreprises_protection before update on public.entreprises
  for each row execute function public.proteger_entreprise();

-- Un utilisateur peut corriger son nom, son téléphone et sa fonction, rien d'autre.
create or replace function public.proteger_utilisateur()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.est_admin() and auth.uid() is not null then
    if new.id is distinct from old.id
      or new.email is distinct from old.email
      or new.role_base is distinct from old.role_base
      or new.profil_id is distinct from old.profil_id
      or new.entreprise_id is distinct from old.entreprise_id
      or new.actif is distinct from old.actif then
      raise exception 'Seul l''administrateur peut modifier le rôle, le profil, l''entreprise ou l''état d''un compte';
    end if;
  end if;
  return new;
end;
$$;

create trigger utilisateurs_protection before update on public.utilisateurs
  for each row execute function public.proteger_utilisateur();

-- ---------------------------------------------------------------------------
-- Règles d'accès (RLS)
-- ---------------------------------------------------------------------------

alter table public.entreprises enable row level security;
alter table public.profils enable row level security;
alter table public.utilisateurs enable row level security;

-- Entreprises : la plateforme voit tout ; une entreprise voit sa propre fiche.
-- (La visibilité des fiches producteurs par les clients est ouverte au lot 3, avec la place de marché.)
create policy entreprises_lecture on public.entreprises for select to authenticated
  using (public.est_plateforme() or id = public.mon_entreprise_id());
create policy entreprises_creation on public.entreprises for insert to authenticated
  with check (public.est_admin());
create policy entreprises_modification on public.entreprises for update to authenticated
  using (public.est_admin() or id = public.mon_entreprise_id())
  with check (public.est_admin() or id = public.mon_entreprise_id());
create policy entreprises_suppression on public.entreprises for delete to authenticated
  using (public.est_admin());

-- Profils : lisibles par tout utilisateur actif (libellé affiché), gérés par l'administrateur.
create policy profils_lecture on public.profils for select to authenticated
  using (public.mon_role() is not null);
create policy profils_gestion on public.profils for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- Utilisateurs : chacun voit sa ligne et ses collègues ; la plateforme voit tout ; seul l'administrateur crée et supprime.
create policy utilisateurs_lecture on public.utilisateurs for select to authenticated
  using (
    id = auth.uid()
    or public.est_plateforme()
    or (entreprise_id is not null and entreprise_id = public.mon_entreprise_id())
  );
create policy utilisateurs_creation on public.utilisateurs for insert to authenticated
  with check (public.est_admin());
create policy utilisateurs_modification on public.utilisateurs for update to authenticated
  using (public.est_admin() or id = auth.uid())
  with check (public.est_admin() or id = auth.uid());
create policy utilisateurs_suppression on public.utilisateurs for delete to authenticated
  using (public.est_admin());
