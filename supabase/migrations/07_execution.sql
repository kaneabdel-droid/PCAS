-- PCAS — Lot 6 : exécution de la commande.
-- Validation par le producteur (réservation du stock ou de l'offre à date), bons de livraison et factures provisoires,
-- bons de réception (corrections, contestation, réception tacite, arbitrage), factures définitives (par réception ou
-- regroupées), échéances et paiements, clôture. Toute écriture passe par des fonctions ; les tables ne sont que lisibles,
-- par les parties qui voient la commande.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Ligne dont le stock a été réservé à la validation (offre immédiate, ou proposition disponible maintenant).
alter table public.lignes_commande add column reserve_stock boolean not null default false;

create table public.bons_livraison (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  commande_id uuid not null references public.commandes (id) on delete restrict,
  producteur_id uuid not null references public.entreprises (id) on delete restrict,
  client_id uuid not null references public.entreprises (id) on delete restrict,
  date_livraison date not null default current_date,
  transporteur text,
  immatriculation text,
  chauffeur text,
  commentaire text check (length(commentaire) <= 1000),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid()
);

create index bl_commande_idx on public.bons_livraison (commande_id);
create index bl_producteur_idx on public.bons_livraison (producteur_id, created_at desc);
create index bl_client_idx on public.bons_livraison (client_id, created_at desc);

create table public.bl_lignes (
  id uuid primary key default gen_random_uuid(),
  bl_id uuid not null references public.bons_livraison (id) on delete cascade,
  ligne_commande_id uuid not null references public.lignes_commande (id) on delete restrict,
  produit_id uuid not null references public.produits (id) on delete restrict,
  site_id uuid not null references public.sites_production (id) on delete restrict,
  quantite numeric(14, 3) not null check (quantite > 0),
  prix_unitaire bigint not null
);

create index bl_lignes_bl_idx on public.bl_lignes (bl_id);

create table public.bons_reception (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  bl_id uuid not null unique references public.bons_livraison (id) on delete restrict,
  commande_id uuid not null references public.commandes (id) on delete restrict,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'approuve', 'approuve_avec_reserves', 'tacite', 'en_litige', 'arbitre')),
  date_limite timestamptz not null,
  receptionne_par uuid references auth.users (id) on delete set null,
  receptionne_le timestamptz,
  commentaire text check (length(commentaire) <= 1000),
  motif_litige text check (length(motif_litige) <= 1000),
  arbitre_par uuid references auth.users (id) on delete set null,
  arbitre_le timestamptz,
  commentaire_arbitrage text check (length(commentaire_arbitrage) <= 1000),
  created_at timestamptz not null default now()
);

create index br_commande_idx on public.bons_reception (commande_id);
create index br_en_attente_idx on public.bons_reception (date_limite) where statut = 'en_attente';

create table public.br_lignes (
  id uuid primary key default gen_random_uuid(),
  br_id uuid not null references public.bons_reception (id) on delete cascade,
  bl_ligne_id uuid not null unique references public.bl_lignes (id) on delete restrict,
  quantite_livree numeric(14, 3) not null,
  quantite_recue numeric(14, 3) not null check (quantite_recue >= 0),
  motif_ecart text check (length(motif_ecart) <= 500),
  check (quantite_recue <= quantite_livree)
);

create table public.factures (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  nature text not null check (nature in ('provisoire', 'definitive')),
  commande_id uuid not null references public.commandes (id) on delete restrict,
  bl_id uuid references public.bons_livraison (id) on delete restrict,
  producteur_id uuid not null references public.entreprises (id) on delete restrict,
  client_id uuid not null references public.entreprises (id) on delete restrict,
  date_facture date not null default current_date,
  montant_total bigint not null default 0,
  statut text not null check (statut in ('provisoire', 'receptionnee', 'remplacee', 'definitive', 'partiellement_payee', 'payee', 'annulee')),
  compte_bancaire jsonb,
  mention_tva text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  check ((nature = 'provisoire') = (bl_id is not null))
);

create index factures_commande_idx on public.factures (commande_id);
create index factures_producteur_idx on public.factures (producteur_id, created_at desc);
create index factures_client_idx on public.factures (client_id, created_at desc);

create table public.lignes_facture (
  id uuid primary key default gen_random_uuid(),
  facture_id uuid not null references public.factures (id) on delete cascade,
  bl_ligne_id uuid references public.bl_lignes (id) on delete restrict,
  produit_id uuid not null references public.produits (id) on delete restrict,
  quantite numeric(14, 3) not null check (quantite > 0),
  prix_unitaire bigint not null,
  montant bigint not null
);

create index lignes_facture_idx on public.lignes_facture (facture_id);

-- Une facture définitive remplace une ou plusieurs factures provisoires de la même commande.
create table public.factures_definitives_provisoires (
  facture_definitive_id uuid not null references public.factures (id) on delete cascade,
  facture_provisoire_id uuid not null unique references public.factures (id) on delete restrict,
  primary key (facture_definitive_id, facture_provisoire_id)
);

