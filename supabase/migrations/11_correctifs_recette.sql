-- PCAS — Correctifs issus de la recette (lot 11).
--
-- 1. enregistrer_document() (lot 7) : en PL/pgSQL, une expression qui cite un champ absent de l'enregistrement NEW
--    échoue même si la branche n'est pas utilisée (« record "new" has no field "commande_id" » sur les commandes,
--    « statut » absent des bons de livraison). Chaque champ n'est désormais lu que dans l'instruction propre à son type.

create or replace function public.enregistrer_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := tg_argv[0];
  v_commande uuid;
  v_statut text;
begin
  if v_type = 'bon_reception' then
    v_statut := new.statut;
    if v_statut not in ('approuve', 'approuve_avec_reserves', 'tacite', 'arbitre') then
      return null; -- le bon de réception est figé à la décision (approbation, réception tacite ou arbitrage)
    end if;
  end if;

  if v_type = 'commande' then
    v_commande := new.id;
  else
    v_commande := new.commande_id;
  end if;

  insert into public.documents (type, document_id, commande_id, numero, empreinte_sha256)
  values (v_type, new.id, v_commande, new.numero, public.empreinte_document(v_type, new.id))
  on conflict (type, document_id) do nothing;
  return null;
end;
$$;
