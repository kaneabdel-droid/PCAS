-- PCAS — Correctif issu de la recette (lot 11) : application des mouvements de stock.
--
-- La version du lot 2 utilisait « insert … on conflict do update ». PostgreSQL vérifie les contraintes CHECK sur la
-- ligne proposée à l'insertion AVANT de détecter le conflit : pour une sortie ou une réservation, cette ligne proposée
-- (physique 0, réservé > 0, ou physique négatif) violait « stock_jamais_negatif » même quand le stock existant suffisait.
-- Désormais : mise à jour de la ligne existante (verrouillée), insertion seulement si elle n'existe pas encore.

create or replace function public.appliquer_mouvement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_physique numeric := case new.type when 'entree' then new.quantite when 'sortie' then -new.quantite when 'ajustement' then new.quantite else 0 end;
  v_reserve numeric := case new.type when 'reservation' then new.quantite when 'liberation' then -new.quantite else 0 end;
  v_produit text;
begin
  update public.stocks
  set quantite_physique = quantite_physique + v_physique,
      quantite_reservee = quantite_reservee + v_reserve,
      updated_at = now()
  where site_id = new.site_id and produit_id = new.produit_id;

  if not found then
    begin
      insert into public.stocks (site_id, produit_id, entreprise_id, quantite_physique, quantite_reservee)
      values (new.site_id, new.produit_id, new.entreprise_id, v_physique, v_reserve);
    exception
      when unique_violation then
        -- Première écriture simultanée sur ce site et ce produit : la ligne vient d'être créée, on la met à jour.
        update public.stocks
        set quantite_physique = quantite_physique + v_physique,
            quantite_reservee = quantite_reservee + v_reserve,
            updated_at = now()
        where site_id = new.site_id and produit_id = new.produit_id;
    end;
  end if;
  return new;
exception
  when check_violation then
    select nom into v_produit from public.produits where id = new.produit_id;
    raise exception 'Stock insuffisant pour « % » sur ce site : l''opération rendrait le stock (ou le disponible) négatif', v_produit;
end;
$$;
