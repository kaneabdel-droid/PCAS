-- PCAS — Corrections de l'audit (performances, anti-abus, cloisonnement du stockage).
--   1. Index sur les clés étrangères utilisées par les jointures et les contrôles d'accès (RLS).
--   2. Limite de débit des demandes d'accès (formulaire public : pas de spam de l'administrateur).
--   3. Logos : l'administrateur de démonstration ne peut pas toucher aux logos des entreprises réelles.
--   4. Politiques RLS : les fonctions d'identité (mon_role, mon_entreprise_id, est_admin, est_plateforme,
--      mon_espace_demo, auth.uid) sont évaluées une fois par requête et non plus à chaque ligne, en les enveloppant dans
--      (select …) — recommandation Supabase ; le résultat est identique, le coût ne croît plus avec le nombre de lignes.

-- ---------------------------------------------------------------------------
-- 1. Index
-- ---------------------------------------------------------------------------

create index if not exists echeances_facture_idx on public.echeances (facture_id);
create index if not exists br_lignes_br_idx on public.br_lignes (br_id);
create index if not exists factures_bl_idx on public.factures (bl_id);
create index if not exists commandes_banque_idx on public.commandes (banque_id, soumise_le desc) where banque_id is not null;
create index if not exists commandes_besoin_idx on public.commandes (besoin_id) where besoin_id is not null;
create index if not exists commandes_parent_idx on public.commandes (commande_parent_id) where commande_parent_id is not null;
create index if not exists offres_site_produit_idx on public.offres (site_id, produit_id);
create index if not exists lignes_commande_offre_idx on public.lignes_commande (offre_id);
create index if not exists bl_lignes_ligne_commande_idx on public.bl_lignes (ligne_commande_id);
create index if not exists lignes_facture_bl_ligne_idx on public.lignes_facture (bl_ligne_id);
create index if not exists declarations_entreprise_idx on public.declarations_production (entreprise_id);
create index if not exists paniers_offre_idx on public.paniers (offre_id);
create index if not exists propositions_offre_idx on public.propositions_besoin (offre_id) where offre_id is not null;
create index if not exists utilisateurs_profil_idx on public.utilisateurs (profil_id) where profil_id is not null;
create index if not exists demandes_email_idx on public.demandes_acces (lower(email), created_at desc);
create index if not exists demandes_recentes_idx on public.demandes_acces (created_at desc);

-- ---------------------------------------------------------------------------
-- 2. Demandes d'accès : 3 par adresse email et par 24 h, 30 au total par heure
-- ---------------------------------------------------------------------------

create or replace function public.limiter_demandes_acces()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if (select count(*) from public.demandes_acces
      where lower(email) = lower(new.email) and created_at > now() - interval '24 hours') >= 3
    or (select count(*) from public.demandes_acces where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de demandes envoyées : réessayez plus tard';
  end if;
  return new;
end;
$$;

revoke execute on function public.limiter_demandes_acces() from public, anon, authenticated;

create trigger demandes_acces_limite before insert on public.demandes_acces
  for each row execute function public.limiter_demandes_acces();

-- ---------------------------------------------------------------------------
-- 3. Logos : l'administrateur agit sur les dossiers de toutes les entreprises de SON espace uniquement
-- ---------------------------------------------------------------------------

drop policy logos_ecriture on storage.objects;
drop policy logos_modification on storage.objects;
drop policy logos_suppression on storage.objects;

create policy logos_ecriture on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (
      ((select public.est_admin()) and public.meme_espace(case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then ((storage.foldername(name))[1])::uuid end))
      or (storage.foldername(name))[1] = (select public.mon_entreprise_id())::text
    )
  );
create policy logos_modification on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and (
      ((select public.est_admin()) and public.meme_espace(case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then ((storage.foldername(name))[1])::uuid end))
      or (storage.foldername(name))[1] = (select public.mon_entreprise_id())::text
    )
  );
create policy logos_suppression on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and (
      ((select public.est_admin()) and public.meme_espace(case when (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$' then ((storage.foldername(name))[1])::uuid end))
      or (storage.foldername(name))[1] = (select public.mon_entreprise_id())::text
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Politiques RLS du schéma public : fonctions d'identité évaluées une seule fois par requête
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
  v_ancien_chemin text := current_setting('search_path');
  v_using text;
  v_check text;
  f text;
  v_nb integer := 0;
begin
  -- Chemin vide : les expressions sont restituées avec des noms entièrement qualifiés (public.mon_role()).
  perform set_config('search_path', '', true);
  for p in select tablename, policyname, qual, with_check from pg_policies where schemaname = 'public' loop
    v_using := p.qual;
    v_check := p.with_check;
    foreach f in array array['public.mon_role()', 'public.mon_entreprise_id()', 'public.est_admin()', 'public.est_plateforme()', 'public.mon_espace_demo()', 'auth.uid()'] loop
      -- Déjà enveloppée (« SELECT public.x() AS x ») : on n'y touche pas.
      if v_using is not null and position(f in v_using) > 0 and position('SELECT ' || f in v_using) = 0 then
        v_using := replace(v_using, f, '(select ' || f || ')');
      end if;
      if v_check is not null and position(f in v_check) > 0 and position('SELECT ' || f in v_check) = 0 then
        v_check := replace(v_check, f, '(select ' || f || ')');
      end if;
    end loop;
    if v_using is distinct from p.qual then
      execute format('alter policy %I on public.%I using (%s)', p.policyname, p.tablename, v_using);
      v_nb := v_nb + 1;
    end if;
    if v_check is distinct from p.with_check then
      execute format('alter policy %I on public.%I with check (%s)', p.policyname, p.tablename, v_check);
    end if;
  end loop;
  perform set_config('search_path', v_ancien_chemin, true);
  raise notice '% politiques optimisées', v_nb;
end;
$$;
