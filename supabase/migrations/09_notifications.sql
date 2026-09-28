-- PCAS — Lot 9 : notifications.
-- Une notification par utilisateur concerné, créée par la base à chaque étape du circuit (journal des commandes),
-- à chaque besoin d'achat, proposition ou demande d'accès, et par les rappels planifiés (réception tacite, échéances).
-- Affichées dans l'application (temps réel) et envoyées par email par la tâche planifiée.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  destinataire_id uuid not null references auth.users (id) on delete cascade,
  email text,
  titre text not null,
  message text,
  lien text,
  lu_le timestamptz,
  email_envoye_le timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_destinataire_idx on public.notifications (destinataire_id, created_at desc);
create index notifications_non_lues_idx on public.notifications (destinataire_id) where lu_le is null;
create index notifications_a_envoyer_idx on public.notifications (created_at) where email_envoye_le is null;

alter table public.notifications enable row level security;
create policy notifications_lecture on public.notifications for select to authenticated
  using (destinataire_id = auth.uid());
-- L'utilisateur ne peut que marquer ses notifications comme lues (seule la colonne lu_le est modifiable).
create policy notifications_lecture_marquee on public.notifications for update to authenticated
  using (destinataire_id = auth.uid()) with check (destinataire_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (lu_le) on public.notifications to authenticated;

-- Temps réel : la cloche de l'application reçoit les nouvelles notifications sans recharger la page.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Destinataires et création
-- ---------------------------------------------------------------------------

create or replace function public.utilisateurs_entreprise(p_entreprise uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(u.id), '{}')
  from public.utilisateurs u join public.entreprises e on e.id = u.entreprise_id
  where u.entreprise_id = p_entreprise and u.actif and e.statut = 'actif'
$$;

create or replace function public.utilisateurs_plateforme()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}') from public.utilisateurs where role_base in ('administrateur', 'superviseur') and actif
$$;

