-- PCAS — Espace de démonstration étanche.
-- La démonstration (comptes @pcas.test, entreprises fictives, npm run demo) partage la base de production. Deux espaces
-- cloisonnés en base, pas seulement dans l'interface :
--   * un indicateur `demo` sur les entreprises, les utilisateurs, les profils et les demandes d'accès ;
--   * des politiques RLS RESTRICTIVES (combinées en ET avec les politiques existantes) sur toutes les tables métier :
--     un utilisateur ne voit que les lignes de son espace, même superviseur ou administrateur ;
--   * les fonctions SECURITY DEFINER qui listent plusieurs entreprises (marché, besoins, supervision, QR, notifications)
--     filtrent par espace ;
--   * une commande, une proposition ou un panier ne peut pas mélanger les deux espaces ;
--   * numérotation séparée pour la démonstration (« DEMO-FAC-2026-… ») : la série réelle reste sans trou.
-- L'indicateur ne se fixe qu'avec la clé de service (script de démonstration) ou dans l'éditeur SQL ; une ligne créée
-- depuis l'application hérite de l'espace de son auteur.

-- ---------------------------------------------------------------------------
-- Indicateurs
-- ---------------------------------------------------------------------------

alter table public.entreprises add column demo boolean not null default false;
alter table public.utilisateurs add column demo boolean not null default false;
alter table public.profils add column demo boolean not null default false;
alter table public.demandes_acces add column demo boolean not null default false;

-- ---------------------------------------------------------------------------
-- Espace de l'utilisateur connecté et des lignes
-- ---------------------------------------------------------------------------

create or replace function public.mon_espace_demo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.demo from public.utilisateurs u where u.id = auth.uid()), false)
$$;

-- Espace de l'opération en cours : celui de l'utilisateur connecté, ou celui fixé par une tâche planifiée (pcas.espace).
create or replace function public.espace_courant()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(current_setting('pcas.espace', true), '')::boolean, public.mon_espace_demo())
$$;

create or replace function public.entreprise_demo(p_entreprise uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select e.demo from public.entreprises e where e.id = p_entreprise), false)
$$;

create or replace function public.utilisateur_demo(p_utilisateur uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.demo from public.utilisateurs u where u.id = p_utilisateur), false)
$$;

