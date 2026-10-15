-- PCAS — Lot 21 : organisation par filières agricoles (Céréale, Maraîchage, Fruitier)
-- Permet au SuperAdmin d'activer ou désactiver les filières distribuées,
-- d'assigner une supervision dédiée par filière tout en conservant une supervision centrale SuperAdmin,
-- et d'associer chaque produit et catégorie à sa filière respective.

-- 1. Paramètres de la plateforme : filières actives configurables par le SuperAdmin
alter table public.parametres_plateforme
  add column if not exists filieres_actives text[] not null default array['cereale', 'maraichage', 'fruitier'];

alter table public.parametres_plateforme
  drop constraint if exists parametres_filieres_actives_check;

alter table public.parametres_plateforme
  add constraint parametres_filieres_actives_check
  check (
    filieres_actives <@ array['cereale', 'maraichage', 'fruitier']
    and coalesce(array_length(filieres_actives, 1), 0) >= 1
  );

-- 2. Référentiel des catégories : rattachement à une filière
alter table public.categories_produit
  add column if not exists filiere text check (filiere in ('cereale', 'maraichage', 'fruitier')) default 'cereale';

update public.categories_produit set filiere = 'cereale' where nom in ('Céréales');
update public.categories_produit set filiere = 'maraichage' where nom in ('Légumes', 'Tubercules', 'Autres');
update public.categories_produit set filiere = 'fruitier' where nom in ('Fruits', 'Fruits à coque');

-- 3. Catalogue produits : filière dédiée par produit
alter table public.produits
  add column if not exists filiere text check (filiere in ('cereale', 'maraichage', 'fruitier'));

-- Rétrocompatibilité : calcul de la filière selon la catégorie existante
update public.produits set filiere = 'cereale' where categorie = 'Céréales' and filiere is null;
update public.produits set filiere = 'maraichage' where categorie in ('Légumes', 'Tubercules') and filiere is null;
update public.produits set filiere = 'fruitier' where categorie in ('Fruits', 'Fruits à coque') and filiere is null;
update public.produits set filiere = 'cereale' where filiere is null;

alter table public.produits alter column filiere set default 'cereale';
alter table public.produits alter column filiere set not null;

create index if not exists produits_filiere_idx on public.produits (filiere);

-- 4. Utilisateurs : attribution optionnelle d'une filière de supervision pour les superviseurs dédiés
-- (null = supervision transversale toutes filières / SuperAdmin)
alter table public.utilisateurs
  add column if not exists filiere text check (filiere in ('cereale', 'maraichage', 'fruitier'));

-- Maintien de la protection : seul l'administrateur peut modifier la filière d'un utilisateur
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
      or new.signataire is distinct from old.signataire
      or new.filiere is distinct from old.filiere then
      raise exception 'Seul l''administrateur peut modifier le rôle, la filière, le profil, l''entreprise, l''habilitation ou l''état d''un compte';
    end if;
  end if;
  return new;
end;
$$;

-- 5. Fonctions utilitaires SQL pour les filières
create or replace function public.filiere_produit(p_produit uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select filiere from public.produits where id = p_produit;
$$;

grant execute on function public.filiere_produit(uuid) to authenticated;
