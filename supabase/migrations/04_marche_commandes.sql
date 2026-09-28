-- PCAS — Lot 3 : place de marché, panier, commandes (émission par le client), besoins d'achat et propositions.
-- Les commandes ne s'écrivent jamais directement : elles passent par des fonctions qui contrôlent le rôle, le contrat
-- d'engagement, les offres et les quantités, figent les prix et l'en-tête du client et tracent chaque étape.
-- Les clients ne voient des producteurs qu'une fiche publique réduite (ni stock, ni contacts) ; les producteurs ne voient
-- des besoins d'achat publics ni le nom ni les coordonnées du client.

-- ---------------------------------------------------------------------------
-- Numérotation des documents (sans trou ni doublon, par type et par année)
-- ---------------------------------------------------------------------------

create table public.sequences_numerotation (
  type text not null,
  annee integer not null,
  dernier integer not null default 0,
  primary key (type, annee)
);

alter table public.sequences_numerotation enable row level security;

create or replace function public.prochain_numero(p_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_annee integer := extract(year from now() at time zone 'Africa/Dakar')::integer;
  v_numero integer;
begin
  insert into public.sequences_numerotation as s (type, annee, dernier)
  values (p_type, v_annee, 1)
  on conflict (type, annee) do update set dernier = s.dernier + 1
  returning dernier into v_numero;
  return p_type || '-' || v_annee || '-' || lpad(v_numero::text, 6, '0');
end;
$$;

revoke execute on function public.prochain_numero(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fiches publiques (réduites) des producteurs et des banques
-- ---------------------------------------------------------------------------

create or replace function public.producteurs_publics()
returns table (id uuid, denomination text, sigle text, region text, commune text, logo_path text, membre_depuis timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.denomination, e.sigle, e.region, e.commune, e.logo_path, e.created_at
  from public.entreprises e
  where e.type = 'producteur' and e.statut = 'actif'
    and public.mon_role() in ('client', 'administrateur', 'superviseur', 'producteur')
$$;

create or replace function public.banques_publiques()
returns table (id uuid, denomination text, sigle text, logo_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.denomination, e.sigle, e.logo_path
  from public.entreprises e
  where e.type = 'banque' and e.statut = 'actif' and public.mon_role() is not null
$$;

-- ---------------------------------------------------------------------------
-- Place de marché : offres publiées, valides, avec la quantité réellement commandable.
-- Pour une offre immédiate, elle est limitée par le stock disponible du site (jamais au-delà de ce qui existe).
-- ---------------------------------------------------------------------------

create or replace function public.quantite_commandable(p_offre uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when o.disponibilite = 'immediate'
      then greatest(least(o.quantite_offerte - o.quantite_reservee, coalesce(st.quantite_disponible, 0)), 0)
    else greatest(o.quantite_offerte - o.quantite_reservee, 0)
  end
  from public.offres o
  left join public.stocks st on st.site_id = o.site_id and st.produit_id = o.produit_id
  where o.id = p_offre
$$;

create or replace function public.marche_offres()
returns table (
  id uuid,
  producteur_id uuid,
  producteur_nom text,
  producteur_logo text,
  region text,
  commune text,
  produit_id uuid,
  produit_nom text,
  categorie text,
  unite text,
  prix_unitaire bigint,
  disponibilite text,
  date_disponibilite date,
  date_fin_validite date,
  quantite_commandable numeric,
  quantite_min_commande numeric,
  variete text,
  calibre text,
  qualite text,
  conditionnement text,
  description text,
  photos text[],
  publiee_le timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.producteur_id, e.denomination, e.logo_path, s.region, s.commune,
         o.produit_id, p.nom, p.categorie, p.unite, o.prix_unitaire, o.disponibilite, o.date_disponibilite, o.date_fin_validite,
         public.quantite_commandable(o.id), o.quantite_min_commande, o.variete, o.calibre, o.qualite, o.conditionnement,
         o.description, o.photos, o.publiee_le
  from public.offres o
  join public.entreprises e on e.id = o.producteur_id
  join public.produits p on p.id = o.produit_id
  join public.sites_production s on s.id = o.site_id
  where o.statut = 'publiee'
    and e.statut = 'actif'
    and p.actif
    and (o.date_fin_validite is null or o.date_fin_validite >= current_date)
    and public.quantite_commandable(o.id) > 0
    and public.mon_role() in ('client', 'administrateur', 'superviseur')
$$;

revoke execute on function public.producteurs_publics() from public, anon;
revoke execute on function public.banques_publiques() from public, anon;
revoke execute on function public.quantite_commandable(uuid) from public, anon;
revoke execute on function public.marche_offres() from public, anon;
grant execute on function public.producteurs_publics() to authenticated;
grant execute on function public.banques_publiques() to authenticated;
grant execute on function public.quantite_commandable(uuid) to authenticated;
grant execute on function public.marche_offres() to authenticated;

-- ---------------------------------------------------------------------------
-- Panier (par utilisateur, conservé d'un appareil à l'autre)
-- ---------------------------------------------------------------------------

create table public.paniers (
  utilisateur_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  offre_id uuid not null references public.offres (id) on delete cascade,
  quantite numeric(14, 3) not null check (quantite > 0),
  ajoute_le timestamptz not null default now(),
  primary key (utilisateur_id, offre_id)
);

alter table public.paniers enable row level security;
create policy paniers_proprietaire on public.paniers for all to authenticated
  using (utilisateur_id = auth.uid() and public.mon_role() = 'client')
  with check (utilisateur_id = auth.uid() and public.mon_role() = 'client');

-- ---------------------------------------------------------------------------
-- Besoins d'achat et propositions des producteurs
-- ---------------------------------------------------------------------------

create table public.besoins_achat (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default '', -- attribué par preparer_besoin() (BES-année-n°)
  client_id uuid not null default public.mon_entreprise_id() references public.entreprises (id) on delete restrict,
  produit_id uuid not null references public.produits (id) on delete restrict,
  quantite numeric(14, 3) not null check (quantite > 0),
  prix_cible bigint check (prix_cible > 0),
  date_souhaitee date not null,
  region_livraison text,
  lieu_livraison text,
  producteur_souhaite_id uuid references public.entreprises (id) on delete set null,
  commentaire text check (length(commentaire) <= 1000),
  statut text not null default 'ouvert' check (statut in ('ouvert', 'en_traitement', 'converti', 'clos', 'annule')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create index besoins_client_idx on public.besoins_achat (client_id, created_at desc);
create index besoins_ouverts_idx on public.besoins_achat (produit_id) where statut in ('ouvert', 'en_traitement');
create trigger besoins_updated_at before update on public.besoins_achat
  for each row execute function public.maj_updated_at();

create or replace function public.preparer_besoin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.numero := public.prochain_numero('BES');
    new.client_id := public.mon_entreprise_id();
    new.statut := 'ouvert';
    if not coalesce(public.contrat_en_regle(new.client_id), false) then
      raise exception 'Votre entreprise doit accepter le contrat d''engagement avant de publier un besoin d''achat';
    end if;
    if new.date_souhaitee < current_date then
      raise exception 'La date souhaitée ne peut pas être passée';
    end if;
    if (select nature from public.produits where id = new.produit_id) <> 'produit_fini' then
      raise exception 'Un besoin d''achat porte sur un produit fini du catalogue';
    end if;
    if new.producteur_souhaite_id is not null
      and not exists (select 1 from public.entreprises where id = new.producteur_souhaite_id and type = 'producteur' and statut = 'actif') then
      raise exception 'Producteur souhaité introuvable';
    end if;
  else
    -- Le client ne modifie que le statut (annulation, clôture) et le commentaire ; les conversions passent par les fonctions.
    if new.client_id <> old.client_id or new.produit_id <> old.produit_id or new.numero <> old.numero then
      raise exception 'Ces informations d''un besoin ne se modifient pas';
    end if;
  end if;
  return new;
end;
$$;

create trigger besoins_preparation before insert or update on public.besoins_achat
  for each row execute function public.preparer_besoin();

create table public.propositions_besoin (
  id uuid primary key default gen_random_uuid(),
  besoin_id uuid not null references public.besoins_achat (id) on delete cascade,
  producteur_id uuid not null default public.mon_entreprise_id() references public.entreprises (id) on delete cascade,
  site_id uuid not null references public.sites_production (id) on delete restrict,
  offre_id uuid references public.offres (id) on delete set null,
  quantite numeric(14, 3) not null check (quantite > 0),
  prix_unitaire bigint not null check (prix_unitaire > 0),
  date_disponibilite date,
  commentaire text check (length(commentaire) <= 1000),
  statut text not null default 'proposee' check (statut in ('proposee', 'retenue', 'ecartee', 'retiree')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

create index propositions_besoin_idx on public.propositions_besoin (besoin_id);
create index propositions_producteur_idx on public.propositions_besoin (producteur_id, created_at desc);
create trigger propositions_updated_at before update on public.propositions_besoin
  for each row execute function public.maj_updated_at();

create or replace function public.preparer_proposition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_besoin public.besoins_achat;
  v_site public.sites_production;
begin
  if tg_op = 'INSERT' then
    select * into v_besoin from public.besoins_achat where id = new.besoin_id;
    if not found or v_besoin.statut not in ('ouvert', 'en_traitement') then
      raise exception 'Ce besoin d''achat n''est plus ouvert aux propositions';
    end if;
    select * into v_site from public.sites_production where id = new.site_id;
    if not found or v_site.entreprise_id <> public.mon_entreprise_id() or not v_site.actif then
      raise exception 'Choisissez un de vos sites de production actifs';
    end if;
    if v_besoin.producteur_souhaite_id is not null and v_besoin.producteur_souhaite_id <> v_site.entreprise_id then
      raise exception 'Ce besoin est adressé à un autre producteur';
    end if;
    if not coalesce(public.contrat_en_regle(v_site.entreprise_id), false) then
      raise exception 'Votre entreprise doit accepter le contrat d''engagement avant de faire une proposition';
    end if;
    if new.offre_id is not null
      and not exists (select 1 from public.offres where id = new.offre_id and producteur_id = v_site.entreprise_id and produit_id = v_besoin.produit_id) then
      raise exception 'L''offre liée doit être une de vos offres du même produit';
    end if;
    if new.date_disponibilite is not null and new.date_disponibilite < current_date then
      new.date_disponibilite := null;
    end if;
    new.producteur_id := v_site.entreprise_id;
    new.statut := 'proposee';
  elsif new.statut <> old.statut and not (old.statut = 'proposee' and new.statut = 'retiree')
    and coalesce(current_setting('pcas.circuit_commande', true), '') <> 'oui' then
    raise exception 'Une proposition ne peut qu''être retirée par son producteur';
  end if;
  return new;
end;
$$;

create trigger propositions_preparation before insert or update on public.propositions_besoin
  for each row execute function public.preparer_proposition();

alter table public.besoins_achat enable row level security;
alter table public.propositions_besoin enable row level security;

-- Besoins : le client voit et gère les siens ; la plateforme voit tout ; les producteurs passent par besoins_publics().
create policy besoins_lecture on public.besoins_achat for select to authenticated
  using (public.est_plateforme() or client_id = public.mon_entreprise_id());
create policy besoins_creation on public.besoins_achat for insert to authenticated
  with check (public.mon_role() = 'client');
create policy besoins_modification on public.besoins_achat for update to authenticated
  using ((public.mon_role() = 'client' and client_id = public.mon_entreprise_id()) or public.est_plateforme())
  with check ((public.mon_role() = 'client' and client_id = public.mon_entreprise_id()) or public.est_plateforme());

-- Propositions : le producteur les siennes ; le client celles faites sur ses besoins ; la plateforme toutes.
create policy propositions_lecture on public.propositions_besoin for select to authenticated
  using (
    public.est_plateforme()
    or producteur_id = public.mon_entreprise_id()
    or exists (select 1 from public.besoins_achat b where b.id = besoin_id and b.client_id = public.mon_entreprise_id())
  );
create policy propositions_creation on public.propositions_besoin for insert to authenticated
  with check (public.mon_role() = 'producteur');
create policy propositions_retrait on public.propositions_besoin for update to authenticated
  using (public.mon_role() = 'producteur' and producteur_id = public.mon_entreprise_id())
  with check (public.mon_role() = 'producteur' and producteur_id = public.mon_entreprise_id());

-- Besoins visibles des producteurs : sans le nom ni les coordonnées du client (seulement la région de livraison).
-- Un besoin adressé à un producteur précis n'est visible que de lui.
create or replace function public.besoins_publics()
returns table (
  id uuid,
  numero text,
  produit_id uuid,
  produit_nom text,
  unite text,
  quantite numeric,
  prix_cible bigint,
  date_souhaitee date,
  region_livraison text,
  commentaire text,
  adresse_a_moi boolean,
  mes_propositions bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.numero, b.produit_id, p.nom, p.unite, b.quantite, b.prix_cible, b.date_souhaitee, b.region_livraison, b.commentaire,
         b.producteur_souhaite_id is not null,
         (select count(*) from public.propositions_besoin pr where pr.besoin_id = b.id and pr.producteur_id = public.mon_entreprise_id()),
         b.created_at
  from public.besoins_achat b
  join public.produits p on p.id = b.produit_id
  where b.statut in ('ouvert', 'en_traitement')
    and public.mon_role() = 'producteur'
    and (b.producteur_souhaite_id is null or b.producteur_souhaite_id = public.mon_entreprise_id())
$$;

revoke execute on function public.besoins_publics() from public, anon;
grant execute on function public.besoins_publics() to authenticated;

-- ---------------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------------

create table public.commandes (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  client_id uuid not null references public.entreprises (id) on delete restrict,
  producteur_id uuid not null references public.entreprises (id) on delete restrict,
  commande_parent_id uuid references public.commandes (id) on delete set null,
  besoin_id uuid references public.besoins_achat (id) on delete set null,
  proposition_id uuid references public.propositions_besoin (id) on delete set null,
  statut text not null default 'soumise' check (statut in (
    'soumise', 'en_attente', 'approuvee', 'attente_banque', 'approuvee_banque', 'refusee_banque',
    'validee', 'refusee_producteur', 'en_livraison', 'livree_partiellement', 'livree', 'en_litige', 'receptionnee',
    'partiellement_payee', 'soldee', 'refusee', 'reorientee', 'repartie', 'annulee'
  )),
  mode_paiement text not null check (mode_paiement in ('cheque', 'virement', 'especes', 'bon_banque')),
  banque_id uuid references public.entreprises (id) on delete restrict,
  adresse_livraison text not null,
  region_livraison text,
  contact_livraison text,
  date_souhaitee date,
  date_livraison_convenue date,
  facturation_groupee boolean not null default false,
  entete_client jsonb not null,
  montant_total bigint not null default 0,
  commentaire text check (length(commentaire) <= 1000),
  motif text,
  soumise_le timestamptz not null default now(),
  approuvee_le timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  check (mode_paiement <> 'bon_banque' or banque_id is not null)
);

create index commandes_client_idx on public.commandes (client_id, soumise_le desc);
create index commandes_producteur_idx on public.commandes (producteur_id, soumise_le desc);
create index commandes_statut_idx on public.commandes (statut);
create trigger commandes_updated_at before update on public.commandes
  for each row execute function public.maj_updated_at();

create table public.lignes_commande (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commandes (id) on delete cascade,
  offre_id uuid references public.offres (id) on delete set null,
  site_id uuid not null references public.sites_production (id) on delete restrict,
  produit_id uuid not null references public.produits (id) on delete restrict,
  quantite numeric(14, 3) not null check (quantite > 0),
  prix_unitaire bigint not null check (prix_unitaire > 0),
  montant bigint not null,
  date_disponibilite date,
  quantite_livree numeric(14, 3) not null default 0,
  quantite_recue numeric(14, 3) not null default 0
);

create index lignes_commande_idx on public.lignes_commande (commande_id);

create table public.echeancier_commande (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commandes (id) on delete cascade,
  rang smallint not null,
  pourcentage numeric(5, 2) not null check (pourcentage > 0 and pourcentage <= 100),
  delai_jours integer not null check (delai_jours between 0 and 365),
  unique (commande_id, rang)
);

create table public.commande_evenements (
  id bigint generated always as identity primary key,
  commande_id uuid not null references public.commandes (id) on delete cascade,
  horodatage timestamptz not null default now(),
  acteur_id uuid,
  acteur_nom text,
  acteur_role text,
  action text not null,
  commentaire text,
  donnees jsonb
);

create index evenements_commande_idx on public.commande_evenements (commande_id, horodatage);

-- Écriture uniquement par les fonctions du circuit (aucune politique d'insertion ou de modification).
alter table public.commandes enable row level security;
alter table public.lignes_commande enable row level security;
alter table public.echeancier_commande enable row level security;
alter table public.commande_evenements enable row level security;

-- Le client voit ses commandes dès l'émission ; le producteur et la banque une fois la commande approuvée par le superviseur.
create policy commandes_lecture on public.commandes for select to authenticated
  using (
    public.est_plateforme()
    or client_id = public.mon_entreprise_id()
    or (approuvee_le is not null and (producteur_id = public.mon_entreprise_id() or banque_id = public.mon_entreprise_id()))
  );
create policy lignes_commande_lecture on public.lignes_commande for select to authenticated
  using (exists (select 1 from public.commandes c where c.id = commande_id));
create policy echeancier_lecture on public.echeancier_commande for select to authenticated
  using (exists (select 1 from public.commandes c where c.id = commande_id));
create policy evenements_lecture on public.commande_evenements for select to authenticated
  using (exists (select 1 from public.commandes c where c.id = commande_id));

-- Journal de bord d'une commande (auteur, rôle, action)
create or replace function public.tracer_commande(p_commande uuid, p_action text, p_commentaire text, p_donnees jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.commande_evenements (commande_id, acteur_id, acteur_nom, acteur_role, action, commentaire, donnees)
  select p_commande, auth.uid(), u.nom_complet, u.role_base::text, p_action, p_commentaire, p_donnees
  from (select 1) as un
  left join public.utilisateurs u on u.id = auth.uid()
$$;

revoke execute on function public.tracer_commande(uuid, text, text, jsonb) from public, anon, authenticated;

-- Création commune d'une commande « soumise » (appelée par creer_commande et retenir_proposition, qui font les contrôles
-- propres à chacune). p_lignes : [{offre_id, site_id, produit_id, quantite, prix_unitaire, date_disponibilite}] ;
-- p_echeancier : [{pourcentage, delai_jours}] dont la somme fait 100 %.
create or replace function public.inserer_commande(
  p_producteur uuid,
  p_lignes jsonb,
  p_mode_paiement text,
  p_banque uuid,
  p_adresse text,
  p_region text,
  p_contact text,
  p_date_souhaitee date,
  p_echeancier jsonb,
  p_commentaire text,
  p_besoin uuid,
  p_proposition uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client uuid := public.mon_entreprise_id();
  v_entreprise public.entreprises;
  v_commande uuid;
  v_ligne jsonb;
  v_total bigint := 0;
  v_montant bigint;
  v_somme numeric := 0;
  v_rang integer := 0;
begin
  if public.mon_role() <> 'client' or v_client is null then
    raise exception 'Seul un client peut passer commande';
  end if;
  if not coalesce(public.contrat_en_regle(v_client), false) then
    raise exception 'Votre entreprise doit accepter le contrat d''engagement avant de commander';
  end if;
  if p_mode_paiement not in ('cheque', 'virement', 'especes', 'bon_banque') then
    raise exception 'Mode de paiement inconnu';
  end if;
  if p_mode_paiement = 'bon_banque'
    and not exists (select 1 from public.entreprises where id = p_banque and type = 'banque' and statut = 'actif') then
    raise exception 'Choisissez la banque qui émettra le bon de paiement';
  end if;
  if length(trim(coalesce(p_adresse, ''))) < 3 then
    raise exception 'Indiquez l''adresse de livraison';
  end if;
  if p_date_souhaitee is not null and p_date_souhaitee < current_date then
    raise exception 'La date de livraison souhaitée ne peut pas être passée';
  end if;
  if jsonb_array_length(coalesce(p_echeancier, '[]'::jsonb)) not between 1 and 6 then
    raise exception 'L''échéancier comporte de 1 à 6 échéances';
  end if;
  select coalesce(sum((e ->> 'pourcentage')::numeric), 0) into v_somme from jsonb_array_elements(p_echeancier) e;
  if v_somme <> 100 then
    raise exception 'Les échéances doivent totaliser 100 %% (actuellement % %%)', v_somme;
  end if;
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) = 0 then
    raise exception 'La commande ne comporte aucune ligne';
  end if;

  select * into v_entreprise from public.entreprises where id = v_client;

  insert into public.commandes (
    numero, client_id, producteur_id, besoin_id, proposition_id, statut, mode_paiement, banque_id,
    adresse_livraison, region_livraison, contact_livraison, date_souhaitee, entete_client, commentaire
  )
  values (
    public.prochain_numero('CMD'), v_client, p_producteur, p_besoin, p_proposition, 'soumise', p_mode_paiement,
    case when p_mode_paiement = 'bon_banque' then p_banque end,
    trim(p_adresse), nullif(trim(coalesce(p_region, '')), ''), nullif(trim(coalesce(p_contact, '')), ''), p_date_souhaitee,
    jsonb_build_object(
      'denomination', v_entreprise.denomination, 'sigle', v_entreprise.sigle, 'adresse', v_entreprise.adresse,
      'commune', v_entreprise.commune, 'region', v_entreprise.region, 'telephone', v_entreprise.telephone,
      'email', v_entreprise.email, 'type_identifiant', v_entreprise.type_identifiant,
      'identifiant_fiscal', v_entreprise.identifiant_fiscal, 'rccm', v_entreprise.rccm,
      'representant_legal', v_entreprise.representant_legal, 'logo_path', v_entreprise.logo_path
    ),
    nullif(trim(coalesce(p_commentaire, '')), '')
  )
  returning id into v_commande;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    v_montant := round((v_ligne ->> 'quantite')::numeric * (v_ligne ->> 'prix_unitaire')::bigint);
    v_total := v_total + v_montant;
    insert into public.lignes_commande (commande_id, offre_id, site_id, produit_id, quantite, prix_unitaire, montant, date_disponibilite)
    values (
      v_commande, nullif(v_ligne ->> 'offre_id', '')::uuid, (v_ligne ->> 'site_id')::uuid, (v_ligne ->> 'produit_id')::uuid,
      (v_ligne ->> 'quantite')::numeric, (v_ligne ->> 'prix_unitaire')::bigint, v_montant, nullif(v_ligne ->> 'date_disponibilite', '')::date
    );
  end loop;

  for v_ligne in select * from jsonb_array_elements(p_echeancier) loop
    v_rang := v_rang + 1;
    insert into public.echeancier_commande (commande_id, rang, pourcentage, delai_jours)
    values (v_commande, v_rang, (v_ligne ->> 'pourcentage')::numeric, (v_ligne ->> 'delai_jours')::integer);
  end loop;

  update public.commandes set montant_total = v_total where id = v_commande;
  perform public.tracer_commande(v_commande, 'soumise', nullif(trim(coalesce(p_commentaire, '')), ''), jsonb_build_object('montant_total', v_total));
  return v_commande;
end;
$$;

revoke execute on function public.inserer_commande(uuid, jsonb, text, uuid, text, text, text, date, jsonb, text, uuid, uuid)
  from public, anon, authenticated;

-- Commande sur des offres de la place de marché (un producteur par commande). p_lignes : [{offre_id, quantite}].
create or replace function public.creer_commande(
  p_producteur uuid,
  p_lignes jsonb,
  p_mode_paiement text,
  p_banque uuid,
  p_adresse text,
  p_region text,
  p_contact text,
  p_date_souhaitee date,
  p_echeancier jsonb,
  p_commentaire text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ligne jsonb;
  v_offre public.offres;
  v_quantite numeric;
  v_commandable numeric;
  v_produit text;
  v_lignes jsonb := '[]'::jsonb;
  v_vues uuid[] := '{}';
begin
  for v_ligne in select * from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    select * into v_offre from public.offres where id = (v_ligne ->> 'offre_id')::uuid;
    if not found or v_offre.statut <> 'publiee' or v_offre.producteur_id <> p_producteur
      or (v_offre.date_fin_validite is not null and v_offre.date_fin_validite < current_date) then
      raise exception 'Une offre de votre panier n''est plus disponible : retirez-la avant de commander';
    end if;
    if v_offre.id = any (v_vues) then
      raise exception 'Une même offre apparaît deux fois dans la commande';
    end if;
    v_vues := v_vues || v_offre.id;
    select nom into v_produit from public.produits where id = v_offre.produit_id;
    v_quantite := (v_ligne ->> 'quantite')::numeric;
    if v_quantite is null or v_quantite <= 0 then
      raise exception 'Quantité invalide pour « % »', v_produit;
    end if;
    if v_offre.quantite_min_commande is not null and v_quantite < v_offre.quantite_min_commande then
      raise exception 'Quantité minimale pour « % » : %', v_produit, v_offre.quantite_min_commande;
    end if;
    v_commandable := public.quantite_commandable(v_offre.id);
    if v_quantite > v_commandable then
      raise exception 'Quantité demandée pour « % » supérieure à la quantité disponible (%)', v_produit, v_commandable;
    end if;
    v_lignes := v_lignes || jsonb_build_object(
      'offre_id', v_offre.id, 'site_id', v_offre.site_id, 'produit_id', v_offre.produit_id, 'quantite', v_quantite,
      'prix_unitaire', v_offre.prix_unitaire, 'date_disponibilite', v_offre.date_disponibilite
    );
  end loop;

  return public.inserer_commande(
    p_producteur, v_lignes, p_mode_paiement, p_banque, p_adresse, p_region, p_contact, p_date_souhaitee, p_echeancier, p_commentaire, null, null
  );
end;
$$;

-- Le client retient la proposition d'un producteur sur son besoin d'achat : commande « soumise » au prix proposé.
create or replace function public.retenir_proposition(
  p_proposition uuid,
  p_quantite numeric,
  p_mode_paiement text,
  p_banque uuid,
  p_adresse text,
  p_region text,
  p_contact text,
  p_date_souhaitee date,
  p_echeancier jsonb,
  p_commentaire text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposition public.propositions_besoin;
  v_besoin public.besoins_achat;
  v_commande uuid;
  v_retenu numeric;
begin
  select * into v_proposition from public.propositions_besoin where id = p_proposition for update;
  if not found or v_proposition.statut <> 'proposee' then
    raise exception 'Cette proposition n''est plus disponible';
  end if;
  select * into v_besoin from public.besoins_achat where id = v_proposition.besoin_id for update;
  if v_besoin.client_id is distinct from public.mon_entreprise_id() or public.mon_role() <> 'client' then
    raise exception 'Seul le client auteur du besoin peut retenir une proposition';
  end if;
  if v_besoin.statut not in ('ouvert', 'en_traitement') then
    raise exception 'Ce besoin d''achat n''est plus ouvert';
  end if;
  if coalesce(p_quantite, 0) <= 0 or p_quantite > v_proposition.quantite then
    raise exception 'La quantité retenue doit être comprise entre 0 et la quantité proposée (%)', v_proposition.quantite;
  end if;

  v_commande := public.inserer_commande(
    v_proposition.producteur_id,
    jsonb_build_array(jsonb_build_object(
      'offre_id', v_proposition.offre_id, 'site_id', v_proposition.site_id, 'produit_id', v_besoin.produit_id,
      'quantite', p_quantite, 'prix_unitaire', v_proposition.prix_unitaire, 'date_disponibilite', v_proposition.date_disponibilite
    )),
    p_mode_paiement, p_banque, p_adresse, p_region, p_contact, p_date_souhaitee, p_echeancier, p_commentaire,
    v_besoin.id, v_proposition.id
  );

  perform set_config('pcas.circuit_commande', 'oui', true);
  update public.propositions_besoin set statut = 'retenue' where id = p_proposition;
  select coalesce(sum(l.quantite), 0) into v_retenu
  from public.commandes c join public.lignes_commande l on l.commande_id = c.id
  where c.besoin_id = v_besoin.id and c.statut not in ('annulee', 'refusee');
  update public.besoins_achat
  set statut = case when v_retenu >= v_besoin.quantite then 'converti' else 'en_traitement' end
  where id = v_besoin.id;
  perform set_config('pcas.circuit_commande', '', true);
  return v_commande;
end;
$$;

-- Annulation par le client, tant que la commande n'a pas été approuvée.
create or replace function public.annuler_commande(p_commande uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
begin
  select * into v_commande from public.commandes where id = p_commande for update;
  if not found or v_commande.client_id is distinct from public.mon_entreprise_id() or public.mon_role() <> 'client' then
    raise exception 'Commande introuvable';
  end if;
  if v_commande.statut not in ('soumise', 'en_attente') then
    raise exception 'Une commande approuvée ne peut plus être annulée par le client : contactez le superviseur';
  end if;
  update public.commandes set statut = 'annulee', motif = nullif(trim(coalesce(p_motif, '')), '') where id = p_commande;
  perform public.tracer_commande(p_commande, 'annulee', nullif(trim(coalesce(p_motif, '')), ''), null);
  if v_commande.proposition_id is not null then
    perform set_config('pcas.circuit_commande', 'oui', true);
    update public.propositions_besoin set statut = 'proposee' where id = v_commande.proposition_id;
    update public.besoins_achat set statut = 'en_traitement' where id = v_commande.besoin_id and statut = 'converti';
    perform set_config('pcas.circuit_commande', '', true);
  end if;
end;
$$;

revoke execute on function public.creer_commande(uuid, jsonb, text, uuid, text, text, text, date, jsonb, text) from public, anon;
revoke execute on function public.retenir_proposition(uuid, numeric, text, uuid, text, text, text, date, jsonb, text) from public, anon;
revoke execute on function public.annuler_commande(uuid, text) from public, anon;
grant execute on function public.creer_commande(uuid, jsonb, text, uuid, text, text, text, date, jsonb, text) to authenticated;
grant execute on function public.retenir_proposition(uuid, numeric, text, uuid, text, text, text, date, jsonb, text) to authenticated;
grant execute on function public.annuler_commande(uuid, text) to authenticated;
