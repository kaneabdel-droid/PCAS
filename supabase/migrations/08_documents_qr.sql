-- PCAS — Lot 7 : QR code, signature et traçabilité.
-- Chaque document (commande, bon de paiement, bon de livraison, bon de réception, facture) est enregistré à son émission
-- avec un jeton public aléatoire (encodé dans son QR code) et l'empreinte SHA-256 de son contenu figé. La page publique
-- /v/<jeton> vérifie l'authenticité (empreinte recalculée) et montre les étapes de la commande ; les montants et le détail
-- ne sont visibles que des parties concernées (client, producteur, banque le cas échéant, superviseur, administrateur).
-- Les contrats acceptés ont déjà leur jeton (acceptations_contrat.jeton_public) et sont vérifiables de la même façon.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('commande', 'bon_paiement', 'bon_livraison', 'bon_reception', 'facture')),
  document_id uuid not null,
  commande_id uuid not null references public.commandes (id) on delete cascade,
  numero text not null,
  jeton_public text not null unique default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  empreinte_sha256 text not null,
  emis_le timestamptz not null default now(),
  unique (type, document_id)
);

create index documents_commande_idx on public.documents (commande_id);

alter table public.documents enable row level security;
-- Lecture par quiconque voit la commande (pour afficher le QR sur le document) ; écriture par trigger uniquement.
create policy documents_lecture on public.documents for select to authenticated
  using (public.est_plateforme() or exists (select 1 from public.commandes c where c.id = commande_id));

-- ---------------------------------------------------------------------------
-- Contenu canonique d'un document (ce que l'empreinte garantit). Les statuts qui évoluent après l'émission
-- (paiement, avancement) n'en font pas partie : ils sont montrés à part, comme étapes.
-- ---------------------------------------------------------------------------

create or replace function public.contenu_document(p_type text, p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'commande' then (
      select jsonb_build_object(
        'numero', c.numero, 'client', c.entete_client, 'producteur_id', c.producteur_id, 'mode_paiement', c.mode_paiement,
        'banque_id', c.banque_id, 'adresse_livraison', c.adresse_livraison, 'date_souhaitee', c.date_souhaitee,
        'montant_total', c.montant_total, 'soumise_le', c.soumise_le,
        'lignes', (select jsonb_agg(jsonb_build_object('produit_id', l.produit_id, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire) order by l.id)
                   from public.lignes_commande l where l.commande_id = c.id),
        'echeancier', (select jsonb_agg(jsonb_build_object('rang', e.rang, 'pourcentage', e.pourcentage, 'delai_jours', e.delai_jours) order by e.rang)
                       from public.echeancier_commande e where e.commande_id = c.id)
      )
      from public.commandes c where c.id = p_id)
    when 'bon_paiement' then (
      select jsonb_build_object('numero', b.numero, 'commande_id', b.commande_id, 'banque_id', b.banque_id, 'montant', b.montant, 'emis_le', b.created_at)
      from public.bons_paiement b where b.id = p_id)
    when 'bon_livraison' then (
      select jsonb_build_object(
        'numero', b.numero, 'commande_id', b.commande_id, 'date_livraison', b.date_livraison, 'transporteur', b.transporteur,
        'immatriculation', b.immatriculation, 'chauffeur', b.chauffeur,
        'lignes', (select jsonb_agg(jsonb_build_object('produit_id', l.produit_id, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire) order by l.id)
                   from public.bl_lignes l where l.bl_id = b.id)
      )
      from public.bons_livraison b where b.id = p_id)
    when 'bon_reception' then (
      select jsonb_build_object(
        'numero', r.numero, 'bl_id', r.bl_id, 'statut', r.statut, 'commentaire', r.commentaire, 'motif_litige', r.motif_litige,
        'commentaire_arbitrage', r.commentaire_arbitrage,
        'lignes', (select jsonb_agg(jsonb_build_object('bl_ligne_id', l.bl_ligne_id, 'livree', l.quantite_livree, 'recue', l.quantite_recue, 'motif', l.motif_ecart) order by l.bl_ligne_id)
                   from public.br_lignes l where l.br_id = r.id)
      )
      from public.bons_reception r where r.id = p_id)
    when 'facture' then (
      select jsonb_build_object(
        'numero', f.numero, 'nature', f.nature, 'commande_id', f.commande_id, 'bl_id', f.bl_id, 'date_facture', f.date_facture,
        'montant_total', f.montant_total, 'compte_bancaire', f.compte_bancaire, 'mention_tva', f.mention_tva,
        'lignes', (select jsonb_agg(jsonb_build_object('produit_id', l.produit_id, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire, 'montant', l.montant) order by l.id)
                   from public.lignes_facture l where l.facture_id = f.id),
        'echeances', (select jsonb_agg(jsonb_build_object('rang', e.rang, 'date_echeance', e.date_echeance, 'montant', e.montant) order by e.rang)
                      from public.echeances e where e.facture_id = f.id)
      )
      from public.factures f where f.id = p_id)
  end
$$;

create or replace function public.empreinte_document(p_type text, p_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(public.contenu_document(p_type, p_id)::text, 'UTF8'), 'sha256'), 'hex')
$$;

