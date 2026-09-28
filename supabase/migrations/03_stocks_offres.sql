-- PCAS — Lot 2 : stocks et offres des producteurs.
-- Grand livre des mouvements de stock (append-only) et stocks tenus à jour par trigger, jamais négatifs ;
-- offres de produits finis immédiates (adossées au stock) ou à date (plafonnées par la capacité de production) ;
-- déclarations de production des offres à date ; photos des offres (Storage).
-- La matière première et les stocks ne sont visibles que du producteur et de la plateforme, jamais des clients.

-- ---------------------------------------------------------------------------
-- Stocks (cache par site et par produit) et mouvements
-- ---------------------------------------------------------------------------

create table public.stocks (
  site_id uuid not null references public.sites_production (id) on delete restrict,
  produit_id uuid not null references public.produits (id) on delete restrict,
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  quantite_physique numeric(14, 3) not null default 0,
  quantite_reservee numeric(14, 3) not null default 0,
  quantite_disponible numeric(14, 3) generated always as (quantite_physique - quantite_reservee) stored,
  updated_at timestamptz not null default now(),
  primary key (site_id, produit_id),
  constraint stock_jamais_negatif check (quantite_physique >= 0 and quantite_reservee >= 0 and quantite_physique >= quantite_reservee)
);

create index stocks_entreprise_idx on public.stocks (entreprise_id);

create table public.mouvements_stock (
  id uuid primary key default gen_random_uuid(),
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  site_id uuid not null references public.sites_production (id) on delete restrict,
  produit_id uuid not null references public.produits (id) on delete restrict,
  type text not null check (type in ('entree', 'sortie', 'ajustement', 'reservation', 'liberation')),
  motif text not null check (motif in (
    'recolte', 'achat', 'production', 'transformation', 'perte', 'don', 'inventaire', 'livraison', 'reservation', 'liberation', 'autre'
  )),
  -- Toujours positive, sauf pour un ajustement d'inventaire (écart signé).
  quantite numeric(14, 3) not null check (quantite <> 0),
  date_mouvement date not null default current_date,
  reference_type text,
  reference_id uuid,
  commentaire text check (length(commentaire) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  check (type = 'ajustement' or quantite > 0)
);

create index mouvements_entreprise_idx on public.mouvements_stock (entreprise_id, created_at desc);
create index mouvements_site_produit_idx on public.mouvements_stock (site_id, produit_id, created_at desc);

-- Avant insertion : l'entreprise est celle du site (jamais saisie par l'utilisateur), le site doit être actif.
create or replace function public.preparer_mouvement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_site public.sites_production;
begin
  select * into v_site from public.sites_production where id = new.site_id;
  if not found then
    raise exception 'Site de production introuvable';
  end if;
  if not v_site.actif and new.type in ('entree', 'reservation') then
    raise exception 'Le site « % » est inactif', v_site.nom;
  end if;
  if not exists (select 1 from public.produits where id = new.produit_id) then
    raise exception 'Produit introuvable';
  end if;
  new.entreprise_id := v_site.entreprise_id;
  new.created_by := coalesce(new.created_by, auth.uid());
  return new;
end;
$$;

create trigger mouvements_preparation before insert on public.mouvements_stock
  for each row execute function public.preparer_mouvement();

-- Après insertion : mise à jour du stock. La contrainte stock_jamais_negatif refuse toute sortie ou réservation
-- supérieure au disponible — y compris quand deux utilisateurs agissent en même temps (verrou de ligne implicite).
create or replace function public.appliquer_mouvement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_physique numeric := case new.type when 'entree' then new.quantite when 'sortie' then -new.quantite when 'ajustement' then new.quantite else 0 end;
  v_reserve numeric := case new.type when 'reservation' then new.quantite when 'liberation' then -new.quantite else 0 end;
  v_produit text;
