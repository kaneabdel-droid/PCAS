-- PCAS — Lot 1 : administration.
-- Comptes bancaires et sites de production des entreprises, capacités par produit, catalogue produits et rendements,
-- paramètres de la plateforme, journal d'audit, demandes d'accès, logos (Storage), contrats d'engagement.

-- ---------------------------------------------------------------------------
-- Utilisateurs : habilitation à signer le contrat d'engagement au nom de l'entreprise
-- ---------------------------------------------------------------------------

alter table public.utilisateurs add column signataire boolean not null default false;

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
      or new.actif is distinct from old.actif
      or new.signataire is distinct from old.signataire then
      raise exception 'Seul l''administrateur peut modifier le rôle, le profil, l''entreprise, l''habilitation ou l''état d''un compte';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Paramètres de la plateforme (une seule ligne)
-- ---------------------------------------------------------------------------

create table public.parametres_plateforme (
  id boolean primary key default true check (id),
  delai_grace_contrat_jours integer not null default 15 check (delai_grace_contrat_jours between 0 and 90),
  delai_reception_tacite_heures integer not null default 72 check (delai_reception_tacite_heures between 24 and 720),
  mention_tva text not null default 'Exonéré de TVA',
  mentions_legales text,
  updated_at timestamptz not null default now()
);

insert into public.parametres_plateforme (id) values (true);

create trigger parametres_updated_at before update on public.parametres_plateforme
  for each row execute function public.maj_updated_at();

alter table public.parametres_plateforme enable row level security;
create policy parametres_lecture on public.parametres_plateforme for select to authenticated
  using (public.mon_role() is not null);
create policy parametres_modification on public.parametres_plateforme for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- ---------------------------------------------------------------------------
-- Comptes bancaires des entreprises
-- ---------------------------------------------------------------------------

