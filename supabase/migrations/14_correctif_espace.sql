-- PCAS — Correctif de 13_espace_demo : les contrôles « pas de mélange des espaces » lisent des lignes que l'utilisateur ne
-- voit pas forcément en direct (un producteur ne lit les besoins d'achat qu'à travers besoins_publics). Ils s'exécutent
-- donc avec les droits du propriétaire, comme les autres fonctions de contrôle.

alter function public.verifier_espace_commande() security definer;
alter function public.verifier_espace_besoin() security definer;
alter function public.verifier_espace_panier() security definer;
alter function public.espace_evenement() security definer;
