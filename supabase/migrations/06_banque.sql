-- PCAS — Lot 5 : bons de paiement bancaires.
-- Quand le superviseur approuve une commande payée par bon, un bon de paiement est émis à la banque choisie par le
-- client. La commande n'est transmise au producteur qu'après l'approbation de la banque (référence bancaire obligatoire).
-- Un refus renvoie la commande au superviseur (refus définitif ou réorientation).

create table public.bons_paiement (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  commande_id uuid not null references public.commandes (id) on delete cascade,
  banque_id uuid not null references public.entreprises (id) on delete restrict,
  montant bigint not null check (montant > 0),
  statut text not null default 'soumis' check (statut in ('soumis', 'approuve', 'refuse')),
  reference_bancaire text,
  commentaire text check (length(commentaire) <= 1000),
  decide_par uuid references auth.users (id) on delete set null,
  decide_le timestamptz,
  created_at timestamptz not null default now(),
  check (statut <> 'approuve' or length(trim(coalesce(reference_bancaire, ''))) > 0)
);

create index bons_banque_idx on public.bons_paiement (banque_id, statut, created_at desc);
create index bons_commande_idx on public.bons_paiement (commande_id);
create unique index bons_un_en_cours on public.bons_paiement (commande_id) where statut = 'soumis';

alter table public.bons_paiement enable row level security;

-- Lecture : la plateforme, la banque destinataire, et les parties qui voient la commande (client ; producteur une fois approuvée).
-- Aucune écriture directe : émission par approuver_commande(), décision par decider_bon_paiement().
create policy bons_lecture on public.bons_paiement for select to authenticated
  using (
    public.est_plateforme()
    or banque_id = public.mon_entreprise_id()
    or exists (select 1 from public.commandes c where c.id = commande_id)
  );

-- Approbation par le superviseur (remplace la version du lot 4) : émission du bon de paiement si nécessaire.
create or replace function public.approuver_commande(p_commande uuid, p_date_convenue date, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande public.commandes;
  v_statut text := 'approuvee';
begin
  v_commande := public.commande_a_superviser(p_commande, array['soumise', 'en_attente', 'refusee_producteur']);
  if p_date_convenue is null or p_date_convenue < current_date then
    raise exception 'Fixez une date de livraison convenue (aujourd''hui ou plus tard)';
  end if;
  if exists (
    select 1 from public.lignes_commande
    where commande_id = p_commande and date_disponibilite is not null and date_disponibilite > p_date_convenue
  ) then
    raise exception 'La date convenue précède la date de disponibilité d''une offre à date de la commande';
  end if;

  if v_commande.mode_paiement = 'bon_banque' then
    if exists (select 1 from public.bons_paiement where commande_id = p_commande and statut = 'approuve') then
      v_statut := 'approuvee_banque'; -- bon déjà accordé (commande revenue du producteur) : pas de nouveau bon
    else
      v_statut := 'attente_banque';
      if not exists (select 1 from public.bons_paiement where commande_id = p_commande and statut = 'soumis') then
        insert into public.bons_paiement (numero, commande_id, banque_id, montant)
        values (public.prochain_numero('BP'), p_commande, v_commande.banque_id, v_commande.montant_total);
      end if;
    end if;
  end if;

  update public.commandes
  set statut = v_statut,
      date_livraison_convenue = p_date_convenue,
      approuvee_le = coalesce(approuvee_le, now()),
      motif = null
  where id = p_commande;
  perform public.tracer_commande(
    p_commande, 'approuvee', nullif(trim(coalesce(p_commentaire, '')), ''),
    jsonb_build_object('date_livraison_convenue', p_date_convenue)
  );
end;
$$;

-- Décision de la banque sur un bon de paiement.
create or replace function public.decider_bon_paiement(p_bon uuid, p_decision text, p_reference text, p_commentaire text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bon public.bons_paiement;
  v_commande public.commandes;
begin
  if public.mon_role() <> 'financier' then
    raise exception 'Réservé à la banque destinataire du bon';
  end if;
  select * into v_bon from public.bons_paiement where id = p_bon for update;
  if not found or v_bon.banque_id is distinct from public.mon_entreprise_id() then
    raise exception 'Bon de paiement introuvable';
  end if;
  if v_bon.statut <> 'soumis' then
    raise exception 'Ce bon de paiement a déjà été traité';
  end if;
  select * into v_commande from public.commandes where id = v_bon.commande_id for update;
  if v_commande.statut <> 'attente_banque' then
    raise exception 'La commande n''attend plus de décision de la banque (statut « % »)', v_commande.statut;
  end if;

  if p_decision = 'approuve' then
    if length(trim(coalesce(p_reference, ''))) < 2 then
      raise exception 'Indiquez la référence bancaire de l''engagement';
    end if;
    update public.bons_paiement
    set statut = 'approuve', reference_bancaire = trim(p_reference), commentaire = nullif(trim(coalesce(p_commentaire, '')), ''),
        decide_par = auth.uid(), decide_le = now()
    where id = p_bon;
    update public.commandes set statut = 'approuvee_banque' where id = v_commande.id;
    perform public.tracer_commande(v_commande.id, 'approuvee_banque', nullif(trim(coalesce(p_commentaire, '')), ''),
      jsonb_build_object('bon', v_bon.numero, 'reference', trim(p_reference)));
  elsif p_decision = 'refuse' then
    if length(trim(coalesce(p_commentaire, ''))) < 3 then
      raise exception 'Indiquez le motif du refus';
    end if;
    update public.bons_paiement
    set statut = 'refuse', commentaire = trim(p_commentaire), decide_par = auth.uid(), decide_le = now()
    where id = p_bon;
    update public.commandes set statut = 'refusee_banque', motif = trim(p_commentaire) where id = v_commande.id;
    perform public.tracer_commande(v_commande.id, 'refusee_banque', trim(p_commentaire), jsonb_build_object('bon', v_bon.numero));
  else
    raise exception 'Décision inconnue';
  end if;
end;
$$;

revoke execute on function public.decider_bon_paiement(uuid, text, text, text) from public, anon;
grant execute on function public.decider_bon_paiement(uuid, text, text, text) to authenticated;