create table public.echeances (
  id uuid primary key default gen_random_uuid(),
  facture_id uuid not null references public.factures (id) on delete cascade,
  rang smallint not null,
  date_echeance date not null,
  montant bigint not null check (montant >= 0),
  statut text not null default 'a_payer' check (statut in ('a_payer', 'en_retard', 'payee')),
  payee_le date,
  mode_reglement text check (mode_reglement in ('cheque', 'virement', 'especes', 'bon_banque', 'autre')),
  reference text,
  saisie_paiement_le timestamptz,
  saisie_par uuid references auth.users (id) on delete set null,
  unique (facture_id, rang)
);

create index echeances_date_idx on public.echeances (date_echeance) where statut <> 'payee';

alter table public.bons_livraison enable row level security;
alter table public.bl_lignes enable row level security;
alter table public.bons_reception enable row level security;
alter table public.br_lignes enable row level security;
alter table public.factures enable row level security;
alter table public.lignes_facture enable row level security;
alter table public.factures_definitives_provisoires enable row level security;
alter table public.echeances enable row level security;

-- Lecture : quiconque voit la commande (client, producteur et banque de la commande approuvée, plateforme).
create policy bl_lecture on public.bons_livraison for select to authenticated
  using (exists (select 1 from public.commandes c where c.id = commande_id));
create policy bl_lignes_lecture on public.bl_lignes for select to authenticated
  using (exists (select 1 from public.bons_livraison b where b.id = bl_id));
create policy br_lecture on public.bons_reception for select to authenticated
  using (exists (select 1 from public.commandes c where c.id = commande_id));
create policy br_lignes_lecture on public.br_lignes for select to authenticated
  using (exists (select 1 from public.bons_reception b where b.id = br_id));
create policy factures_lecture on public.factures for select to authenticated
  using (exists (select 1 from public.commandes c where c.id = commande_id));
create policy lignes_facture_lecture on public.lignes_facture for select to authenticated
  using (exists (select 1 from public.factures f where f.id = facture_id));
create policy liens_factures_lecture on public.factures_definitives_provisoires for select to authenticated
  using (exists (select 1 from public.factures f where f.id = facture_definitive_id));
create policy echeances_lecture on public.echeances for select to authenticated
  using (exists (select 1 from public.factures f where f.id = facture_id));

-- ---------------------------------------------------------------------------
-- Contrôle des offres (remplace la version du lot 2) : une mise à jour faite par le circuit de commande (réservation à la
-- validation, passage à « épuisée ») ne repasse pas les contrôles de publication — la réservation a ses propres garde-fous
-- (quantité réservée ≤ quantité offerte, stock jamais négatif) et une validation ne doit pas être bloquée par une autre offre.
-- ---------------------------------------------------------------------------

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
  if tg_op = 'UPDATE' and coalesce(current_setting('pcas.circuit_commande', true), '') = 'oui' then
    if new.site_id is distinct from old.site_id or new.produit_id is distinct from old.produit_id
      or new.prix_unitaire is distinct from old.prix_unitaire or new.quantite_offerte is distinct from old.quantite_offerte then
      raise exception 'Le circuit de commande ne modifie que la réservation et le statut d''une offre';
    end if;
    return new;
  end if;

  select * into v_site from public.sites_production where id = new.site_id;
  if not found then
    raise exception 'Site de production introuvable';
  end if;
  new.producteur_id := v_site.entreprise_id;

  select * into v_produit from public.produits where id = new.produit_id;
  if v_produit.nature <> 'produit_fini' then
    raise exception 'Une offre porte sur un produit fini (la matière première n''est jamais proposée aux clients)';
  end if;

  if tg_op = 'INSERT' then
    new.quantite_reservee := 0;
  elsif new.quantite_reservee is distinct from old.quantite_reservee then
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
    and (tg_op = 'INSERT' or new.date_fin_validite is distinct from old.date_fin_validite
      or new.date_disponibilite is distinct from old.date_disponibilite)
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
    if not public.est_plateforme() and not coalesce(public.contrat_en_regle(new.producteur_id), false) then
      raise exception 'Votre entreprise doit accepter le contrat d''engagement avant de publier une offre';
    end if;

    if new.disponibilite = 'immediate' then
      select coalesce(quantite_disponible, 0) into v_stock from public.stocks where site_id = new.site_id and produit_id = new.produit_id;
      select coalesce(sum(quantite_offerte - quantite_reservee), 0) into v_engage
      from public.offres
      where site_id = new.site_id and produit_id = new.produit_id and statut = 'publiee' and disponibilite = 'immediate' and id <> new.id;
      if v_engage + (new.quantite_offerte - new.quantite_reservee) > coalesce(v_stock, 0) then
        raise exception 'Offre immédiate supérieure au stock disponible : % % disponibles pour « % » sur ce site, dont % déjà proposés dans d''autres offres',
          coalesce(v_stock, 0), v_produit.unite, v_produit.nom, v_engage;
      end if;
    else
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

