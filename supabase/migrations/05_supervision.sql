-- PCAS — Lot 4 : supervision des commandes.
-- Analyse de capacité d'un producteur (stock, matière première, capacité de production, engagements), recherche de
-- producteurs de remplacement, et décisions du superviseur : approuver (date de livraison convenue), mettre en attente,
-- refuser, réorienter ou répartir entre plusieurs producteurs. Toutes les transitions passent par des fonctions qui
-- vérifient le rôle et le statut de départ, verrouillent la commande et tracent l'étape.

-- ---------------------------------------------------------------------------
-- Analyse de capacité
-- production attendue = min(potentiel matière première, capacité de la période) si le produit est issu d'une
-- transformation, sinon la capacité de la période ; disponible total = stock disponible + production attendue ;
-- engagé = commandes approuvées mais pas encore validées (dont le stock n'est pas encore réservé), plus les lignes
-- validées sur des offres à date (réservées sur l'offre, pas encore en stock).
-- ---------------------------------------------------------------------------

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
  if not (public.est_plateforme() or p_producteur = public.mon_entreprise_id()) then
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

-- Producteurs ayant une offre publiée du produit, avec leur marge à la date et leur meilleure offre commandable.
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
  order by o.producteur_id, o.prix_unitaire
$$;

revoke execute on function public.analyse_capacite(uuid, uuid, date, uuid) from public, anon;
revoke execute on function public.producteurs_alternatifs(uuid, date, uuid) from public, anon;
grant execute on function public.analyse_capacite(uuid, uuid, date, uuid) to authenticated;
grant execute on function public.producteurs_alternatifs(uuid, date, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Décisions du superviseur
-- ---------------------------------------------------------------------------

-- Verrouille la commande, vérifie le rôle (superviseur ou administrateur) et le statut de départ.
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
  if not found then
    raise exception 'Commande introuvable';
  end if;
  if not (v_commande.statut = any (p_statuts)) then
    raise exception 'Action impossible : la commande est au statut « % »', v_commande.statut;
  end if;
  return v_commande;
end;
$$;

revoke execute on function public.commande_a_superviser(uuid, text[]) from public, anon, authenticated;

-- Approbation : date de livraison convenue obligatoire. Paiement par bon : la commande attend la banque.
create or replace function public.approuver_commande(p_commande uuid, p_date_convenue date, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
begin
  v_commande := public.commande_a_superviser(p_commande, array['soumise', 'en_attente', 'refusee_producteur']);
  if p_date_convenue is null or p_date_convenue < current_date then
    raise exception 'Fixez une date de livraison convenue (aujourd''hui ou plus tard)';
  end if;
  if exists (
    select 1 from public.lignes_commande
    where commande_id = p_commande and date_disponibilite is not null and date_disponibilite > p_date_convenue
  ) then
    raise exception 'La date convenue précède la date de disponibilité d''une offre à date de la commande';
  end if;
  update public.commandes
  set statut = case when mode_paiement = 'bon_banque' then 'attente_banque' else 'approuvee' end,
      date_livraison_convenue = p_date_convenue,
      approuvee_le = coalesce(approuvee_le, now()),
      motif = null
  where id = p_commande;
  perform public.tracer_commande(
    p_commande, 'approuvee', nullif(trim(coalesce(p_commentaire, '')), ''),
    jsonb_build_object('date_livraison_convenue', p_date_convenue)
  );
end;
$$;

create or replace function public.mettre_en_attente(p_commande uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.commande_a_superviser(p_commande, array['soumise', 'refusee_producteur']);
  if length(trim(coalesce(p_motif, ''))) < 3 then
    raise exception 'Indiquez le motif de la mise en attente';
  end if;
  update public.commandes set statut = 'en_attente', motif = trim(p_motif) where id = p_commande;
  perform public.tracer_commande(p_commande, 'mise_en_attente', trim(p_motif), null);
end;
$$;

create or replace function public.refuser_commande(p_commande uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
begin
  v_commande := public.commande_a_superviser(p_commande, array['soumise', 'en_attente', 'refusee_producteur', 'refusee_banque']);
  if length(trim(coalesce(p_motif, ''))) < 3 then
    raise exception 'Indiquez le motif du refus';
  end if;
  update public.commandes set statut = 'refusee', motif = trim(p_motif) where id = p_commande;
  perform public.tracer_commande(p_commande, 'refusee', trim(p_motif), null);
  if v_commande.proposition_id is not null then
    perform set_config('pcas.circuit_commande', 'oui', true);
    update public.propositions_besoin set statut = 'ecartee' where id = v_commande.proposition_id;
    update public.besoins_achat set statut = 'en_traitement' where id = v_commande.besoin_id and statut = 'converti';
    perform set_config('pcas.circuit_commande', '', true);
  end if;
end;
$$;

-- Réorientation ou répartition : chaque ligne de la commande d'origine est affectée, en tout ou partie, à des offres
-- publiées (d'autres producteurs, ou du même) ; une ligne peut aussi rester chez le producteur d'origine aux mêmes
-- conditions (offre_id absent). p_affectations : [{ligne_id, offre_id?, quantite}].
-- Une commande « soumise » est créée par producteur, avec les conditions de livraison et de paiement d'origine ; la
-- commande d'origine passe à « réorientée » (un seul autre producteur) ou « répartie ». Chaque nouvelle commande est
-- ensuite approuvée normalement, avec l'analyse de capacité de son producteur.
create or replace function public.repartir_commande(p_commande uuid, p_affectations jsonb, p_commentaire text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
  v_ligne public.lignes_commande;
  v_affectation jsonb;
  v_offre public.offres;
  v_quantite numeric;
  v_total_ligne numeric;
  v_producteurs uuid[] := '{}';
  v_producteur uuid;
  v_nouvelle uuid;
  v_montant bigint;
  v_nb integer := 0;
  v_cibles jsonb := '[]'::jsonb; -- affectations enrichies : {producteur_id, offre_id, site_id, produit_id, quantite, prix_unitaire, date_disponibilite}
begin
  v_commande := public.commande_a_superviser(p_commande, array['soumise', 'en_attente', 'refusee_producteur', 'refusee_banque']);
  if jsonb_array_length(coalesce(p_affectations, '[]'::jsonb)) = 0 then
    raise exception 'Aucune affectation';
  end if;

  -- Contrôle : chaque ligne est entièrement affectée, chaque offre est commandable pour la quantité demandée.
  for v_ligne in select * from public.lignes_commande where commande_id = p_commande loop
    select coalesce(sum((a ->> 'quantite')::numeric), 0) into v_total_ligne
    from jsonb_array_elements(p_affectations) a where (a ->> 'ligne_id')::uuid = v_ligne.id;
    if v_total_ligne <> v_ligne.quantite then
      raise exception 'Chaque ligne doit être entièrement affectée : % affectés sur % commandés', v_total_ligne, v_ligne.quantite;
    end if;
  end loop;

  for v_affectation in select * from jsonb_array_elements(p_affectations) loop
    v_quantite := (v_affectation ->> 'quantite')::numeric;
    if v_quantite is null or v_quantite <= 0 then
      continue;
    end if;
    select * into v_ligne from public.lignes_commande where id = (v_affectation ->> 'ligne_id')::uuid and commande_id = p_commande;
    if not found then
      raise exception 'Ligne inconnue dans la répartition';
    end if;
    if nullif(v_affectation ->> 'offre_id', '') is null then
      v_cibles := v_cibles || jsonb_build_object(
        'producteur_id', v_commande.producteur_id, 'offre_id', v_ligne.offre_id, 'site_id', v_ligne.site_id,
        'produit_id', v_ligne.produit_id, 'quantite', v_quantite, 'prix_unitaire', v_ligne.prix_unitaire,
        'date_disponibilite', v_ligne.date_disponibilite
      );
    else
      select * into v_offre from public.offres where id = (v_affectation ->> 'offre_id')::uuid;
      if not found or v_offre.statut <> 'publiee' or v_offre.produit_id <> v_ligne.produit_id then
        raise exception 'Offre de remplacement invalide (publiée, même produit)';
      end if;
      if v_quantite > public.quantite_commandable(v_offre.id) then
        raise exception 'Quantité affectée supérieure au disponible de l''offre choisie (%)', public.quantite_commandable(v_offre.id);
      end if;
      v_cibles := v_cibles || jsonb_build_object(
        'producteur_id', v_offre.producteur_id, 'offre_id', v_offre.id, 'site_id', v_offre.site_id,
        'produit_id', v_offre.produit_id, 'quantite', v_quantite, 'prix_unitaire', v_offre.prix_unitaire,
        'date_disponibilite', v_offre.date_disponibilite
      );
    end if;
  end loop;

  select array_agg(distinct (c ->> 'producteur_id')::uuid) into v_producteurs from jsonb_array_elements(v_cibles) c;
  if array_length(v_producteurs, 1) = 1 and v_producteurs[1] = v_commande.producteur_id then
    raise exception 'La répartition ne change rien : tout reste chez le même producteur';
  end if;

  foreach v_producteur in array v_producteurs loop
    insert into public.commandes (
      numero, client_id, producteur_id, commande_parent_id, besoin_id, proposition_id, statut, mode_paiement, banque_id,
      adresse_livraison, region_livraison, contact_livraison, date_souhaitee, entete_client, commentaire, created_by
    )
    values (
      public.prochain_numero('CMD'), v_commande.client_id, v_producteur, v_commande.id, v_commande.besoin_id,
      case when v_producteur = v_commande.producteur_id then v_commande.proposition_id end,
      'soumise', v_commande.mode_paiement, v_commande.banque_id, v_commande.adresse_livraison, v_commande.region_livraison,
      v_commande.contact_livraison, v_commande.date_souhaitee, v_commande.entete_client, v_commande.commentaire, v_commande.created_by
    )
    returning id into v_nouvelle;

    v_montant := 0;
    insert into public.lignes_commande (commande_id, offre_id, site_id, produit_id, quantite, prix_unitaire, montant, date_disponibilite)
    select v_nouvelle, nullif(c ->> 'offre_id', '')::uuid, (c ->> 'site_id')::uuid, (c ->> 'produit_id')::uuid,
           (c ->> 'quantite')::numeric, (c ->> 'prix_unitaire')::bigint,
           round((c ->> 'quantite')::numeric * (c ->> 'prix_unitaire')::bigint), nullif(c ->> 'date_disponibilite', '')::date
    from jsonb_array_elements(v_cibles) c
    where (c ->> 'producteur_id')::uuid = v_producteur;

    select coalesce(sum(montant), 0) into v_montant from public.lignes_commande where commande_id = v_nouvelle;
    update public.commandes set montant_total = v_montant where id = v_nouvelle;

    insert into public.echeancier_commande (commande_id, rang, pourcentage, delai_jours)
    select v_nouvelle, rang, pourcentage, delai_jours from public.echeancier_commande where commande_id = p_commande;

    perform public.tracer_commande(
      v_nouvelle, 'soumise',
      'Issue de la ' || case when array_length(v_producteurs, 1) = 1 then 'réorientation' else 'répartition' end || ' de la commande ' || v_commande.numero,
      jsonb_build_object('commande_origine', v_commande.numero, 'montant_total', v_montant)
    );
    v_nb := v_nb + 1;
  end loop;

  update public.commandes
  set statut = case when array_length(v_producteurs, 1) = 1 then 'reorientee' else 'repartie' end,
      motif = nullif(trim(coalesce(p_commentaire, '')), '')
  where id = p_commande;
  perform public.tracer_commande(
    p_commande, case when array_length(v_producteurs, 1) = 1 then 'reorientee' else 'repartie' end,
    nullif(trim(coalesce(p_commentaire, '')), ''), jsonb_build_object('nouvelles_commandes', v_nb)
  );
  return v_nb;
end;
$$;

revoke execute on function public.approuver_commande(uuid, date, text) from public, anon;
revoke execute on function public.mettre_en_attente(uuid, text) from public, anon;
revoke execute on function public.refuser_commande(uuid, text) from public, anon;
revoke execute on function public.repartir_commande(uuid, jsonb, text) from public, anon;
grant execute on function public.approuver_commande(uuid, date, text) to authenticated;
grant execute on function public.mettre_en_attente(uuid, text) to authenticated;
grant execute on function public.refuser_commande(uuid, text) to authenticated;
grant execute on function public.repartir_commande(uuid, jsonb, text) to authenticated;
