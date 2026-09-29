-- PCAS — Correctif de 13_espace_demo : le formulaire public « Demander un accès » était refusé.
-- Le déclencheur fixer_espace() (exécuté avec les droits de l'appelant) appelle mon_espace_demo(), qui n'était pas
-- accordée au rôle anonyme : « permission denied for function mon_espace_demo ». Sans risque de l'accorder : pour un
-- visiteur non connecté, elle renvoie toujours faux (espace réel). Détecté par l'audit (test de la limite de débit).

grant execute on function public.mon_espace_demo() to anon;
