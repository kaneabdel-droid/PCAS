-- PCAS — Audit de sécurité de la base (lecture seule). À exécuter dans l'éditeur SQL de Supabase avant chaque mise en
-- production. Chaque requête doit renvoyer ZÉRO ligne ; sinon, la ligne indique ce qu'il faut corriger.

-- 1. Tables du schéma public sans RLS (toute table doit être protégée)
select 'Table sans RLS' as probleme, c.relname as objet
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 2. Tables avec RLS mais sans aucune politique (illisibles, sauf si c'est voulu : sequences_numerotation)
select 'RLS sans politique' as probleme, c.relname as objet
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname)
  and c.relname not in ('sequences_numerotation');

-- 3. Fonctions SECURITY DEFINER sans search_path figé (risque de détournement)
select 'Fonction definer sans search_path' as probleme, p.proname as objet
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%');

-- 4. Fonctions SECURITY DEFINER exécutables par un visiteur non connecté (seule verifier_document est prévue)
select 'Fonction definer ouverte aux anonymes' as probleme, p.proname as objet
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not in ('verifier_document')
  and p.prorettype <> 'trigger'::regtype;

-- 5. Politiques ouvertes aux anonymes (seule l'insertion d'une demande d'accès est prévue)
select 'Politique ouverte aux anonymes' as probleme, tablename || ' / ' || policyname as objet
from pg_policies
where schemaname = 'public' and 'anon' = any (roles) and not (tablename = 'demandes_acces' and cmd = 'INSERT');

-- 6. Buckets de stockage publics autres que logos et photos d'offres
select 'Bucket public inattendu' as probleme, id as objet
from storage.buckets where public and id not in ('logos', 'offres');

-- 7. Stocks incohérents (ne doit jamais arriver : contrainte en base)
select 'Stock incohérent' as probleme, site_id || ' / ' || produit_id as objet
from public.stocks where quantite_physique < 0 or quantite_reservee < 0 or quantite_reservee > quantite_physique;

-- 8. Documents dont l'empreinte ne correspond plus au contenu (altération)
select 'Document altéré' as probleme, type || ' ' || numero as objet
from public.documents d
where public.empreinte_document(d.type, d.document_id) <> d.empreinte_sha256;

-- 9. Espace de démonstration : utilisateur rangé dans un autre espace que son entreprise (migration 13)
select 'Utilisateur hors de l''espace de son entreprise' as probleme, u.email as objet
from public.utilisateurs u join public.entreprises e on e.id = u.entreprise_id
where u.demo <> e.demo;

-- 10. Espace de démonstration : commande qui mélange démonstration et réel
select 'Commande entre deux espaces' as probleme, c.numero as objet
from public.commandes c
join public.entreprises cl on cl.id = c.client_id
join public.entreprises pr on pr.id = c.producteur_id
left join public.entreprises bq on bq.id = c.banque_id
where cl.demo <> pr.demo or (bq.id is not null and bq.demo <> cl.demo);

-- 11. Numérotation : document de démonstration sans le préfixe DEMO- (ou document réel avec)
select 'Numéro dans la mauvaise série' as probleme, c.numero as objet
from public.commandes c join public.entreprises e on e.id = c.client_id
where (e.demo and c.numero not like 'DEMO-%') or (not e.demo and c.numero like 'DEMO-%');