create table public.entreprise_comptes_bancaires (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  banque text not null check (length(trim(banque)) > 0),
  intitule text not null check (length(trim(intitule)) > 0),
  numero_compte text not null check (length(trim(numero_compte)) > 0),
  code_swift text,
  principal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comptes_entreprise_idx on public.entreprise_comptes_bancaires (entreprise_id);
create unique index comptes_un_principal on public.entreprise_comptes_bancaires (entreprise_id) where principal;
create trigger comptes_updated_at before update on public.entreprise_comptes_bancaires
  for each row execute function public.maj_updated_at();

-- ---------------------------------------------------------------------------
-- Catalogue produits (géré par l'administrateur) et rendements de transformation
-- ---------------------------------------------------------------------------

create table public.produits (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique check (length(trim(nom)) > 0),
  categorie text not null check (categorie in ('Céréales', 'Légumes', 'Tubercules', 'Fruits', 'Fruits à coque', 'Autres')),
  nature text not null check (nature in ('matiere_premiere', 'produit_fini')),
  unite text not null check (unite in ('kg', 'tonne', 'sac de 25 kg', 'sac de 50 kg', 'caisse', 'régime', 'pièce')),
  description text,
  image_path text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger produits_updated_at before update on public.produits
  for each row execute function public.maj_updated_at();

-- Rendement : quantité de produit fini (dans son unité) obtenue par unité de matière première (dans son unité).
-- Ex. 1 tonne de riz paddy donne environ 650 kg de riz blanchi, soit 13 sacs de 50 kg : rendement 13.
create table public.transformations (
  id uuid primary key default gen_random_uuid(),
  matiere_id uuid not null references public.produits (id) on delete cascade,
  produit_id uuid not null references public.produits (id) on delete cascade,
  rendement numeric(12, 4) not null check (rendement > 0 and rendement <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matiere_id, produit_id),
  check (matiere_id <> produit_id)
);

create trigger transformations_updated_at before update on public.transformations
  for each row execute function public.maj_updated_at();

create or replace function public.verifier_transformation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select nature from public.produits where id = new.matiere_id) <> 'matiere_premiere' then
    raise exception 'La transformation doit partir d''une matière première';
  end if;
  if (select nature from public.produits where id = new.produit_id) <> 'produit_fini' then
    raise exception 'La transformation doit aboutir à un produit fini';
  end if;
  return new;
end;
$$;

create trigger transformations_verification before insert or update on public.transformations
  for each row execute function public.verifier_transformation();

insert into public.produits (nom, categorie, nature, unite) values
  ('Riz paddy', 'Céréales', 'matiere_premiere', 'tonne'),
  ('Riz local blanchi', 'Céréales', 'produit_fini', 'sac de 50 kg'),
  ('Noix de cajou brute', 'Fruits à coque', 'matiere_premiere', 'kg'),
  ('Amande de cajou', 'Fruits à coque', 'produit_fini', 'kg'),
  ('Oignon', 'Légumes', 'produit_fini', 'sac de 25 kg'),
  ('Pomme de terre', 'Tubercules', 'produit_fini', 'sac de 25 kg'),
  ('Carotte', 'Légumes', 'produit_fini', 'sac de 25 kg'),
  ('Tomate', 'Légumes', 'produit_fini', 'caisse'),
  ('Banane', 'Fruits', 'produit_fini', 'régime'),
  ('Mangue', 'Fruits', 'produit_fini', 'caisse'),
  ('Madd', 'Fruits', 'produit_fini', 'kg'),
  ('Orange', 'Fruits', 'produit_fini', 'caisse');

insert into public.transformations (matiere_id, produit_id, rendement)
select mp.id, pf.id, t.rendement
from (values ('Riz paddy', 'Riz local blanchi', 13), ('Noix de cajou brute', 'Amande de cajou', 0.22)) as t (mp, pf, rendement)
join public.produits mp on mp.nom = t.mp
join public.produits pf on pf.nom = t.pf;

-- ---------------------------------------------------------------------------
-- Sites de production (entreprises productrices) et capacités par produit
-- ---------------------------------------------------------------------------

create table public.sites_production (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  nom text not null check (length(trim(nom)) > 0),
  region text,
  departement text,
  commune text,
  localite text,
  latitude numeric(9, 6) check (latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude between -180 and 180),
  superficie_ha numeric(12, 2) check (superficie_ha >= 0),
  jours_ouvres_semaine smallint not null default 6 check (jours_ouvres_semaine between 1 and 7),
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sites_entreprise_idx on public.sites_production (entreprise_id);
create trigger sites_updated_at before update on public.sites_production
  for each row execute function public.maj_updated_at();

create or replace function public.verifier_site_producteur()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select type from public.entreprises where id = new.entreprise_id) <> 'producteur' then
    raise exception 'Seule une entreprise productrice peut déclarer des sites de production';
  end if;
  return new;
end;
$$;

create trigger sites_verification before insert or update on public.sites_production
  for each row execute function public.verifier_site_producteur();

-- Capacité de production par jour ouvré, par site et par produit fini (dans l'unité du produit).
create table public.capacites_production (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites_production (id) on delete cascade,
  produit_id uuid not null references public.produits (id) on delete restrict,
  capacite_jour numeric(14, 3) not null check (capacite_jour > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, produit_id)
);

create trigger capacites_updated_at before update on public.capacites_production
  for each row execute function public.maj_updated_at();

create or replace function public.verifier_capacite()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select nature from public.produits where id = new.produit_id) <> 'produit_fini' then
    raise exception 'Une capacité de production porte sur un produit fini';
  end if;
  return new;
end;
$$;

create trigger capacites_verification before insert or update on public.capacites_production
  for each row execute function public.verifier_capacite();

-- ---------------------------------------------------------------------------
-- Règles d'accès : comptes, sites, capacités (l'entreprise gère les siens ; la plateforme voit tout)
-- ---------------------------------------------------------------------------

alter table public.entreprise_comptes_bancaires enable row level security;
alter table public.sites_production enable row level security;
alter table public.capacites_production enable row level security;
alter table public.produits enable row level security;
alter table public.transformations enable row level security;

create policy comptes_lecture on public.entreprise_comptes_bancaires for select to authenticated
  using (public.est_plateforme() or entreprise_id = public.mon_entreprise_id());
create policy comptes_gestion on public.entreprise_comptes_bancaires for all to authenticated
  using (public.est_admin() or entreprise_id = public.mon_entreprise_id())
  with check (public.est_admin() or entreprise_id = public.mon_entreprise_id());

create policy sites_lecture on public.sites_production for select to authenticated
  using (public.est_plateforme() or entreprise_id = public.mon_entreprise_id());
create policy sites_gestion on public.sites_production for all to authenticated
  using (public.est_admin() or entreprise_id = public.mon_entreprise_id())
  with check (public.est_admin() or entreprise_id = public.mon_entreprise_id());

create policy capacites_lecture on public.capacites_production for select to authenticated
  using (
    public.est_plateforme()
    or exists (select 1 from public.sites_production s where s.id = site_id and s.entreprise_id = public.mon_entreprise_id())
  );
create policy capacites_gestion on public.capacites_production for all to authenticated
  using (
    public.est_admin()
    or exists (select 1 from public.sites_production s where s.id = site_id and s.entreprise_id = public.mon_entreprise_id())
  )
  with check (
    public.est_admin()
    or exists (select 1 from public.sites_production s where s.id = site_id and s.entreprise_id = public.mon_entreprise_id())
  );

create policy produits_lecture on public.produits for select to authenticated
  using (public.mon_role() is not null);
create policy produits_gestion on public.produits for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

create policy transformations_lecture on public.transformations for select to authenticated
  using (public.mon_role() is not null);
create policy transformations_gestion on public.transformations for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- ---------------------------------------------------------------------------
-- Journal d'audit (écrit uniquement par triggers ; lisible par l'administrateur)
-- « sensible » : changement de compte bancaire, d'identifiant fiscal, de type ou de statut d'entreprise, de rôle ou d'état
-- d'un compte, et toute suppression — mis en avant dans le journal pour détecter une fraude (au RIB notamment).
-- ---------------------------------------------------------------------------