begin
  insert into public.stocks as s (site_id, produit_id, entreprise_id, quantite_physique, quantite_reservee)
  values (new.site_id, new.produit_id, new.entreprise_id, v_physique, v_reserve)
  on conflict (site_id, produit_id) do update
    set quantite_physique = s.quantite_physique + v_physique,
        quantite_reservee = s.quantite_reservee + v_reserve,
        updated_at = now();
  return new;
exception
  when check_violation then
    select nom into v_produit from public.produits where id = new.produit_id;
    raise exception 'Stock insuffisant pour « % » sur ce site : l''opération rendrait le stock (ou le disponible) négatif', v_produit;
end;
$$;

create trigger mouvements_application after insert on public.mouvements_stock
  for each row execute function public.appliquer_mouvement();

alter table public.stocks enable row level security;
alter table public.mouvements_stock enable row level security;

create policy stocks_lecture on public.stocks for select to authenticated
  using (public.est_plateforme() or entreprise_id = public.mon_entreprise_id());

-- Grand livre : lecture par le producteur et la plateforme ; saisie par le producteur (entrées, sorties, inventaires).
-- Les réservations et libérations ne sont passées que par les fonctions du circuit de commande (lot 6).
-- Pas de modification ni de suppression : une erreur se corrige par un mouvement inverse.
create policy mouvements_lecture on public.mouvements_stock for select to authenticated
  using (public.est_plateforme() or entreprise_id = public.mon_entreprise_id());
create policy mouvements_saisie on public.mouvements_stock for insert to authenticated
  with check (
    public.mon_role() = 'producteur'
    and entreprise_id = public.mon_entreprise_id()
    and type in ('entree', 'sortie', 'ajustement')
    and motif not in ('livraison', 'reservation', 'liberation')
  );

