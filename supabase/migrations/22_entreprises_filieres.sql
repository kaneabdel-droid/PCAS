-- PCAS — Lot 22 : Filières d'appartenance des entreprises
-- L'entreprise à sa création ou dans ses paramètres précise sa ou ses filières d'appartenance
-- (Céréale, Maraîchage, Fruitier) pour être dirigée exclusivement dans cette ou ces filières,
-- verrouillée sur le reste.

-- 1. Ajout de la colonne filieres sur les entreprises
alter table public.entreprises
  add column if not exists filieres text[] not null default array['cereale', 'maraichage', 'fruitier'];

-- 2. Contrainte de validation sur les filières autorisées
alter table public.entreprises
  drop constraint if exists entreprises_filieres_check;

alter table public.entreprises
  add constraint entreprises_filieres_check
  check (
    filieres <@ array['cereale', 'maraichage', 'fruitier']
    and coalesce(array_length(filieres, 1), 0) >= 1
  );

-- Index pour recherche rapide par filière d'entreprise
create index if not exists entreprises_filieres_idx on public.entreprises using gin (filieres);

-- 3. Ajout optionnel de filieres sur demandes_acces (pré-remplissage à la création)
alter table public.demandes_acces
  add column if not exists filieres text[];

-- 4. Protection de la fiche entreprise :
-- Seul l'administrateur peut modifier le type et le statut.
-- L'entreprise ou l'administrateur peut modifier sa dénomination, son adresse et ses filières d'appartenance.
create or replace function public.proteger_entreprise()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.est_admin() and auth.uid() is not null then
    if new.type is distinct from old.type then
      raise exception 'Seul l''administrateur peut changer le type d''une entreprise';
    end if;
    if new.statut is distinct from old.statut then
      raise exception 'Seul l''administrateur peut suspendre ou réactiver une entreprise';
    end if;
  end if;
  return new;
end;
$$;