-- ---------------------------------------------------------------------------
-- Statut dérivé d'une commande en cours d'exécution (livraisons, réceptions, paiements)
-- ---------------------------------------------------------------------------

create or replace function public.maj_statut_commande(p_commande uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
  v_total numeric;
  v_livre numeric;
  v_nouveau text;
  v_echeances integer;
  v_payees integer;
begin
  select * into v_commande from public.commandes where id = p_commande;
  if v_commande.statut not in ('validee', 'en_livraison', 'livree_partiellement', 'livree', 'en_litige', 'receptionnee', 'partiellement_payee') then
    return;
  end if;
  select coalesce(sum(quantite), 0), coalesce(sum(quantite_livree), 0) into v_total, v_livre
  from public.lignes_commande where commande_id = p_commande;

  select count(*), count(*) filter (where e.statut = 'payee') into v_echeances, v_payees
  from public.echeances e join public.factures f on f.id = e.facture_id
  where f.commande_id = p_commande and f.nature = 'definitive' and f.statut <> 'annulee';

  if v_livre = 0 then
    v_nouveau := 'validee';
  elsif v_livre < v_total then
    v_nouveau := 'livree_partiellement';
  elsif exists (select 1 from public.bons_reception where commande_id = p_commande and statut = 'en_litige') then
    v_nouveau := 'en_litige';
  elsif exists (select 1 from public.bons_reception where commande_id = p_commande and statut = 'en_attente')
     or exists (select 1 from public.factures where commande_id = p_commande and nature = 'provisoire' and statut in ('provisoire', 'receptionnee')) then
    v_nouveau := 'livree';
  elsif v_echeances > 0 and v_payees = v_echeances then
    v_nouveau := 'soldee';
  elsif v_payees > 0 then
    v_nouveau := 'partiellement_payee';
  else
    v_nouveau := 'receptionnee';
  end if;

  if v_nouveau <> v_commande.statut then
    update public.commandes set statut = v_nouveau where id = p_commande;
    if v_nouveau in ('soldee', 'receptionnee') then
      perform public.tracer_commande(p_commande, v_nouveau, null, null);
    end if;
  end if;
end;
$$;

revoke execute on function public.maj_statut_commande(uuid) from public, anon, authenticated;

-- Commande du producteur connecté, verrouillée, au statut attendu.
create or replace function public.commande_du_producteur(p_commande uuid, p_statuts text[])
returns public.commandes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
begin
  if public.mon_role() is distinct from 'producteur' then
    raise exception 'Réservé au producteur de la commande';
  end if;
  select * into v_commande from public.commandes where id = p_commande for update;
  if not found or v_commande.producteur_id is distinct from public.mon_entreprise_id() or v_commande.approuvee_le is null then
    raise exception 'Commande introuvable';
  end if;
  if not (v_commande.statut = any (p_statuts)) then
    raise exception 'Action impossible : la commande est au statut « % »', v_commande.statut;
  end if;
  return v_commande;
end;
$$;

revoke execute on function public.commande_du_producteur(uuid, text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Validation ou refus par le producteur
-- ---------------------------------------------------------------------------

-- Validation : réservation ferme. Ligne disponible maintenant : réservation du stock du site, refusée par la base si le
-- disponible ne suffit pas, même en cas de validations simultanées. Ligne sur offre à date : réservation sur l'offre,
-- plafonnée par la quantité offerte ; la production devra être déclarée (entrée en stock) avant la livraison.
create or replace function public.valider_commande(p_commande uuid, p_facturation_groupee boolean, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
  v_ligne public.lignes_commande;
  v_produit text;
begin
  v_commande := public.commande_du_producteur(p_commande, array['approuvee', 'approuvee_banque']);
  if not coalesce(public.contrat_en_regle(v_commande.producteur_id), false) then
    raise exception 'Votre entreprise doit accepter le contrat d''engagement avant de valider une commande';
  end if;

  perform set_config('pcas.circuit_commande', 'oui', true);
  for v_ligne in select * from public.lignes_commande where commande_id = p_commande order by id loop
    select nom into v_produit from public.produits where id = v_ligne.produit_id;
    if v_ligne.offre_id is not null then
      begin
        update public.offres set quantite_reservee = quantite_reservee + v_ligne.quantite where id = v_ligne.offre_id;
      exception when check_violation then
        raise exception 'Quantité insuffisante sur l''offre de « % » : elle a déjà été vendue à d''autres clients', v_produit;
      end;
      update public.offres set statut = 'epuisee'
      where id = v_ligne.offre_id and statut = 'publiee' and quantite_reservee >= quantite_offerte;
    end if;
    if v_ligne.date_disponibilite is null then
      -- Le trigger de stock refuse la réservation si le disponible du site est insuffisant.
      insert into public.mouvements_stock (site_id, produit_id, type, motif, quantite, reference_type, reference_id, commentaire)
      values (v_ligne.site_id, v_ligne.produit_id, 'reservation', 'reservation', v_ligne.quantite, 'commande', p_commande, v_commande.numero);
      update public.lignes_commande set reserve_stock = true where id = v_ligne.id;
    end if;
  end loop;
  perform set_config('pcas.circuit_commande', '', true);

  update public.commandes set statut = 'validee', facturation_groupee = coalesce(p_facturation_groupee, false), motif = null
  where id = p_commande;
  perform public.tracer_commande(p_commande, 'validee', nullif(trim(coalesce(p_commentaire, '')), ''),
    jsonb_build_object('facturation_groupee', coalesce(p_facturation_groupee, false)));
end;
$$;

create or replace function public.refuser_par_producteur(p_commande uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.commande_du_producteur(p_commande, array['approuvee', 'approuvee_banque']);
  if length(trim(coalesce(p_motif, ''))) < 3 then
    raise exception 'Indiquez le motif du refus';
  end if;
  update public.commandes set statut = 'refusee_producteur', motif = trim(p_motif) where id = p_commande;
  perform public.tracer_commande(p_commande, 'refusee_producteur', trim(p_motif), null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bon de livraison + facture provisoire + bon de réception en attente
-- p_lignes : [{ligne_id, quantite}] (livraisons partielles possibles)
-- ---------------------------------------------------------------------------

create or replace function public.emettre_bl(
  p_commande uuid,
  p_lignes jsonb,
  p_date date,
  p_transporteur text,
  p_immatriculation text,
  p_chauffeur text,
  p_commentaire text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
  v_bl uuid;
  v_facture uuid;
  v_element jsonb;
  v_ligne public.lignes_commande;
  v_quantite numeric;
  v_bl_ligne uuid;
  v_total bigint := 0;
  v_montant bigint;
  v_delai integer;
  v_mention text;
  v_nb integer := 0;
begin
  v_commande := public.commande_du_producteur(p_commande, array['validee', 'livree_partiellement', 'livree', 'en_litige', 'receptionnee', 'partiellement_payee']);
  if coalesce(p_date, current_date) > current_date then
    raise exception 'La date de livraison ne peut pas être dans le futur';
  end if;

  insert into public.bons_livraison (numero, commande_id, producteur_id, client_id, date_livraison, transporteur, immatriculation, chauffeur, commentaire)
  values (
    public.prochain_numero('BL'), p_commande, v_commande.producteur_id, v_commande.client_id, coalesce(p_date, current_date),
    nullif(trim(coalesce(p_transporteur, '')), ''), nullif(trim(coalesce(p_immatriculation, '')), ''),
    nullif(trim(coalesce(p_chauffeur, '')), ''), nullif(trim(coalesce(p_commentaire, '')), '')
  )
  returning id into v_bl;

  select mention_tva, delai_reception_tacite_heures into v_mention, v_delai from public.parametres_plateforme;
  insert into public.factures (numero, nature, commande_id, bl_id, producteur_id, client_id, statut, mention_tva)
  values (public.prochain_numero('FP'), 'provisoire', p_commande, v_bl, v_commande.producteur_id, v_commande.client_id, 'provisoire', v_mention)
  returning id into v_facture;

  for v_element in select * from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    v_quantite := (v_element ->> 'quantite')::numeric;
    if v_quantite is null or v_quantite <= 0 then
      continue;
    end if;
    select * into v_ligne from public.lignes_commande where id = (v_element ->> 'ligne_id')::uuid and commande_id = p_commande for update;
    if not found then
      raise exception 'Ligne de commande inconnue';
    end if;
    if v_quantite > v_ligne.quantite - v_ligne.quantite_livree then
      raise exception 'Quantité livrée supérieure au reste à livrer (%)', v_ligne.quantite - v_ligne.quantite_livree;
    end if;

    -- Sortie de stock : la réservation faite à la validation est d'abord libérée. Pour une offre à date, la sortie
    -- exige que la production ait été déclarée (stock disponible suffisant).
    if v_ligne.reserve_stock then
      insert into public.mouvements_stock (site_id, produit_id, type, motif, quantite, reference_type, reference_id, commentaire)
      values (v_ligne.site_id, v_ligne.produit_id, 'liberation', 'livraison', v_quantite, 'bon_livraison', v_bl, v_commande.numero);
    end if;
    insert into public.mouvements_stock (site_id, produit_id, type, motif, quantite, reference_type, reference_id, commentaire)
    values (v_ligne.site_id, v_ligne.produit_id, 'sortie', 'livraison', v_quantite, 'bon_livraison', v_bl, v_commande.numero);

    update public.lignes_commande set quantite_livree = quantite_livree + v_quantite where id = v_ligne.id;

    insert into public.bl_lignes (bl_id, ligne_commande_id, produit_id, site_id, quantite, prix_unitaire)
    values (v_bl, v_ligne.id, v_ligne.produit_id, v_ligne.site_id, v_quantite, v_ligne.prix_unitaire)
    returning id into v_bl_ligne;

    v_montant := round(v_quantite * v_ligne.prix_unitaire);
    v_total := v_total + v_montant;
    insert into public.lignes_facture (facture_id, bl_ligne_id, produit_id, quantite, prix_unitaire, montant)
    values (v_facture, v_bl_ligne, v_ligne.produit_id, v_quantite, v_ligne.prix_unitaire, v_montant);
    v_nb := v_nb + 1;
  end loop;

  if v_nb = 0 then
    raise exception 'Indiquez au moins une quantité livrée';
  end if;

  update public.factures set montant_total = v_total where id = v_facture;
  insert into public.bons_reception (numero, bl_id, commande_id, date_limite)
  values (public.prochain_numero('BR'), v_bl, p_commande, now() + make_interval(hours => coalesce(v_delai, 72)));

  perform public.tracer_commande(p_commande, 'livree', nullif(trim(coalesce(p_commentaire, '')), ''),
    jsonb_build_object('bon_livraison', (select numero from public.bons_livraison where id = v_bl), 'montant', v_total));
  perform public.maj_statut_commande(p_commande);
  return v_bl;
end;
$$;

-- ---------------------------------------------------------------------------
-- Factures définitives et échéances
-- ---------------------------------------------------------------------------

-- Facture définitive à partir de factures provisoires réceptionnées d'une même commande : quantités reçues des bons de
-- réception correspondants, échéancier de la commande (dates à partir de la date de la facture), compte bancaire
-- principal du producteur figé.
create or replace function public.creer_facture_definitive(p_commande uuid, p_provisoires uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
  v_facture uuid;
  v_total bigint;
  v_compte jsonb;
  v_reste bigint;
  v_echeance record;
  v_nb integer;
  v_rang integer := 0;
  v_montant bigint;
begin
  select * into v_commande from public.commandes where id = p_commande;
  if coalesce(array_length(p_provisoires, 1), 0) = 0 then
    raise exception 'Aucune facture provisoire à regrouper';
  end if;
  if exists (
    select 1 from unnest(p_provisoires) as p (id)
    left join public.factures f on f.id = p.id
    where f.id is null or f.commande_id <> p_commande or f.nature <> 'provisoire' or f.statut <> 'receptionnee'
  ) then
    raise exception 'Seules des factures provisoires réceptionnées de la même commande peuvent être regroupées';
  end if;

  select jsonb_build_object('banque', c.banque, 'intitule', c.intitule, 'numero_compte', c.numero_compte, 'code_swift', c.code_swift)
  into v_compte
  from public.entreprise_comptes_bancaires c
  where c.entreprise_id = v_commande.producteur_id
  order by c.principal desc, c.created_at
  limit 1;

  insert into public.factures (numero, nature, commande_id, producteur_id, client_id, statut, compte_bancaire, mention_tva)
  values (
    public.prochain_numero('FAC'), 'definitive', p_commande, v_commande.producteur_id, v_commande.client_id, 'definitive', v_compte,
    (select mention_tva from public.parametres_plateforme)
  )
  returning id into v_facture;

  insert into public.lignes_facture (facture_id, bl_ligne_id, produit_id, quantite, prix_unitaire, montant)
  select v_facture, bl.id, bl.produit_id, br.quantite_recue, bl.prix_unitaire, round(br.quantite_recue * bl.prix_unitaire)
  from public.factures f
  join public.bl_lignes bl on bl.bl_id = f.bl_id
  join public.br_lignes br on br.bl_ligne_id = bl.id
  where f.id = any (p_provisoires) and br.quantite_recue > 0;

  select coalesce(sum(montant), 0) into v_total from public.lignes_facture where facture_id = v_facture;
  update public.factures set montant_total = v_total where id = v_facture;

  insert into public.factures_definitives_provisoires (facture_definitive_id, facture_provisoire_id)
  select v_facture, unnest(p_provisoires);
  update public.factures set statut = 'remplacee' where id = any (p_provisoires);

  -- Échéances : pourcentages de l'échéancier convenu ; la dernière absorbe l'arrondi.
  select count(*) into v_nb from public.echeancier_commande where commande_id = p_commande;
  v_reste := v_total;
  for v_echeance in select * from public.echeancier_commande where commande_id = p_commande order by rang loop
    v_rang := v_rang + 1;
    v_montant := case when v_rang = v_nb then v_reste else round(v_total * v_echeance.pourcentage / 100) end;
    v_reste := v_reste - v_montant;
    insert into public.echeances (facture_id, rang, date_echeance, montant, statut)
    values (v_facture, v_rang, current_date + v_echeance.delai_jours, v_montant, case when v_montant = 0 then 'payee' else 'a_payer' end);
  end loop;
  if v_total = 0 then
    update public.factures set statut = 'payee' where id = v_facture;
  end if;

  perform public.tracer_commande(p_commande, 'facture_definitive', null,
    jsonb_build_object('facture', (select numero from public.factures where id = v_facture), 'montant', v_total));
  return v_facture;
end;
$$;

revoke execute on function public.creer_facture_definitive(uuid, uuid[]) from public, anon, authenticated;

-- Regroupement choisi par le producteur (facturation regroupée).
create or replace function public.regrouper_factures(p_commande uuid, p_provisoires uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
  v_facture uuid;
begin
  v_commande := public.commande_du_producteur(p_commande, array['livree_partiellement', 'livree', 'en_litige', 'receptionnee', 'partiellement_payee']);
  if not v_commande.facturation_groupee then
    raise exception 'Cette commande est facturée à chaque réception : pas de regroupement';
  end if;
  v_facture := public.creer_facture_definitive(p_commande, p_provisoires);
  perform public.maj_statut_commande(p_commande);
  return v_facture;
end;
$$;

-- ---------------------------------------------------------------------------
-- Réception
-- ---------------------------------------------------------------------------

-- Enregistrement commun d'une réception (client, tacite ou arbitrage). p_lignes : [{bl_ligne_id, quantite_recue, motif}] ;
-- une ligne absente est réputée reçue en totalité.
create or replace function public.enregistrer_reception(p_br uuid, p_lignes jsonb, p_statut text, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_br public.bons_reception;
  v_commande public.commandes;
  v_bl_ligne public.bl_lignes;
  v_recue numeric;
  v_motif text;
  v_ecart boolean := false;
  v_provisoire uuid;
  v_provisoires uuid[];
  v_statut text := p_statut;
begin
  select * into v_br from public.bons_reception where id = p_br for update;
  select * into v_commande from public.commandes where id = v_br.commande_id for update;

  for v_bl_ligne in select * from public.bl_lignes where bl_id = v_br.bl_id loop
    v_recue := null;
    v_motif := null;
    select (e ->> 'quantite_recue')::numeric, nullif(trim(coalesce(e ->> 'motif', '')), '')
    into v_recue, v_motif
    from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) e
    where (e ->> 'bl_ligne_id')::uuid = v_bl_ligne.id;
    v_recue := coalesce(v_recue, v_bl_ligne.quantite);
    if v_recue < 0 or v_recue > v_bl_ligne.quantite then
      raise exception 'La quantité reçue doit être comprise entre 0 et la quantité livrée (%)', v_bl_ligne.quantite;
    end if;
    if v_recue < v_bl_ligne.quantite then
      v_ecart := true;
      if v_motif is null and p_statut = 'approuve' then
        raise exception 'Indiquez le motif de l''écart pour chaque quantité corrigée';
      end if;
    end if;
    insert into public.br_lignes (br_id, bl_ligne_id, quantite_livree, quantite_recue, motif_ecart)
    values (p_br, v_bl_ligne.id, v_bl_ligne.quantite, v_recue, v_motif);
    update public.lignes_commande set quantite_recue = quantite_recue + v_recue where id = v_bl_ligne.ligne_commande_id;
  end loop;

  if v_statut = 'approuve' and v_ecart then
    v_statut := 'approuve_avec_reserves';
  end if;
  if v_statut = 'arbitre' then
    update public.bons_reception
    set statut = 'arbitre', arbitre_par = auth.uid(), arbitre_le = now(), commentaire_arbitrage = nullif(trim(coalesce(p_commentaire, '')), '')
    where id = p_br;
  else
    update public.bons_reception
    set statut = v_statut, receptionne_par = auth.uid(), receptionne_le = now(), commentaire = nullif(trim(coalesce(p_commentaire, '')), '')
    where id = p_br;
  end if;

  select id into v_provisoire from public.factures where bl_id = v_br.bl_id and nature = 'provisoire';
  update public.factures set statut = 'receptionnee' where id = v_provisoire;

  perform public.tracer_commande(
    v_commande.id,
    case v_statut when 'tacite' then 'reception_tacite' when 'arbitre' then 'arbitrage' else 'receptionnee' end,
    nullif(trim(coalesce(p_commentaire, '')), ''),
    jsonb_build_object('bon_reception', v_br.numero, 'ecart', v_ecart)
  );

  if not v_commande.facturation_groupee then
    perform public.creer_facture_definitive(v_commande.id, array[v_provisoire]);
  elsif not exists (select 1 from public.lignes_commande where commande_id = v_commande.id and quantite_livree < quantite)
    and not exists (select 1 from public.bons_reception where commande_id = v_commande.id and statut in ('en_attente', 'en_litige')) then
    -- Facturation regroupée : à la réception complète, les provisoires restantes sont regroupées automatiquement.
    select array_agg(id) into v_provisoires from public.factures
    where commande_id = v_commande.id and nature = 'provisoire' and statut = 'receptionnee';
    if v_provisoires is not null then
      perform public.creer_facture_definitive(v_commande.id, v_provisoires);
    end if;
  end if;
  perform public.maj_statut_commande(v_commande.id);
end;
$$;

revoke execute on function public.enregistrer_reception(uuid, jsonb, text, text) from public, anon, authenticated;

-- Bon de réception du client connecté, verrouillé, en attente.
create or replace function public.reception_du_client(p_br uuid)
returns public.bons_reception
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_br public.bons_reception;
begin
  if public.mon_role() is distinct from 'client' then
    raise exception 'Réservé au client de la commande';
  end if;
  select br.* into v_br
  from public.bons_reception br join public.commandes c on c.id = br.commande_id
  where br.id = p_br and c.client_id = public.mon_entreprise_id()
  for update of br;
  if not found then
    raise exception 'Bon de réception introuvable';
  end if;
  if v_br.statut <> 'en_attente' then
    raise exception 'Ce bon de réception a déjà été traité';
  end if;
  return v_br;
end;
$$;

revoke execute on function public.reception_du_client(uuid) from public, anon, authenticated;

create or replace function public.valider_reception(p_br uuid, p_lignes jsonb, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.reception_du_client(p_br);
  perform public.enregistrer_reception(p_br, p_lignes, 'approuve', p_commentaire);
end;
$$;

-- Contestation (quantité, qualité) : le superviseur arbitrera.
create or replace function public.contester_reception(p_br uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_br public.bons_reception;
begin
  v_br := public.reception_du_client(p_br);
  if length(trim(coalesce(p_motif, ''))) < 10 then
    raise exception 'Décrivez le motif de la contestation (au moins 10 caractères)';
  end if;
  update public.bons_reception set statut = 'en_litige', motif_litige = trim(p_motif), receptionne_par = auth.uid(), receptionne_le = now()
  where id = p_br;
  perform public.tracer_commande(v_br.commande_id, 'litige', trim(p_motif), jsonb_build_object('bon_reception', v_br.numero));
  perform public.maj_statut_commande(v_br.commande_id);
end;
$$;

-- Arbitrage du superviseur : il fixe les quantités acceptées.
create or replace function public.arbitrer_litige(p_br uuid, p_lignes jsonb, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_br public.bons_reception;
begin
  if not public.est_plateforme() then
    raise exception 'Réservé au superviseur';
  end if;
  select * into v_br from public.bons_reception where id = p_br for update;
  if not found or v_br.statut <> 'en_litige' then
    raise exception 'Ce bon de réception n''est pas en litige';
  end if;
  if length(trim(coalesce(p_commentaire, ''))) < 3 then
    raise exception 'Motivez votre arbitrage';
  end if;
  perform public.enregistrer_reception(p_br, p_lignes, 'arbitre', p_commentaire);
end;
$$;

-- Tâche planifiée : réception tacite des bons de réception restés sans réponse après le délai (clé de service uniquement).
create or replace function public.receptions_tacites()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_br uuid;
  v_nb integer := 0;
begin
  for v_br in select id from public.bons_reception where statut = 'en_attente' and date_limite < now() order by date_limite loop
    perform public.enregistrer_reception(v_br, '[]'::jsonb, 'tacite',
      'Réception réputée conforme au bon de livraison : aucune réponse du client dans le délai.');
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;

-- ---------------------------------------------------------------------------
-- Paiements
-- ---------------------------------------------------------------------------

create or replace function public.maj_statut_facture(p_facture uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.factures f
  set statut = case
    when not exists (select 1 from public.echeances e where e.facture_id = f.id and e.statut <> 'payee') then 'payee'
    when exists (select 1 from public.echeances e where e.facture_id = f.id and e.statut = 'payee') then 'partiellement_payee'
    else 'definitive'
  end
  where f.id = p_facture and f.nature = 'definitive'
$$;

revoke execute on function public.maj_statut_facture(uuid) from public, anon, authenticated;

-- Confirmation d'un paiement reçu : réservée au producteur émetteur de la facture.
create or replace function public.marquer_echeance_payee(p_echeance uuid, p_date date, p_mode text, p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_echeance public.echeances;
  v_facture public.factures;
begin
  select * into v_echeance from public.echeances where id = p_echeance for update;
  if not found then
    raise exception 'Échéance introuvable';
  end if;
  select * into v_facture from public.factures where id = v_echeance.facture_id;
  if public.mon_role() is distinct from 'producteur' or v_facture.producteur_id is distinct from public.mon_entreprise_id() then
    raise exception 'Seul le producteur qui a émis la facture peut confirmer un paiement';
  end if;
  if v_echeance.statut = 'payee' then
    raise exception 'Cette échéance est déjà payée';
  end if;
  if coalesce(p_date, current_date) > current_date then
    raise exception 'La date de paiement ne peut pas être dans le futur';
  end if;
  if p_mode not in ('cheque', 'virement', 'especes', 'bon_banque', 'autre') then
    raise exception 'Mode de règlement inconnu';
  end if;
  update public.echeances
  set statut = 'payee', payee_le = coalesce(p_date, current_date), mode_reglement = p_mode,
      reference = nullif(trim(coalesce(p_reference, '')), ''), saisie_paiement_le = now(), saisie_par = auth.uid()
  where id = p_echeance;
  perform public.maj_statut_facture(v_facture.id);
  perform public.tracer_commande(v_facture.commande_id, 'echeance_payee', nullif(trim(coalesce(p_reference, '')), ''),
    jsonb_build_object('facture', v_facture.numero, 'rang', v_echeance.rang, 'montant', v_echeance.montant));
  perform public.maj_statut_commande(v_facture.commande_id);
end;
$$;

-- Annulation d'une confirmation de paiement erronée, dans les 48 heures qui suivent la saisie.
create or replace function public.annuler_paiement_echeance(p_echeance uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_echeance public.echeances;
  v_facture public.factures;
  v_commande public.commandes;
begin
  select * into v_echeance from public.echeances where id = p_echeance for update;
  if not found then
    raise exception 'Échéance introuvable';
  end if;
  select * into v_facture from public.factures where id = v_echeance.facture_id;
  if public.mon_role() is distinct from 'producteur' or v_facture.producteur_id is distinct from public.mon_entreprise_id() then
    raise exception 'Seul le producteur qui a émis la facture peut annuler une confirmation de paiement';
  end if;
  if v_echeance.statut <> 'payee' or v_echeance.saisie_paiement_le is null or v_echeance.saisie_paiement_le < now() - interval '48 hours' then
    raise exception 'Seule une confirmation de paiement de moins de 48 heures peut être annulée';
  end if;
  if length(trim(coalesce(p_motif, ''))) < 3 then
    raise exception 'Indiquez le motif de l''annulation';
  end if;
  update public.echeances
  set statut = case when date_echeance < current_date then 'en_retard' else 'a_payer' end,
      payee_le = null, mode_reglement = null, reference = null, saisie_paiement_le = null, saisie_par = null
  where id = p_echeance;
  perform public.maj_statut_facture(v_facture.id);
  select * into v_commande from public.commandes where id = v_facture.commande_id for update;
  if v_commande.statut = 'soldee' then
    update public.commandes set statut = 'partiellement_payee' where id = v_commande.id;
  end if;
  perform public.tracer_commande(v_facture.commande_id, 'paiement_annule', trim(p_motif),
    jsonb_build_object('facture', v_facture.numero, 'rang', v_echeance.rang));
  perform public.maj_statut_commande(v_facture.commande_id);
end;
$$;

-- Tâche planifiée : échéances passées non payées → en retard.
create or replace function public.echeances_en_retard()
returns integer
language sql
security definer
set search_path = ''
as $$
  with maj as (
    update public.echeances set statut = 'en_retard'
    where statut = 'a_payer' and date_echeance < current_date
    returning 1
  )
  select count(*)::integer from maj
$$;

-- ---------------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------------

revoke execute on function public.valider_commande(uuid, boolean, text) from public, anon;
revoke execute on function public.refuser_par_producteur(uuid, text) from public, anon;
revoke execute on function public.emettre_bl(uuid, jsonb, date, text, text, text, text) from public, anon;
revoke execute on function public.regrouper_factures(uuid, uuid[]) from public, anon;
revoke execute on function public.valider_reception(uuid, jsonb, text) from public, anon;
revoke execute on function public.contester_reception(uuid, text) from public, anon;
revoke execute on function public.arbitrer_litige(uuid, jsonb, text) from public, anon;
revoke execute on function public.marquer_echeance_payee(uuid, date, text, text) from public, anon;
revoke execute on function public.annuler_paiement_echeance(uuid, text) from public, anon;
grant execute on function public.valider_commande(uuid, boolean, text) to authenticated;
grant execute on function public.refuser_par_producteur(uuid, text) to authenticated;
grant execute on function public.emettre_bl(uuid, jsonb, date, text, text, text, text) to authenticated;
grant execute on function public.regrouper_factures(uuid, uuid[]) to authenticated;
grant execute on function public.valider_reception(uuid, jsonb, text) to authenticated;
grant execute on function public.contester_reception(uuid, text) to authenticated;
grant execute on function public.arbitrer_litige(uuid, jsonb, text) to authenticated;
grant execute on function public.marquer_echeance_payee(uuid, date, text, text) to authenticated;
grant execute on function public.annuler_paiement_echeance(uuid, text) to authenticated;

-- Tâches planifiées : uniquement avec la clé de service (route /api/cron/circuit protégée par CRON_SECRET).
revoke execute on function public.receptions_tacites() from public, anon, authenticated;
revoke execute on function public.echeances_en_retard() from public, anon, authenticated;
grant execute on function public.receptions_tacites() to service_role;
grant execute on function public.echeances_en_retard() to service_role;