-- Transformation : sortie de matière première et entrée de produit fini, dans une seule transaction.
create or replace function public.transformer(
  p_site uuid,
  p_matiere uuid,
  p_quantite_matiere numeric,
  p_produit uuid,
  p_quantite_produit numeric,
  p_date date,
  p_commentaire text
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (select nature from public.produits where id = p_matiere) <> 'matiere_premiere' then
    raise exception 'Choisissez une matière première à transformer';
  end if;
  if (select nature from public.produits where id = p_produit) <> 'produit_fini' then
    raise exception 'Choisissez le produit fini obtenu';
  end if;
  if coalesce(p_quantite_matiere, 0) <= 0 or coalesce(p_quantite_produit, 0) <= 0 then
    raise exception 'Les quantités doivent être supérieures à zéro';
  end if;
  insert into public.mouvements_stock (site_id, produit_id, type, motif, quantite, date_mouvement, commentaire)
  values (p_site, p_matiere, 'sortie', 'transformation', p_quantite_matiere, coalesce(p_date, current_date), p_commentaire);
  insert into public.mouvements_stock (site_id, produit_id, type, motif, quantite, date_mouvement, commentaire)
  values (p_site, p_produit, 'entree', 'transformation', p_quantite_produit, coalesce(p_date, current_date), p_commentaire);
end;
$$;

-- Inventaire : la quantité comptée remplace le stock physique (mouvement d'ajustement de l'écart).
create or replace function public.inventorier(p_site uuid, p_produit uuid, p_quantite_comptee numeric, p_commentaire text)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_actuel numeric;
  v_ecart numeric;
begin
  if p_quantite_comptee is null or p_quantite_comptee < 0 then
    raise exception 'La quantité comptée doit être positive ou nulle';
  end if;
  select quantite_physique into v_actuel from public.stocks where site_id = p_site and produit_id = p_produit for update;
  v_ecart := p_quantite_comptee - coalesce(v_actuel, 0);
  if v_ecart <> 0 then
    insert into public.mouvements_stock (site_id, produit_id, type, motif, quantite, commentaire)
    values (p_site, p_produit, 'ajustement', 'inventaire', v_ecart, p_commentaire);
  end if;
  return v_ecart;
end;
$$;

-- ---------------------------------------------------------------------------
-- Capacité de production sur une période (utilisée pour plafonner les offres à date, et au lot 4 pour l'analyse)
-- Somme, sur les sites actifs du producteur, de capacité/jour × jours ouvrés entre aujourd'hui et la date.
-- ---------------------------------------------------------------------------

create or replace function public.capacite_periode(p_entreprise uuid, p_produit uuid, p_date date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not (public.est_plateforme() or p_entreprise = public.mon_entreprise_id()) then null
    else coalesce(sum(c.capacite_jour * floor(greatest(p_date - current_date, 0) * s.jours_ouvres_semaine / 7.0)), 0)
  end
  from public.sites_production s
  join public.capacites_production c on c.site_id = s.id and c.produit_id = p_produit
  where s.entreprise_id = p_entreprise and s.actif
$$;

revoke execute on function public.capacite_periode(uuid, uuid, date) from public, anon;
grant execute on function public.capacite_periode(uuid, uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Offres de produits finis
-- ---------------------------------------------------------------------------

create table public.offres (
  id uuid primary key default gen_random_uuid(),
  producteur_id uuid not null references public.entreprises (id) on delete cascade,
  site_id uuid not null references public.sites_production (id) on delete restrict,
  produit_id uuid not null references public.produits (id) on delete restrict,
  -- Déduite de la date de disponibilité : immédiate (sans date ou date passée), court terme (≤ 90 jours), moyen terme.
  disponibilite text not null default 'immediate' check (disponibilite in ('immediate', 'court_terme', 'moyen_terme')),
  date_disponibilite date,
  date_fin_validite date,
  prix_unitaire bigint not null check (prix_unitaire > 0),
  quantite_offerte numeric(14, 3) not null check (quantite_offerte > 0),
  quantite_reservee numeric(14, 3) not null default 0,
  quantite_min_commande numeric(14, 3) check (quantite_min_commande > 0),
  variete text,
  calibre text,
  qualite text,
  conditionnement text,
  description text check (length(description) <= 2000),
  photos text[] not null default '{}',
  statut text not null default 'brouillon' check (statut in ('brouillon', 'publiee', 'suspendue', 'epuisee')),
  publiee_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint offre_reservation_bornee check (quantite_reservee >= 0 and quantite_reservee <= quantite_offerte),
  constraint offre_minimum_coherent check (quantite_min_commande is null or quantite_min_commande <= quantite_offerte),
  constraint offre_photos_limite check (cardinality(photos) <= 6)
);

create index offres_producteur_idx on public.offres (producteur_id, statut);
create index offres_publiees_idx on public.offres (produit_id, statut) where statut = 'publiee';

create trigger offres_updated_at before update on public.offres
  for each row execute function public.maj_updated_at();

create or replace function public.verifier_offre()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_site public.sites_production;
  v_produit public.produits;
  v_stock numeric;
  v_engage numeric;
  v_capacite numeric;
begin
  select * into v_site from public.sites_production where id = new.site_id;
  if not found then
    raise exception 'Site de production introuvable';
  end if;
  new.producteur_id := v_site.entreprise_id;

  select * into v_produit from public.produits where id = new.produit_id;
  if v_produit.nature <> 'produit_fini' then
    raise exception 'Une offre porte sur un produit fini (la matière première n''est jamais proposée aux clients)';
  end if;

  -- La quantité réservée n'est modifiée que par le circuit de commande (lot 6), qui pose ce drapeau de transaction.
  if tg_op = 'INSERT' then
    new.quantite_reservee := 0;
  elsif new.quantite_reservee is distinct from old.quantite_reservee
    and coalesce(current_setting('pcas.circuit_commande', true), '') <> 'oui' then
    raise exception 'La quantité réservée d''une offre ne se modifie pas directement';
  end if;

  if new.date_disponibilite is null or new.date_disponibilite <= current_date then
    new.disponibilite := 'immediate';
    new.date_disponibilite := null;
  elsif new.date_disponibilite <= current_date + 90 then
    new.disponibilite := 'court_terme';
  else
    new.disponibilite := 'moyen_terme';
  end if;

  if new.date_fin_validite is not null
    and (new.date_fin_validite < current_date or new.date_fin_validite < coalesce(new.date_disponibilite, current_date)) then
    raise exception 'La fin de validité doit être postérieure à aujourd''hui et à la date de disponibilité';
  end if;

  if new.statut = 'publiee' then
    if not v_produit.actif then
      raise exception 'Le produit « % » n''est plus proposé au catalogue', v_produit.nom;
    end if;
    if not v_site.actif then
      raise exception 'Le site « % » est inactif', v_site.nom;
    end if;
    -- Contrat d'engagement : condition de publication pour le producteur (la plateforme peut modérer sans cette condition).
    if not public.est_plateforme() and not coalesce(public.contrat_en_regle(new.producteur_id), false) then
      raise exception 'Votre entreprise doit accepter le contrat d''engagement avant de publier une offre';
    end if;

    if new.disponibilite = 'immediate' then
      -- Offre immédiate : ce qui reste à vendre sur l'ensemble des offres immédiates publiées de ce produit et de ce site
      -- ne peut pas dépasser le stock disponible.
      select coalesce(quantite_disponible, 0) into v_stock from public.stocks where site_id = new.site_id and produit_id = new.produit_id;
      select coalesce(sum(quantite_offerte - quantite_reservee), 0) into v_engage
      from public.offres
      where site_id = new.site_id and produit_id = new.produit_id and statut = 'publiee' and disponibilite = 'immediate' and id <> new.id;
      if v_engage + (new.quantite_offerte - new.quantite_reservee) > coalesce(v_stock, 0) then
        raise exception 'Offre immédiate supérieure au stock disponible : % % disponibles pour « % » sur ce site, dont % déjà proposés dans d''autres offres',
          coalesce(v_stock, 0), v_produit.unite, v_produit.nom, v_engage;
      end if;
    else
      -- Offre à date : l'ensemble des offres à date publiées de ce produit disponibles au plus tard à cette date
      -- ne peut pas dépasser la capacité de production d'ici là.
      v_capacite := public.capacite_periode(new.producteur_id, new.produit_id, new.date_disponibilite);
      if coalesce(v_capacite, 0) = 0 then
        raise exception 'Déclarez d''abord la capacité de production de « % » sur vos sites (fiche entreprise › sites de production)', v_produit.nom;
      end if;
      select coalesce(sum(quantite_offerte), 0) into v_engage
      from public.offres
      where producteur_id = new.producteur_id and produit_id = new.produit_id and statut = 'publiee'
        and disponibilite <> 'immediate' and date_disponibilite <= new.date_disponibilite and id <> new.id;
      if v_engage + new.quantite_offerte > v_capacite then
        raise exception 'Offre supérieure à la capacité de production : % % produisibles d''ici le %, dont % déjà proposés dans d''autres offres à date',
          v_capacite, v_produit.unite, to_char(new.date_disponibilite, 'DD/MM/YYYY'), v_engage;
      end if;
    end if;

    if tg_op = 'INSERT' or old.statut <> 'publiee' then
      new.publiee_le := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger offres_verification before insert or update on public.offres
  for each row execute function public.verifier_offre();

create trigger audit_offres after insert or update or delete on public.offres
  for each row execute function public.journaliser();

alter table public.offres enable row level security;

-- Lecture : le producteur ses offres, la plateforme toutes, les clients les offres publiées (place de marché, lot 3).
create policy offres_lecture on public.offres for select to authenticated
  using (
    public.est_plateforme()
    or producteur_id = public.mon_entreprise_id()
    or (statut = 'publiee' and public.mon_role() = 'client')
  );
create policy offres_creation on public.offres for insert to authenticated
  with check (public.mon_role() = 'producteur' and producteur_id = public.mon_entreprise_id());
-- Modification : le producteur ses offres ; l'administrateur peut modérer (suspendre) une offre.
create policy offres_modification on public.offres for update to authenticated
  using ((public.mon_role() = 'producteur' and producteur_id = public.mon_entreprise_id()) or public.est_admin())
  with check ((public.mon_role() = 'producteur' and producteur_id = public.mon_entreprise_id()) or public.est_admin());
-- Suppression : seulement un brouillon (une offre publiée a pu être vue ou commandée : on la suspend).
create policy offres_suppression on public.offres for delete to authenticated
  using (public.mon_role() = 'producteur' and producteur_id = public.mon_entreprise_id() and statut = 'brouillon');

-- ---------------------------------------------------------------------------
-- Déclarations de production (offres à date) : entrée en stock du produit fini réalisé
-- ---------------------------------------------------------------------------

create table public.declarations_production (
  id uuid primary key default gen_random_uuid(),
  offre_id uuid not null references public.offres (id) on delete restrict,
  entreprise_id uuid not null references public.entreprises (id) on delete cascade,
  mouvement_id uuid not null references public.mouvements_stock (id) on delete restrict,
  quantite numeric(14, 3) not null check (quantite > 0),
  date_production date not null default current_date,
  commentaire text check (length(commentaire) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

create index declarations_offre_idx on public.declarations_production (offre_id);

alter table public.declarations_production enable row level security;
create policy declarations_lecture on public.declarations_production for select to authenticated
  using (public.est_plateforme() or entreprise_id = public.mon_entreprise_id());
create policy declarations_saisie on public.declarations_production for insert to authenticated
  with check (public.mon_role() = 'producteur' and entreprise_id = public.mon_entreprise_id());

create or replace function public.declarer_production(p_offre uuid, p_quantite numeric, p_date date, p_commentaire text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_offre public.offres;
  v_mouvement uuid;
begin
  select * into v_offre from public.offres where id = p_offre;
  if not found or v_offre.producteur_id is distinct from public.mon_entreprise_id() then
    raise exception 'Offre introuvable';
  end if;
  if coalesce(p_quantite, 0) <= 0 then
    raise exception 'La quantité produite doit être supérieure à zéro';
  end if;
  if coalesce(p_date, current_date) > current_date then
    raise exception 'On ne déclare qu''une production déjà réalisée';
  end if;
  insert into public.mouvements_stock (site_id, produit_id, type, motif, quantite, date_mouvement, reference_type, reference_id, commentaire)
  values (v_offre.site_id, v_offre.produit_id, 'entree', 'production', p_quantite, coalesce(p_date, current_date), 'offre', p_offre, p_commentaire)
  returning id into v_mouvement;
  insert into public.declarations_production (offre_id, entreprise_id, mouvement_id, quantite, date_production, commentaire)
  values (p_offre, v_offre.producteur_id, v_mouvement, p_quantite, coalesce(p_date, current_date), p_commentaire);
end;
$$;

revoke execute on function public.transformer(uuid, uuid, numeric, uuid, numeric, date, text) from public, anon;
revoke execute on function public.inventorier(uuid, uuid, numeric, text) from public, anon;
revoke execute on function public.declarer_production(uuid, numeric, date, text) from public, anon;
grant execute on function public.transformer(uuid, uuid, numeric, uuid, numeric, date, text) to authenticated;
grant execute on function public.inventorier(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.declarer_production(uuid, numeric, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Photos des offres (Storage) : lecture publique, écriture par le producteur dans son dossier <entreprise_id>/
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('offres', 'offres', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy offres_photos_ecriture on storage.objects for insert to authenticated
  with check (bucket_id = 'offres' and (storage.foldername(name))[1] = public.mon_entreprise_id()::text);
create policy offres_photos_modification on storage.objects for update to authenticated
  using (bucket_id = 'offres' and (storage.foldername(name))[1] = public.mon_entreprise_id()::text);
create policy offres_photos_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'offres' and ((storage.foldername(name))[1] = public.mon_entreprise_id()::text or public.est_admin()));