create or replace function public.notifier(p_destinataires uuid[], p_titre text, p_message text, p_lien text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (destinataire_id, email, titre, message, lien)
  select u.id, u.email, p_titre, p_message, p_lien
  from public.utilisateurs u
  where u.id = any (coalesce(p_destinataires, '{}')) and u.actif
$$;

revoke execute on function public.utilisateurs_entreprise(uuid) from public, anon, authenticated;
revoke execute on function public.utilisateurs_plateforme() from public, anon, authenticated;
revoke execute on function public.notifier(uuid[], text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Étapes du circuit de commande → notifications
-- ---------------------------------------------------------------------------

create or replace function public.notifier_evenement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.commandes;
  v_lien text;
  v_client uuid[];
  v_producteur uuid[];
  v_banque uuid[];
  v_plateforme uuid[];
  v_detail text := coalesce(new.commentaire, '');
begin
  select * into c from public.commandes where id = new.commande_id;
  v_lien := '/commandes/' || c.id;
  v_client := public.utilisateurs_entreprise(c.client_id);
  v_producteur := public.utilisateurs_entreprise(c.producteur_id);
  v_banque := case when c.banque_id is not null then public.utilisateurs_entreprise(c.banque_id) else '{}' end;
  v_plateforme := public.utilisateurs_plateforme();

  case new.action
    when 'soumise' then
      perform public.notifier(v_plateforme, 'Commande ' || c.numero || ' à approuver',
        (c.entete_client ->> 'denomination') || ' — ' || c.montant_total || ' FCFA', '/supervision/approbations/' || c.id);
    when 'approuvee' then
      perform public.notifier(v_client, 'Commande ' || c.numero || ' approuvée',
        'Livraison convenue le ' || to_char(c.date_livraison_convenue, 'DD/MM/YYYY') || '.', v_lien);
      if c.statut = 'attente_banque' then
        perform public.notifier(v_banque, 'Bon de paiement à traiter — commande ' || c.numero,
          'Montant : ' || c.montant_total || ' FCFA.', '/bons-paiement');
        perform public.notifier(v_producteur, 'Nouvelle commande ' || c.numero,
          'En attente de l''approbation du bon de paiement par la banque.', v_lien);
      else
        perform public.notifier(v_producteur, 'Nouvelle commande ' || c.numero || ' à valider',
          'Livraison convenue le ' || to_char(c.date_livraison_convenue, 'DD/MM/YYYY') || '.', v_lien);
      end if;
    when 'mise_en_attente' then
      perform public.notifier(v_client, 'Commande ' || c.numero || ' mise en attente', v_detail, v_lien);
    when 'refusee' then
      perform public.notifier(v_client, 'Commande ' || c.numero || ' refusée', v_detail, v_lien);
    when 'reorientee', 'repartie' then
      perform public.notifier(v_client, 'Commande ' || c.numero || case when new.action = 'reorientee' then ' réorientée' else ' répartie' end,
        'Votre commande a été confiée à un ou plusieurs autres producteurs. ' || v_detail, '/commandes');
    when 'approuvee_banque' then
      perform public.notifier(v_producteur, 'Commande ' || c.numero || ' à valider', 'Le bon de paiement a été approuvé par la banque.', v_lien);
      perform public.notifier(v_client, 'Bon de paiement approuvé — commande ' || c.numero, null, v_lien);
    when 'refusee_banque' then
      perform public.notifier(v_plateforme || v_client, 'Bon de paiement refusé — commande ' || c.numero, v_detail, v_lien);
    when 'validee' then
      perform public.notifier(v_client, 'Commande ' || c.numero || ' validée par le producteur',
        'Livraison prévue le ' || to_char(c.date_livraison_convenue, 'DD/MM/YYYY') || '.', v_lien);
    when 'refusee_producteur' then
      perform public.notifier(v_plateforme, 'Commande ' || c.numero || ' refusée par le producteur', v_detail, '/supervision/approbations/' || c.id);
    when 'livree' then
      perform public.notifier(v_client, 'Livraison reçue ? Confirmez la réception — commande ' || c.numero,
        'Bon de livraison ' || coalesce(new.donnees ->> 'bon_livraison', '') || '. Sans réponse dans le délai, la réception sera réputée conforme.', '/livraisons');
    when 'receptionnee', 'reception_tacite', 'arbitrage' then
      if new.donnees ? 'bon_reception' then
        perform public.notifier(v_producteur,
          case new.action when 'reception_tacite' then 'Réception tacite' when 'arbitrage' then 'Litige arbitré' else 'Réception confirmée' end
            || ' — ' || (new.donnees ->> 'bon_reception'),
          case when coalesce((new.donnees ->> 'ecart')::boolean, false) then 'Des écarts de quantité ont été enregistrés.' else null end, v_lien);
      end if;
      if new.action = 'arbitrage' then
        perform public.notifier(v_client, 'Litige arbitré — ' || (new.donnees ->> 'bon_reception'), v_detail, v_lien);
      end if;
    when 'litige' then
      perform public.notifier(v_plateforme, 'Litige de réception — commande ' || c.numero, v_detail, '/supervision/litiges');
      perform public.notifier(v_producteur, 'Réception contestée — commande ' || c.numero, v_detail, v_lien);
    when 'facture_definitive' then
      perform public.notifier(v_client, 'Facture ' || (new.donnees ->> 'facture') || ' à payer',
        'Montant : ' || (new.donnees ->> 'montant') || ' FCFA — voir l''échéancier.', '/factures');
    when 'echeance_payee' then
      perform public.notifier(v_client, 'Paiement confirmé — facture ' || (new.donnees ->> 'facture'),
        'Le producteur a confirmé la réception de ' || (new.donnees ->> 'montant') || ' FCFA.', '/echeances?onglet=payee');
    when 'soldee' then
      perform public.notifier(v_client || v_producteur, 'Commande ' || c.numero || ' soldée', 'Toutes les échéances sont payées.', v_lien);
    else
      null;
  end case;
  return null;
end;
$$;

create trigger notifications_commande after insert on public.commande_evenements
  for each row execute function public.notifier_evenement();

-- Besoin d'achat publié → producteurs qui offrent ou savent produire ce produit (ou le producteur choisi).
create or replace function public.notifier_besoin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produit text;
  v_producteurs uuid[];
begin
  select nom into v_produit from public.produits where id = new.produit_id;
  select coalesce(array_agg(distinct u.id), '{}') into v_producteurs
  from public.utilisateurs u
  join public.entreprises e on e.id = u.entreprise_id and e.type = 'producteur' and e.statut = 'actif'
  where u.actif
    and (
      (new.producteur_souhaite_id is not null and e.id = new.producteur_souhaite_id)
      or (new.producteur_souhaite_id is null and (
        exists (select 1 from public.offres o where o.producteur_id = e.id and o.produit_id = new.produit_id and o.statut in ('publiee', 'epuisee'))
        or exists (select 1 from public.capacites_production cp join public.sites_production s on s.id = cp.site_id
                   where s.entreprise_id = e.id and cp.produit_id = new.produit_id)
      ))
    );
  perform public.notifier(v_producteurs, 'Besoin d''achat : ' || v_produit,
    new.quantite || ' pour le ' || to_char(new.date_souhaitee, 'DD/MM/YYYY') || coalesce(' — ' || new.region_livraison, '') || '. Faites une proposition.',
    '/besoins/' || new.id);
  return null;
end;
$$;

create trigger notifications_besoin after insert on public.besoins_achat
  for each row execute function public.notifier_besoin();

create or replace function public.notifier_proposition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_besoin public.besoins_achat;
begin
  select * into v_besoin from public.besoins_achat where id = new.besoin_id;
  perform public.notifier(public.utilisateurs_entreprise(v_besoin.client_id), 'Nouvelle proposition — besoin ' || v_besoin.numero,
    new.quantite || ' à ' || new.prix_unitaire || ' FCFA l''unité.', '/besoins/' || v_besoin.id);
  return null;
end;
$$;

create trigger notifications_proposition after insert on public.propositions_besoin
  for each row execute function public.notifier_proposition();

create or replace function public.notifier_demande_acces()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notifier(
    (select coalesce(array_agg(id), '{}') from public.utilisateurs where role_base = 'administrateur' and actif),
    'Demande d''accès : ' || new.denomination, new.contact_nom || ' — ' || new.telephone, '/admin/demandes');
  return null;
end;
$$;

create trigger notifications_demande_acces after insert on public.demandes_acces
  for each row execute function public.notifier_demande_acces();

-- ---------------------------------------------------------------------------
-- Rappels planifiés (clé de service uniquement)
-- ---------------------------------------------------------------------------

alter table public.bons_reception add column rappel_48h_le timestamptz, add column rappel_24h_le timestamptz;
alter table public.echeances add column rappel_le timestamptz;

create or replace function public.rappels()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_nb integer := 0;
begin
  -- Réception tacite dans moins de 48 h, puis moins de 24 h
  for r in
    select br.id, br.numero, br.date_limite, c.client_id, br.rappel_48h_le, br.rappel_24h_le
    from public.bons_reception br join public.commandes c on c.id = br.commande_id
    where br.statut = 'en_attente' and br.date_limite > now() and br.date_limite <= now() + interval '48 hours'
      and (br.rappel_48h_le is null or (br.rappel_24h_le is null and br.date_limite <= now() + interval '24 hours'))
  loop
    perform public.notifier(public.utilisateurs_entreprise(r.client_id), 'Rappel : réception à confirmer — ' || r.numero,
      'Sans réponse avant le ' || to_char(r.date_limite at time zone 'Africa/Dakar', 'DD/MM/YYYY à HH24:MI') || ', la réception sera réputée conforme au bon de livraison.',
      '/livraisons');
    if r.rappel_48h_le is null then
      update public.bons_reception set rappel_48h_le = now(),
        rappel_24h_le = case when r.date_limite <= now() + interval '24 hours' then now() end
      where id = r.id;
    else
      update public.bons_reception set rappel_24h_le = now() where id = r.id;
    end if;
    v_nb := v_nb + 1;
  end loop;

  -- Échéances dans 3 jours
  for r in
    select e.id, e.montant, e.date_echeance, f.numero, f.client_id
    from public.echeances e join public.factures f on f.id = e.facture_id
    where e.statut = 'a_payer' and e.rappel_le is null and e.date_echeance between current_date and current_date + 3
  loop
    perform public.notifier(public.utilisateurs_entreprise(r.client_id), 'Échéance proche — facture ' || r.numero,
      r.montant || ' FCFA à payer le ' || to_char(r.date_echeance, 'DD/MM/YYYY') || '.', '/echeances?onglet=a_payer');
    update public.echeances set rappel_le = now() where id = r.id;
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;

-- Échéances passées non payées → en retard, avec notification du client et du producteur (remplace la version du lot 6).
create or replace function public.echeances_en_retard()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_nb integer := 0;
begin
  for r in
    update public.echeances e set statut = 'en_retard'
    from public.factures f
    where f.id = e.facture_id and e.statut = 'a_payer' and e.date_echeance < current_date
    returning e.montant, e.date_echeance, f.numero, f.client_id, f.producteur_id
  loop
    perform public.notifier(public.utilisateurs_entreprise(r.client_id) || public.utilisateurs_entreprise(r.producteur_id),
      'Échéance en retard — facture ' || r.numero,
      r.montant || ' FCFA attendus le ' || to_char(r.date_echeance, 'DD/MM/YYYY') || '.', '/echeances');
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;

revoke execute on function public.rappels() from public, anon, authenticated;
revoke execute on function public.echeances_en_retard() from public, anon, authenticated;
grant execute on function public.rappels() to service_role;
grant execute on function public.echeances_en_retard() to service_role;