revoke execute on function public.contenu_document(text, uuid) from public, anon, authenticated;
revoke execute on function public.empreinte_document(text, uuid) from public, anon, authenticated;

-- Enregistrement à la fin de la transaction (trigger différé) : les lignes, montants et échéances insérés après l'en-tête
-- dans la même opération font partie du contenu figé.
create or replace function public.enregistrer_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := tg_argv[0];
  v_commande uuid;
begin
  if v_type = 'bon_reception' and new.statut not in ('approuve', 'approuve_avec_reserves', 'tacite', 'arbitre') then
    return null; -- le bon de réception est figé à la décision (approbation, réception tacite ou arbitrage)
  end if;
  v_commande := case when v_type = 'commande' then new.id else new.commande_id end;
  insert into public.documents (type, document_id, commande_id, numero, empreinte_sha256)
  values (v_type, new.id, v_commande, new.numero, public.empreinte_document(v_type, new.id))
  on conflict (type, document_id) do nothing;
  return null;
end;
$$;

create constraint trigger document_commande after insert on public.commandes
  deferrable initially deferred for each row execute function public.enregistrer_document('commande');
create constraint trigger document_bon_paiement after insert on public.bons_paiement
  deferrable initially deferred for each row execute function public.enregistrer_document('bon_paiement');
create constraint trigger document_bon_livraison after insert on public.bons_livraison
  deferrable initially deferred for each row execute function public.enregistrer_document('bon_livraison');
create constraint trigger document_bon_reception after update on public.bons_reception
  deferrable initially deferred for each row execute function public.enregistrer_document('bon_reception');
create constraint trigger document_facture after insert on public.factures
  deferrable initially deferred for each row execute function public.enregistrer_document('facture');

-- Documents déjà émis avant ce lot
insert into public.documents (type, document_id, commande_id, numero, empreinte_sha256)
select 'commande', id, id, numero, public.empreinte_document('commande', id) from public.commandes
union all
select 'bon_paiement', id, commande_id, numero, public.empreinte_document('bon_paiement', id) from public.bons_paiement
union all
select 'bon_livraison', id, commande_id, numero, public.empreinte_document('bon_livraison', id) from public.bons_livraison
union all
select 'bon_reception', id, commande_id, numero, public.empreinte_document('bon_reception', id)
from public.bons_reception where statut in ('approuve', 'approuve_avec_reserves', 'tacite', 'arbitre')
union all
select 'facture', id, commande_id, numero, public.empreinte_document('facture', id) from public.factures
on conflict (type, document_id) do nothing;

-- ---------------------------------------------------------------------------
-- Vérification publique d'un document par son jeton (page /v/<jeton>, accessible sans connexion)
-- ---------------------------------------------------------------------------

