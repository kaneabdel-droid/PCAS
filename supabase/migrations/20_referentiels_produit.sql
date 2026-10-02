-- PCAS — Catégories et unités de vente du catalogue gérées par l'administrateur.
-- Jusqu'ici figées par une contrainte CHECK sur public.produits (et en dur dans lib/referentiels.ts) : l'administrateur ne
-- pouvait pas créer un produit vendu au litre ni une catégorie « Élevage ». Elles deviennent deux tables de référence ;
-- produits.categorie et produits.unite gardent leur libellé texte (aucune requête ni fonction existante ne change) et le
-- référencent par clé étrangère : renommer une catégorie ou une unité se répercute sur les produits, et on ne peut pas
-- supprimer celle qu'un produit utilise encore.

create table public.categories_produit (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique check (length(trim(nom)) between 2 and 60),
  ordre integer not null default 100,
  created_at timestamptz not null default now()
);

create table public.unites_produit (
  id uuid primary key default gen_random_uuid(),
  nom text not null unique check (length(trim(nom)) between 1 and 40),
  ordre integer not null default 100,
  created_at timestamptz not null default now()
);

insert into public.categories_produit (nom, ordre) values
  ('Céréales', 10), ('Légumes', 20), ('Tubercules', 30), ('Fruits', 40), ('Fruits à coque', 50), ('Autres', 1000)
on conflict (nom) do nothing;

insert into public.unites_produit (nom, ordre) values
  ('kg', 10), ('tonne', 20), ('sac de 25 kg', 30), ('sac de 50 kg', 40), ('caisse', 50), ('régime', 60), ('pièce', 70)
on conflict (nom) do nothing;

alter table public.produits drop constraint if exists produits_categorie_check;
alter table public.produits drop constraint if exists produits_unite_check;

alter table public.produits
  add constraint produits_categorie_fkey foreign key (categorie) references public.categories_produit (nom) on update cascade,
  add constraint produits_unite_fkey foreign key (unite) references public.unites_produit (nom) on update cascade;

-- Lecture par tout utilisateur connecté, écriture par l'administrateur seul (comme le catalogue).
alter table public.categories_produit enable row level security;
alter table public.unites_produit enable row level security;

create policy categories_produit_lecture on public.categories_produit for select to authenticated
  using (public.mon_role() is not null);
create policy categories_produit_gestion on public.categories_produit for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

create policy unites_produit_lecture on public.unites_produit for select to authenticated
  using (public.mon_role() is not null);
create policy unites_produit_gestion on public.unites_produit for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- Référentiels communs aux deux espaces : un compte de démonstration les consulte sans les modifier (cf. 13_espace_demo).
do $$
declare
  t text;
  c text;
begin
  foreach t in array array['categories_produit', 'unites_produit'] loop
    foreach c in array array['insert', 'update', 'delete'] loop
      execute format(
        'create policy espace_demo_%s on public.%I as restrictive for %s to authenticated %s (not public.mon_espace_demo())',
        c, t, c, case c when 'insert' then 'with check' else 'using' end
      );
    end loop;
  end loop;
end;
$$;

create trigger audit_categories_produit after insert or update or delete on public.categories_produit
  for each row execute function public.journaliser();
create trigger audit_unites_produit after insert or update or delete on public.unites_produit
  for each row execute function public.journaliser();