create table public.journal_audit (
  id bigint generated always as identity primary key,
  horodatage timestamptz not null default now(),
  auteur_id uuid,
  auteur_email text,
  table_nom text not null,
  ligne_id uuid,
  entreprise_id uuid,
  action text not null check (action in ('creation', 'modification', 'suppression')),
  champs text[],
  avant jsonb,
  apres jsonb,
  sensible boolean not null default false
);

create index journal_horodatage_idx on public.journal_audit (horodatage desc);
create index journal_entreprise_idx on public.journal_audit (entreprise_id, horodatage desc);

create or replace function public.journaliser()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_avant jsonb;
  v_apres jsonb;
  v_champs text[];
  v_id uuid;
  v_entreprise uuid;
  v_sensible boolean;
begin
  if tg_op = 'INSERT' then
    v_apres := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_avant := to_jsonb(old);
    v_apres := to_jsonb(new);
    select array_agg(k.cle order by k.cle) into v_champs
    from jsonb_object_keys(v_apres) as k (cle)
    where k.cle <> 'updated_at' and (v_apres -> k.cle) is distinct from (v_avant -> k.cle);
    if v_champs is null then
      return new;
    end if;
  else
    v_avant := to_jsonb(old);
  end if;

  v_id := coalesce(v_apres ->> 'id', v_avant ->> 'id')::uuid;
  v_entreprise := case
    when tg_table_name = 'entreprises' then v_id
    else nullif(coalesce(v_apres ->> 'entreprise_id', v_avant ->> 'entreprise_id'), '')::uuid
  end;
  v_sensible := tg_op = 'DELETE'
    or tg_table_name = 'entreprise_comptes_bancaires'
    or (tg_table_name = 'entreprises' and coalesce(v_champs && array['identifiant_fiscal', 'type', 'statut'], false))
    or (tg_table_name = 'utilisateurs' and coalesce(v_champs && array['role_base', 'actif', 'entreprise_id', 'profil_id', 'signataire'], false));

  insert into public.journal_audit (auteur_id, auteur_email, table_nom, ligne_id, entreprise_id, action, champs, avant, apres, sensible)
  values (
    auth.uid(),
    (select u.email from public.utilisateurs u where u.id = auth.uid()),
    tg_table_name,
    v_id,
    v_entreprise,
    case tg_op when 'INSERT' then 'creation' when 'UPDATE' then 'modification' else 'suppression' end,
    v_champs,
    v_avant,
    v_apres,
    v_sensible
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_entreprises after insert or update or delete on public.entreprises
  for each row execute function public.journaliser();
create trigger audit_utilisateurs after insert or update or delete on public.utilisateurs
  for each row execute function public.journaliser();
create trigger audit_profils after insert or update or delete on public.profils
  for each row execute function public.journaliser();
create trigger audit_comptes after insert or update or delete on public.entreprise_comptes_bancaires
  for each row execute function public.journaliser();
create trigger audit_sites after insert or update or delete on public.sites_production
  for each row execute function public.journaliser();
create trigger audit_produits after insert or update or delete on public.produits
  for each row execute function public.journaliser();
create trigger audit_transformations after insert or update or delete on public.transformations
  for each row execute function public.journaliser();
create trigger audit_parametres after update on public.parametres_plateforme
  for each row execute function public.journaliser();

alter table public.journal_audit enable row level security;
create policy journal_lecture on public.journal_audit for select to authenticated
  using (public.est_admin());

-- ---------------------------------------------------------------------------
-- Demandes d'accès (formulaire public) : traitées par l'administrateur, qui crée ensuite l'entreprise et les comptes
-- ---------------------------------------------------------------------------

create table public.demandes_acces (
  id uuid primary key default gen_random_uuid(),
  type_entreprise public.type_entreprise not null,
  denomination text not null check (length(trim(denomination)) between 2 and 200),
  contact_nom text not null check (length(trim(contact_nom)) between 2 and 120),
  telephone text not null check (length(trim(telephone)) between 6 and 30),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200),
  region text check (length(region) <= 80),
  message text check (length(message) <= 2000),
  statut text not null default 'nouvelle' check (statut in ('nouvelle', 'traitee', 'rejetee')),
  traitee_par uuid references auth.users (id) on delete set null,
  traitee_le timestamptz,
  created_at timestamptz not null default now()
);

