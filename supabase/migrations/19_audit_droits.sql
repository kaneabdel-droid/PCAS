-- PCAS — Audit (npm run audit:securite) : masquer_nom() restait appelable par un visiteur non connecté. Sans accès aux
-- données (simple mise en forme d'un nom), mais toute fonction non prévue pour le public doit lui être fermée.
-- verifier_document(), qui l'utilise, s'exécute avec les droits du propriétaire et n'est pas concernée.

revoke execute on function public.masquer_nom(text) from public, anon;
grant execute on function public.masquer_nom(text) to authenticated;