create or replace function public.meme_espace(p_entreprise uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.entreprise_demo(p_entreprise) = public.mon_espace_demo()
$$;

-- Espace d'une commande = celui de son client (producteur et banque sont forcément du même espace, voir plus bas).
create or replace function public.commande_demo(p_commande uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.entreprise_demo((select c.client_id from public.commandes c where c.id = p_commande))
$$;

create or replace function public.facture_demo(p_facture uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.commande_demo((select f.commande_id from public.factures f where f.id = p_facture))
$$;

create or replace function public.bl_demo(p_bl uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.commande_demo((select b.commande_id from public.bons_livraison b where b.id = p_bl))
$$;

create or replace function public.br_demo(p_br uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.commande_demo((select b.commande_id from public.bons_reception b where b.id = p_br))
$$;

create or replace function public.site_demo(p_site uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.entreprise_demo((select s.entreprise_id from public.sites_production s where s.id = p_site))
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'mon_espace_demo()', 'espace_courant()', 'entreprise_demo(uuid)', 'utilisateur_demo(uuid)', 'meme_espace(uuid)',
    'commande_demo(uuid)', 'facture_demo(uuid)', 'bl_demo(uuid)', 'br_demo(uuid)', 'site_demo(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- L'indicateur ne se choisit pas depuis l'application
-- ---------------------------------------------------------------------------

create or replace function public.fixer_espace()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_privilegie boolean := current_user in ('postgres', 'service_role', 'supabase_admin')
    or coalesce(auth.role(), '') = 'service_role';
begin
  -- Un utilisateur rattaché à une entreprise est toujours dans l'espace de son entreprise.
  -- (Conditions imbriquées : PL/pgSQL évalue tout le AND, et les autres tables n'ont pas de colonne entreprise_id.)
  if tg_table_name = 'utilisateurs' then
    if new.entreprise_id is not null then
      new.demo := public.entreprise_demo(new.entreprise_id);
      return new;
    end if;
  end if;
  if v_privilegie then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.demo := public.mon_espace_demo();
  elsif new.demo is distinct from old.demo then
    raise exception 'L''espace (démonstration ou réel) ne se modifie pas';
  end if;
  return new;
end;
$$;

create trigger entreprises_espace before insert or update on public.entreprises
  for each row execute function public.fixer_espace();
create trigger utilisateurs_espace before insert or update on public.utilisateurs
  for each row execute function public.fixer_espace();
create trigger profils_espace before insert or update on public.profils
  for each row execute function public.fixer_espace();
create trigger demandes_acces_espace before insert or update on public.demandes_acces
  for each row execute function public.fixer_espace();

-- ---------------------------------------------------------------------------
-- Pas de mélange des espaces
-- ---------------------------------------------------------------------------

create or replace function public.verifier_espace_commande()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.entreprise_demo(new.client_id) <> public.entreprise_demo(new.producteur_id)
    or (new.banque_id is not null and public.entreprise_demo(new.banque_id) <> public.entreprise_demo(new.client_id)) then
    raise exception 'Commande impossible : client, producteur et banque doivent appartenir au même espace';
  end if;
  if auth.uid() is not null and not public.meme_espace(new.client_id) then
    raise exception 'Commande introuvable';
  end if;
  return new;
end;
$$;

create trigger commandes_espace before insert or update on public.commandes
  for each row execute function public.verifier_espace_commande();

create or replace function public.verifier_espace_besoin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'besoins_achat' then
    if new.producteur_souhaite_id is not null and public.entreprise_demo(new.producteur_souhaite_id) <> public.entreprise_demo(new.client_id) then
      raise exception 'Producteur introuvable';
    end if;
  elsif public.entreprise_demo(new.producteur_id)
    <> public.entreprise_demo((select b.client_id from public.besoins_achat b where b.id = new.besoin_id)) then
    raise exception 'Besoin introuvable';
  end if;
  return new;
end;
$$;

create trigger besoins_espace before insert or update on public.besoins_achat
  for each row execute function public.verifier_espace_besoin();
create trigger propositions_espace before insert or update on public.propositions_besoin
  for each row execute function public.verifier_espace_besoin();

create or replace function public.verifier_espace_panier()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.meme_espace((select o.producteur_id from public.offres o where o.id = new.offre_id)) then
    raise exception 'Offre introuvable';
  end if;
  return new;
end;
$$;

create trigger paniers_espace before insert or update on public.paniers
  for each row execute function public.verifier_espace_panier();

-- Chaque étape d'une commande fixe l'espace de l'opération : notifications de la plateforme et numérotation
-- restent dans l'espace de la commande, y compris dans une tâche planifiée.
create or replace function public.espace_evenement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('pcas.espace', public.commande_demo(new.commande_id)::text, true);
  return new;
end;
$$;

create trigger commande_evenements_espace before insert on public.commande_evenements
  for each row execute function public.espace_evenement();

-- ---------------------------------------------------------------------------
-- Politiques restrictives : chaque utilisateur ne voit et ne modifie que son espace
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('entreprises', 'demo = public.mon_espace_demo()'),
      ('utilisateurs', 'demo = public.mon_espace_demo()'),
      ('profils', 'demo = public.mon_espace_demo()'),
      ('demandes_acces', 'demo = public.mon_espace_demo()'),
      ('entreprise_comptes_bancaires', 'public.meme_espace(entreprise_id)'),
      ('sites_production', 'public.meme_espace(entreprise_id)'),
      ('capacites_production', 'public.site_demo(site_id) = public.mon_espace_demo()'),
      ('acceptations_contrat', 'public.meme_espace(entreprise_id)'),
      ('stocks', 'public.meme_espace(entreprise_id)'),
      ('mouvements_stock', 'public.meme_espace(entreprise_id)'),
      ('offres', 'public.meme_espace(producteur_id)'),
      ('declarations_production', 'public.meme_espace(entreprise_id)'),
      ('besoins_achat', 'public.meme_espace(client_id)'),
      ('propositions_besoin', 'public.meme_espace(producteur_id)'),
      ('commandes', 'public.meme_espace(client_id)'),
      ('lignes_commande', 'public.commande_demo(commande_id) = public.mon_espace_demo()'),
      ('echeancier_commande', 'public.commande_demo(commande_id) = public.mon_espace_demo()'),
      ('commande_evenements', 'public.commande_demo(commande_id) = public.mon_espace_demo()'),
      ('bons_paiement', 'public.commande_demo(commande_id) = public.mon_espace_demo()'),
      ('bons_livraison', 'public.commande_demo(commande_id) = public.mon_espace_demo()'),
      ('bl_lignes', 'public.bl_demo(bl_id) = public.mon_espace_demo()'),
      ('bons_reception', 'public.commande_demo(commande_id) = public.mon_espace_demo()'),
      ('br_lignes', 'public.br_demo(br_id) = public.mon_espace_demo()'),
      ('factures', 'public.commande_demo(commande_id) = public.mon_espace_demo()'),
      ('lignes_facture', 'public.facture_demo(facture_id) = public.mon_espace_demo()'),
      ('factures_definitives_provisoires', 'public.facture_demo(facture_definitive_id) = public.mon_espace_demo()'),
      ('echeances', 'public.facture_demo(facture_id) = public.mon_espace_demo()'),
      ('documents', 'public.commande_demo(commande_id) = public.mon_espace_demo()'),
      ('journal_audit', '(case when entreprise_id is not null then public.entreprise_demo(entreprise_id) else public.utilisateur_demo(auteur_id) end) = public.mon_espace_demo()')
    ) as t (nom, condition)
  loop
    execute format(
      'create policy espace_demo on public.%I as restrictive for all to authenticated using (%s) with check (%s)',
      r.nom, r.condition, r.condition
    );
  end loop;
end;
$$;

-- Catalogue, paramètres et contrats sont communs aux deux espaces : un compte de démonstration les consulte sans les modifier.
do $$
declare
  t text;
  c text;
begin
  foreach t in array array['produits', 'transformations', 'parametres_plateforme', 'modeles_contrat'] loop
    foreach c in array array['insert', 'update', 'delete'] loop
      execute format(
        'create policy espace_demo_%s on public.%I as restrictive for %s to authenticated %s (not public.mon_espace_demo())',
        c, t, c, case c when 'insert' then 'with check' else 'using' end
      );
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Données existantes : tout ce qui vient de la démonstration passe dans son espace
-- ---------------------------------------------------------------------------

update public.entreprises set demo = true where email like '%pcas.test';
update public.utilisateurs set demo = true where email like '%@pcas.test';
update public.profils set demo = true where code = 'commercial_producteur';
update public.demandes_acces set demo = true where email like '%@pcas.test';

-- Tant qu'aucune commande ni aucun besoin réel n'existe, la numérotation réelle repart de 1 (les numéros déjà pris l'ont
-- été par la démonstration). Relancez `npm run demo` juste après : il recrée la démonstration avec la série DEMO-.
do $$
begin
  if not exists (select 1 from public.commandes c join public.entreprises e on e.id = c.client_id where not e.demo)
    and not exists (select 1 from public.besoins_achat b join public.entreprises e on e.id = b.client_id where not e.demo) then
    delete from public.sequences_numerotation;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fonctions SECURITY DEFINER (elles contournent la RLS) : filtrées par espace
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
  where e.type = 'producteur' and e.statut = 'actif' and e.demo = public.mon_espace_demo()
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
  where e.type = 'banque' and e.statut = 'actif' and e.demo = public.mon_espace_demo() and public.mon_role() is not null
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
    and e.demo = public.mon_espace_demo()
    and p.actif
    and (o.date_fin_validite is null or o.date_fin_validite >= current_date)
    and public.quantite_commandable(o.id) > 0
    and public.mon_role() in ('client', 'administrateur', 'superviseur')
$$;

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
    and public.meme_espace(b.client_id)
    and public.mon_role() = 'producteur'
    and (b.producteur_souhaite_id is null or b.producteur_souhaite_id = public.mon_entreprise_id())
$$;

create or replace function public.capacite_periode(p_entreprise uuid, p_produit uuid, p_date date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not ((public.est_plateforme() and public.meme_espace(p_entreprise)) or p_entreprise = public.mon_entreprise_id()) then null
    else coalesce(sum(c.capacite_jour * floor(greatest(p_date - current_date, 0) * s.jours_ouvres_semaine / 7.0)), 0)
  end
  from public.sites_production s
  join public.capacites_production c on c.site_id = s.id and c.produit_id = p_produit
  where s.entreprise_id = p_entreprise and s.actif
$$;

create or replace function public.analyse_capacite(p_producteur uuid, p_produit uuid, p_date date, p_exclure uuid default null)
returns table (
  stock_disponible numeric,
  potentiel_matiere numeric,
  transforme boolean,
  capacite_periode numeric,
  production_attendue numeric,
  disponible_total numeric,
  engage numeric,
  marge numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_stock numeric;
  v_potentiel numeric;
  v_transforme boolean;
  v_capacite numeric;
  v_production numeric;
  v_engage numeric;
begin
  if not ((public.est_plateforme() and public.meme_espace(p_producteur)) or p_producteur = public.mon_entreprise_id()) then
    return;
  end if;

  select coalesce(sum(quantite_disponible), 0) into v_stock
  from public.stocks where entreprise_id = p_producteur and produit_id = p_produit;

  select exists (select 1 from public.transformations where produit_id = p_produit) into v_transforme;
  select coalesce(sum(st.quantite_disponible * t.rendement), 0) into v_potentiel
  from public.transformations t
  join public.stocks st on st.produit_id = t.matiere_id and st.entreprise_id = p_producteur
  where t.produit_id = p_produit;

  v_capacite := coalesce(public.capacite_periode(p_producteur, p_produit, coalesce(p_date, current_date)), 0);
  v_production := case when v_transforme then least(v_potentiel, v_capacite) else v_capacite end;

  select coalesce(sum(l.quantite - l.quantite_livree), 0) into v_engage
  from public.lignes_commande l
  join public.commandes c on c.id = l.commande_id
  where c.producteur_id = p_producteur
    and l.produit_id = p_produit
    and c.id is distinct from p_exclure
    and (
      c.statut in ('approuvee', 'attente_banque', 'approuvee_banque')
      or (c.statut = 'validee' and l.date_disponibilite is not null)
    );

  return query select v_stock, v_potentiel, v_transforme, v_capacite, v_production, v_stock + v_production, v_engage,
    v_stock + v_production - v_engage;
end;
$$;

create or replace function public.producteurs_alternatifs(p_produit uuid, p_date date, p_exclure_commande uuid)
returns table (
  producteur_id uuid,
  denomination text,
  region text,
  offre_id uuid,
  prix_unitaire bigint,
  quantite_commandable numeric,
  date_disponibilite date,
  marge numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (o.producteur_id)
    o.producteur_id, e.denomination, e.region, o.id, o.prix_unitaire, public.quantite_commandable(o.id), o.date_disponibilite,
    (select a.marge from public.analyse_capacite(o.producteur_id, p_produit, p_date, p_exclure_commande) a)
  from public.offres o
  join public.entreprises e on e.id = o.producteur_id and e.statut = 'actif'
  where o.produit_id = p_produit
    and o.statut = 'publiee'
    and (o.date_fin_validite is null or o.date_fin_validite >= current_date)
    and (o.date_disponibilite is null or o.date_disponibilite <= coalesce(p_date, current_date))
    and public.quantite_commandable(o.id) > 0
    and public.est_plateforme()
    and public.meme_espace(o.producteur_id)
  order by o.producteur_id, o.prix_unitaire
$$;

create or replace function public.commande_a_superviser(p_commande uuid, p_statuts text[])
returns public.commandes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
begin
  if not public.est_plateforme() then
    raise exception 'Réservé au superviseur';
  end if;
  select * into v_commande from public.commandes where id = p_commande for update;
  if not found or not public.meme_espace(v_commande.client_id) then
    raise exception 'Commande introuvable';
  end if;
  if not (v_commande.statut = any (p_statuts)) then
    raise exception 'Action impossible : la commande est au statut « % »', v_commande.statut;
  end if;
  return v_commande;
end;
$$;

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
  if not found or v_br.statut <> 'en_litige'
    or not public.meme_espace((select client_id from public.commandes where id = v_br.commande_id)) then
    raise exception 'Ce bon de réception n''est pas en litige';
  end if;
  if length(trim(coalesce(p_commentaire, ''))) < 3 then
    raise exception 'Motivez votre arbitrage';
  end if;
  perform public.enregistrer_reception(p_br, p_lignes, 'arbitre', p_commentaire);
end;
$$;

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
    -- Tâche planifiée sans utilisateur : l'espace du bon fixe la numérotation (factures) et les destinataires.
    perform set_config('pcas.espace', public.entreprise_demo((select c.client_id from public.bons_reception br join public.commandes c on c.id = br.commande_id where br.id = v_br))::text, true);
    perform public.enregistrer_reception(v_br, '[]'::jsonb, 'tacite',
      'Réception réputée conforme au bon de livraison : aucune réponse du client dans le délai.');
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;

create or replace function public.verifier_document(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_acceptation public.acceptations_contrat;
  v_commande public.commandes;
  v_partie boolean;
  v_statut text;
  v_detail jsonb;
  v_remplacee text;
begin
  select * into v_doc from public.documents where jeton_public = p_jeton;

  if not found then
    -- Contrat d'engagement accepté
    select * into v_acceptation from public.acceptations_contrat where jeton_public = p_jeton;
    if not found then
      return jsonb_build_object('trouve', false);
    end if;
    return jsonb_build_object(
      'trouve', true,
      'type', 'contrat',
      'numero', (select titre || ' — version ' || version from public.modeles_contrat where id = v_acceptation.modele_id),
      'emis_le', v_acceptation.accepte_le,
      'conforme', true,
      'statut', (select statut from public.modeles_contrat where id = v_acceptation.modele_id),
      'emetteur', (select denomination from public.entreprises where id = v_acceptation.entreprise_id),
      'signataire', case
        when (public.est_plateforme() and public.meme_espace(v_acceptation.entreprise_id)) or v_acceptation.entreprise_id = public.mon_entreprise_id() then v_acceptation.nom_signataire
        else public.masquer_nom(v_acceptation.nom_signataire)
      end,
      'empreinte', (select empreinte_sha256 from public.modeles_contrat where id = v_acceptation.modele_id)
    );
  end if;

  select * into v_commande from public.commandes where id = v_doc.commande_id;
  v_partie := (public.est_plateforme() and public.meme_espace(v_commande.client_id))
    or public.mon_entreprise_id() in (v_commande.client_id, v_commande.producteur_id)
    or (v_commande.banque_id is not null and v_commande.approuvee_le is not null and public.mon_entreprise_id() = v_commande.banque_id);

  v_statut := case v_doc.type
    when 'commande' then v_commande.statut
    when 'bon_paiement' then (select statut from public.bons_paiement where id = v_doc.document_id)
    when 'bon_livraison' then coalesce((select 'reception_' || statut from public.bons_reception where bl_id = v_doc.document_id), 'emis')
    when 'bon_reception' then (select statut from public.bons_reception where id = v_doc.document_id)
    when 'facture' then (select statut from public.factures where id = v_doc.document_id)
  end;

  if v_doc.type = 'facture' then
    select d.numero into v_remplacee
    from public.factures_definitives_provisoires l join public.factures d on d.id = l.facture_definitive_id
    where l.facture_provisoire_id = v_doc.document_id;
  end if;

  if v_partie then
    v_detail := jsonb_build_object(
      'montant', case v_doc.type
        when 'commande' then v_commande.montant_total
        when 'bon_paiement' then (select montant from public.bons_paiement where id = v_doc.document_id)
        when 'facture' then (select montant_total from public.factures where id = v_doc.document_id)
        when 'bon_livraison' then (select sum(round(quantite * prix_unitaire)) from public.bl_lignes where bl_id = v_doc.document_id)
      end,
      'lignes', case v_doc.type
        when 'commande' then (select jsonb_agg(jsonb_build_object('produit', p.nom, 'unite', p.unite, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire) order by p.nom)
                              from public.lignes_commande l join public.produits p on p.id = l.produit_id where l.commande_id = v_commande.id)
        when 'bon_livraison' then (select jsonb_agg(jsonb_build_object('produit', p.nom, 'unite', p.unite, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire) order by p.nom)
                                   from public.bl_lignes l join public.produits p on p.id = l.produit_id where l.bl_id = v_doc.document_id)
        when 'bon_reception' then (select jsonb_agg(jsonb_build_object('produit', p.nom, 'unite', p.unite, 'quantite', l.quantite_recue, 'livree', l.quantite_livree) order by p.nom)
                                   from public.br_lignes l join public.bl_lignes b on b.id = l.bl_ligne_id join public.produits p on p.id = b.produit_id
                                   where l.br_id = v_doc.document_id)
        when 'facture' then (select jsonb_agg(jsonb_build_object('produit', p.nom, 'unite', p.unite, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire) order by p.nom)
                             from public.lignes_facture l join public.produits p on p.id = l.produit_id where l.facture_id = v_doc.document_id)
      end,
      'lien', case v_doc.type
        when 'commande' then '/commandes/' || v_commande.id
        when 'bon_paiement' then '/bons-paiement/' || v_doc.document_id
        when 'bon_livraison' then '/livraisons/' || v_doc.document_id
        when 'bon_reception' then '/livraisons/' || (select bl_id from public.bons_reception where id = v_doc.document_id)
        when 'facture' then '/factures/' || v_doc.document_id
      end
    );
  end if;

  return jsonb_build_object(
    'trouve', true,
    'type', v_doc.type,
    'numero', v_doc.numero,
    'emis_le', v_doc.emis_le,
    'conforme', public.empreinte_document(v_doc.type, v_doc.document_id) = v_doc.empreinte_sha256,
    'empreinte', v_doc.empreinte_sha256,
    'statut', v_statut,
    'remplacee_par', v_remplacee,
    'commande', v_commande.numero,
    'commande_statut', v_commande.statut,
    'client', v_commande.entete_client ->> 'denomination',
    'producteur', (select denomination from public.entreprises where id = v_commande.producteur_id),
    'partie', v_partie,
    'detail', v_detail,
    'etapes', (
      select jsonb_agg(jsonb_build_object(
        'action', e.action,
        'horodatage', e.horodatage,
        'role', e.acteur_role,
        'acteur', case when v_partie then e.acteur_nom else public.masquer_nom(e.acteur_nom) end
      ) order by e.horodatage)
      from public.commande_evenements e where e.commande_id = v_commande.id
    )
  );
end;
$$;

create or replace function public.prochain_numero(p_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_annee integer := extract(year from now() at time zone 'Africa/Dakar')::integer;
  v_numero integer;
  v_type text := p_type;
  v_prefixe text := '';
begin
  -- Démonstration : série séparée « DEMO-FAC-2026-… », pour que la série réelle reste sans trou.
  if public.espace_courant() then
    v_type := p_type || '-DEMO';
    v_prefixe := 'DEMO-';
  end if;
  insert into public.sequences_numerotation as s (type, annee, dernier)
  values (v_type, v_annee, 1)
  on conflict (type, annee) do update set dernier = s.dernier + 1
  returning dernier into v_numero;
  return v_prefixe || p_type || '-' || v_annee || '-' || lpad(v_numero::text, 6, '0');
end;
$$;

create or replace function public.publier_modele_contrat(p_modele uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modele public.modeles_contrat;
begin
  if not public.est_admin() or public.mon_espace_demo() then
    raise exception 'Réservé à l''administrateur de la plateforme';
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
  if not ((public.est_plateforme() and public.meme_espace(p_entreprise)) or p_entreprise = public.mon_entreprise_id()) then
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

create or replace function public.utilisateurs_plateforme()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.utilisateurs where role_base in ('administrateur', 'superviseur') and actif
    and demo = public.espace_courant()
$$;

create or replace function public.notifier_besoin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produit text;
  v_producteurs uuid[];
begin
  select nom into v_produit from public.produits where id = new.produit_id;
  select coalesce(array_agg(distinct u.id), '{}') into v_producteurs
  from public.utilisateurs u
  join public.entreprises e on e.id = u.entreprise_id and e.type = 'producteur' and e.statut = 'actif'
    and e.demo = public.entreprise_demo(new.client_id)
  where u.actif
    and (
      (new.producteur_souhaite_id is not null and e.id = new.producteur_souhaite_id)
      or (new.producteur_souhaite_id is null and (
        exists (select 1 from public.offres o where o.producteur_id = e.id and o.produit_id = new.produit_id and o.statut in ('publiee', 'epuisee'))
        or exists (select 1 from public.capacites_production cp join public.sites_production s on s.id = cp.site_id
                   where s.entreprise_id = e.id and cp.produit_id = new.produit_id)
      ))
    );
  perform public.notifier(v_producteurs, 'Besoin d''achat : ' || v_produit,
    new.quantite || ' pour le ' || to_char(new.date_souhaitee, 'DD/MM/YYYY') || coalesce(' — ' || new.region_livraison, '') || '. Faites une proposition.',
    '/besoins/' || new.id);
  return null;
end;
$$;

create or replace function public.notifier_demande_acces()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notifier(
    (select coalesce(array_agg(id), '{}') from public.utilisateurs where role_base = 'administrateur' and actif and demo = new.demo),
    'Demande d''accès : ' || new.denomination, new.contact_nom || ' — ' || new.telephone, '/admin/demandes');
  return null;
end;
$$;