-- « Abdou Aziz Kane » → « Abdou A. K. » : noms des validateurs partiellement masqués pour qui n'est pas partie à la commande.
create or replace function public.masquer_nom(p_nom text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_nom is null or trim(p_nom) = '' then null
    else (
      select string_agg(case when n = 1 then mot else left(mot, 1) || '.' end, ' ' order by n)
      from unnest(regexp_split_to_array(trim(p_nom), '\s+')) with ordinality as t (mot, n)
    )
  end
$$;

create or replace function public.verifier_document(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_doc public.documents;
  v_acceptation public.acceptations_contrat;
  v_commande public.commandes;
  v_partie boolean;
  v_statut text;
  v_detail jsonb;
  v_remplacee text;
begin
  select * into v_doc from public.documents where jeton_public = p_jeton;

  if not found then
    -- Contrat d'engagement accepté
    select * into v_acceptation from public.acceptations_contrat where jeton_public = p_jeton;
    if not found then
      return jsonb_build_object('trouve', false);
    end if;
    return jsonb_build_object(
      'trouve', true,
      'type', 'contrat',
      'numero', (select titre || ' — version ' || version from public.modeles_contrat where id = v_acceptation.modele_id),
      'emis_le', v_acceptation.accepte_le,
      'conforme', true,
      'statut', (select statut from public.modeles_contrat where id = v_acceptation.modele_id),
      'emetteur', (select denomination from public.entreprises where id = v_acceptation.entreprise_id),
      'signataire', case
        when public.est_plateforme() or v_acceptation.entreprise_id = public.mon_entreprise_id() then v_acceptation.nom_signataire
        else public.masquer_nom(v_acceptation.nom_signataire)
      end,
      'empreinte', (select empreinte_sha256 from public.modeles_contrat where id = v_acceptation.modele_id)
    );
  end if;

  select * into v_commande from public.commandes where id = v_doc.commande_id;
  v_partie := public.est_plateforme()
    or public.mon_entreprise_id() in (v_commande.client_id, v_commande.producteur_id)
    or (v_commande.banque_id is not null and v_commande.approuvee_le is not null and public.mon_entreprise_id() = v_commande.banque_id);

  v_statut := case v_doc.type
    when 'commande' then v_commande.statut
    when 'bon_paiement' then (select statut from public.bons_paiement where id = v_doc.document_id)
    when 'bon_livraison' then coalesce((select 'reception_' || statut from public.bons_reception where bl_id = v_doc.document_id), 'emis')
    when 'bon_reception' then (select statut from public.bons_reception where id = v_doc.document_id)
    when 'facture' then (select statut from public.factures where id = v_doc.document_id)
  end;

  if v_doc.type = 'facture' then
    select d.numero into v_remplacee
    from public.factures_definitives_provisoires l join public.factures d on d.id = l.facture_definitive_id
    where l.facture_provisoire_id = v_doc.document_id;
  end if;

  if v_partie then
    v_detail := jsonb_build_object(
      'montant', case v_doc.type
        when 'commande' then v_commande.montant_total
        when 'bon_paiement' then (select montant from public.bons_paiement where id = v_doc.document_id)
        when 'facture' then (select montant_total from public.factures where id = v_doc.document_id)
        when 'bon_livraison' then (select sum(round(quantite * prix_unitaire)) from public.bl_lignes where bl_id = v_doc.document_id)
      end,
      'lignes', case v_doc.type
        when 'commande' then (select jsonb_agg(jsonb_build_object('produit', p.nom, 'unite', p.unite, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire) order by p.nom)
                              from public.lignes_commande l join public.produits p on p.id = l.produit_id where l.commande_id = v_commande.id)
        when 'bon_livraison' then (select jsonb_agg(jsonb_build_object('produit', p.nom, 'unite', p.unite, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire) order by p.nom)
                                   from public.bl_lignes l join public.produits p on p.id = l.produit_id where l.bl_id = v_doc.document_id)
        when 'bon_reception' then (select jsonb_agg(jsonb_build_object('produit', p.nom, 'unite', p.unite, 'quantite', l.quantite_recue, 'livree', l.quantite_livree) order by p.nom)
                                   from public.br_lignes l join public.bl_lignes b on b.id = l.bl_ligne_id join public.produits p on p.id = b.produit_id
                                   where l.br_id = v_doc.document_id)
        when 'facture' then (select jsonb_agg(jsonb_build_object('produit', p.nom, 'unite', p.unite, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire) order by p.nom)
                             from public.lignes_facture l join public.produits p on p.id = l.produit_id where l.facture_id = v_doc.document_id)
      end,
      'lien', case v_doc.type
        when 'commande' then '/commandes/' || v_commande.id
        when 'bon_paiement' then '/bons-paiement/' || v_doc.document_id
        when 'bon_livraison' then '/livraisons/' || v_doc.document_id
        when 'bon_reception' then '/livraisons/' || (select bl_id from public.bons_reception where id = v_doc.document_id)
        when 'facture' then '/factures/' || v_doc.document_id
      end
    );
  end if;

  return jsonb_build_object(
    'trouve', true,
    'type', v_doc.type,
    'numero', v_doc.numero,
    'emis_le', v_doc.emis_le,
    'conforme', public.empreinte_document(v_doc.type, v_doc.document_id) = v_doc.empreinte_sha256,
    'empreinte', v_doc.empreinte_sha256,
    'statut', v_statut,
    'remplacee_par', v_remplacee,
    'commande', v_commande.numero,
    'commande_statut', v_commande.statut,
    'client', v_commande.entete_client ->> 'denomination',
    'producteur', (select denomination from public.entreprises where id = v_commande.producteur_id),
    'partie', v_partie,
    'detail', v_detail,
    'etapes', (
      select jsonb_agg(jsonb_build_object(
        'action', e.action,
        'horodatage', e.horodatage,
        'role', e.acteur_role,
        'acteur', case when v_partie then e.acteur_nom else public.masquer_nom(e.acteur_nom) end
      ) order by e.horodatage)
      from public.commande_evenements e where e.commande_id = v_commande.id
    )
  );
end;
$$;

revoke execute on function public.verifier_document(text) from public;
grant execute on function public.verifier_document(text) to anon, authenticated;
