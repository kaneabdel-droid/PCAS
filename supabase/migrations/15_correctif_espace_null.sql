-- PCAS — Correctif de 13_espace_demo : superviseur et administrateur n'ont pas d'entreprise, donc
-- « p_entreprise = mon_entreprise_id() » vaut NULL (et non faux) ; « not (faux or NULL) » vaut NULL et le contrôle laissait
-- passer un compte de démonstration vers une entreprise réelle. Comparaison rendue booléenne avec coalesce(…, false).
-- Détecté par npm run verifier-espaces.

create or replace function public.capacite_periode(p_entreprise uuid, p_produit uuid, p_date date)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not ((public.est_plateforme() and public.meme_espace(p_entreprise)) or coalesce(p_entreprise = public.mon_entreprise_id(), false)) then null
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
  if not ((public.est_plateforme() and public.meme_espace(p_producteur)) or coalesce(p_producteur = public.mon_entreprise_id(), false)) then
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
  if not ((public.est_plateforme() and public.meme_espace(p_entreprise)) or coalesce(p_entreprise = public.mon_entreprise_id(), false)) then
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