create index demandes_statut_idx on public.demandes_acces (statut, created_at desc);

alter table public.demandes_acces enable row level security;
create policy demandes_depot on public.demandes_acces for insert to anon, authenticated
  with check (statut = 'nouvelle' and traitee_par is null and traitee_le is null);
create policy demandes_lecture on public.demandes_acces for select to authenticated
  using (public.est_admin());
create policy demandes_traitement on public.demandes_acces for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- ---------------------------------------------------------------------------
-- Logos des entreprises (Storage) : lecture publique (documents, place de marché) ;
-- écriture par l'administrateur ou par l'entreprise elle-même, dans son dossier <entreprise_id>/.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy logos_ecriture on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (public.est_admin() or (storage.foldername(name))[1] = public.mon_entreprise_id()::text)
  );
create policy logos_modification on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and (public.est_admin() or (storage.foldername(name))[1] = public.mon_entreprise_id()::text)
  );
create policy logos_suppression on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and (public.est_admin() or (storage.foldername(name))[1] = public.mon_entreprise_id()::text)
  );

-- ---------------------------------------------------------------------------
-- Contrats d'engagement : modèles versionnés (producteur, client) et acceptations
-- Un modèle publié est figé (son empreinte SHA-256 fait foi) ; une nouvelle version archive la précédente.
-- ---------------------------------------------------------------------------

create table public.modeles_contrat (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('producteur', 'client')),
  version text not null check (length(trim(version)) > 0),
  titre text not null,
  contenu text not null,
  statut text not null default 'brouillon' check (statut in ('brouillon', 'en_vigueur', 'archive')),
  empreinte_sha256 text,
  publie_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (type, version)
);

create unique index modeles_un_en_vigueur on public.modeles_contrat (type) where statut = 'en_vigueur';
create trigger modeles_updated_at before update on public.modeles_contrat
  for each row execute function public.maj_updated_at();

create or replace function public.figer_modele_contrat()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.statut <> 'brouillon'
    and (new.contenu is distinct from old.contenu or new.version is distinct from old.version
      or new.type is distinct from old.type or new.titre is distinct from old.titre) then
    raise exception 'Un contrat publié ne peut plus être modifié : créez une nouvelle version';
  end if;
  return new;
end;
$$;

create trigger modeles_figes before update on public.modeles_contrat
  for each row execute function public.figer_modele_contrat();

create table public.acceptations_contrat (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  modele_id uuid not null references public.modeles_contrat (id) on delete restrict,
  accepte_par uuid references auth.users (id) on delete set null,
  nom_signataire text not null,
  fonction_signataire text not null,
  accepte_le timestamptz not null default now(),
  adresse_ip text,
  agent_utilisateur text,
  -- 18 octets aléatoires → 24 caractères, sans remplissage, sûrs dans une URL (QR code du contrat accepté)
  jeton_public text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  unique (entreprise_id, modele_id)
);

create trigger audit_modeles after insert or update or delete on public.modeles_contrat
  for each row execute function public.journaliser();
create trigger audit_acceptations after insert on public.acceptations_contrat
  for each row execute function public.journaliser();

alter table public.modeles_contrat enable row level security;
alter table public.acceptations_contrat enable row level security;

create policy modeles_lecture on public.modeles_contrat for select to authenticated
  using (public.est_admin() or (statut <> 'brouillon' and public.mon_role() is not null));
create policy modeles_gestion on public.modeles_contrat for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- Pas d'insertion directe : l'acceptation passe par accepter_contrat(), qui vérifie l'habilitation du signataire.
create policy acceptations_lecture on public.acceptations_contrat for select to authenticated
  using (public.est_plateforme() or entreprise_id = public.mon_entreprise_id());

-- Publication d'une version : archive la version en vigueur du même type et fige le texte (empreinte).
create or replace function public.publier_modele_contrat(p_modele uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modele public.modeles_contrat;
begin
  if not public.est_admin() then
    raise exception 'Réservé à l''administrateur';
  end if;
  select * into v_modele from public.modeles_contrat where id = p_modele for update;
  if not found then
    raise exception 'Contrat introuvable';
  end if;
  if v_modele.statut <> 'brouillon' then
    raise exception 'Seul un brouillon peut être publié';
  end if;
  update public.modeles_contrat set statut = 'archive' where type = v_modele.type and statut = 'en_vigueur';
  update public.modeles_contrat
  set statut = 'en_vigueur',
      publie_le = now(),
      empreinte_sha256 = encode(extensions.digest(convert_to(v_modele.contenu, 'UTF8'), 'sha256'), 'hex')
  where id = p_modele;
end;
$$;

-- Une entreprise est « en règle » si elle a accepté la version en vigueur de son type, ou une version précédente
-- pendant le délai de grâce qui suit la publication d'une nouvelle version. Les banques n'ont pas de contrat.
create or replace function public.contrat_en_regle(p_entreprise uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_type public.type_entreprise;
  v_modele public.modeles_contrat;
  v_grace integer;
begin
  if not (public.est_plateforme() or p_entreprise = public.mon_entreprise_id()) then
    return null;
  end if;
  select type into v_type from public.entreprises where id = p_entreprise;
  if v_type is null then
    return null;
  end if;
  if v_type = 'banque' then
    return true;
  end if;
  select * into v_modele from public.modeles_contrat where type = v_type::text and statut = 'en_vigueur';
  if not found then
    return true; -- aucun contrat publié : rien à accepter
  end if;
  if exists (select 1 from public.acceptations_contrat where entreprise_id = p_entreprise and modele_id = v_modele.id) then
    return true;
  end if;
  select delai_grace_contrat_jours into v_grace from public.parametres_plateforme;
  return v_modele.publie_le > now() - make_interval(days => coalesce(v_grace, 0))
    and exists (
      select 1 from public.acceptations_contrat a
      join public.modeles_contrat m on m.id = a.modele_id
      where a.entreprise_id = p_entreprise and m.type = v_type::text
    );
end;
$$;

create or replace function public.accepter_contrat(
  p_modele uuid,
  p_nom_signataire text,
  p_fonction_signataire text,
  p_adresse_ip text,
  p_agent_utilisateur text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entreprise uuid := public.mon_entreprise_id();
  v_type public.type_entreprise;
  v_modele public.modeles_contrat;
  v_jeton text;
begin
  if v_entreprise is null or public.mon_role() not in ('producteur', 'client') then
    raise exception 'Seul un producteur ou un client accepte un contrat d''engagement';
  end if;
  if not (select signataire from public.utilisateurs where id = auth.uid()) then
    raise exception 'Vous n''êtes pas habilité à signer au nom de votre entreprise. Contactez l''administrateur de la plateforme.';
  end if;
  if length(trim(coalesce(p_nom_signataire, ''))) < 2 or length(trim(coalesce(p_fonction_signataire, ''))) < 2 then
    raise exception 'Indiquez le nom et la fonction du signataire';
  end if;
  select type into v_type from public.entreprises where id = v_entreprise;
  select * into v_modele from public.modeles_contrat where id = p_modele;
  if not found or v_modele.statut <> 'en_vigueur' or v_modele.type <> v_type::text then
    raise exception 'Ce contrat n''est pas la version en vigueur pour votre entreprise';
  end if;

  insert into public.acceptations_contrat (
    entreprise_id, modele_id, accepte_par, nom_signataire, fonction_signataire, adresse_ip, agent_utilisateur
  )
  values (
    v_entreprise, p_modele, auth.uid(), trim(p_nom_signataire), trim(p_fonction_signataire),
    left(p_adresse_ip, 64), left(p_agent_utilisateur, 300)
  )
  on conflict (entreprise_id, modele_id) do nothing
  returning jeton_public into v_jeton;

  if v_jeton is null then
    select jeton_public into v_jeton from public.acceptations_contrat
    where entreprise_id = v_entreprise and modele_id = p_modele;
  end if;
  return v_jeton;
end;
$$;

revoke execute on function public.publier_modele_contrat(uuid) from public, anon;
revoke execute on function public.contrat_en_regle(uuid) from public, anon;
revoke execute on function public.accepter_contrat(uuid, text, text, text, text) from public, anon;
grant execute on function public.publier_modele_contrat(uuid) to authenticated;
grant execute on function public.contrat_en_regle(uuid) to authenticated;
grant execute on function public.accepter_contrat(uuid, text, text, text, text) to authenticated;
