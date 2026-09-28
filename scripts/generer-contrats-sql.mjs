// Génère la migration des contrats d'engagement à partir du texte de référence ../pcas_contrats_engagement.md,
// pour que le texte publié soit exactement celui qui a été relu.
//
//   node scripts/generer-contrats-sql.mjs 1.0 supabase/migrations/02_contrats_v1.sql
//
// Chaque contrat va de son « **Entre** » à la ligne « Fait et accepté… » (exclue : le bloc d'acceptation est ajouté par
// l'application). Les champs de l'en-tête deviennent des marqueurs {{…}} remplacés à l'affichage ; les délais proposés
// entre crochets ([12 mois]) sont conservés sans les crochets.
import { readFileSync, writeFileSync } from 'node:fs'

const [version, sortie] = process.argv.slice(2)
if (!version || !sortie) {
  console.error('Usage : node scripts/generer-contrats-sql.mjs <version> <fichier.sql>')
  process.exitCode = 1
} else {
  const source = readFileSync(new URL('../../pcas_contrats_engagement.md', import.meta.url), 'utf8').replace(/\r/g, '')

  const extraire = (titre, role) => {
    const debut = source.indexOf(`## ${titre}`)
    if (debut < 0) throw new Error(`Section introuvable : ${titre}`)
    const section = source.slice(debut)
    const corps = section.slice(section.indexOf('**Entre**'), section.indexOf('\nFait et accepté')).trim()
    const texte = corps
      .replace(
        /\*\*et\*\* l'entreprise .*$/m,
        `**et** l'entreprise {{denomination}}, {{type_identifiant}} {{identifiant_fiscal}}, RCCM {{rccm}}, dont le siège est à {{adresse}}, représentée par {{signataire}}, {{fonction}}, dûment habilité(e), ci-après « ${role} ».`
      )
      .replace(/\[(\d+ (?:mois|jours ouvrés|jours|heures))\]/g, '$1')
    const restes = texte.match(/\[[^\]]*\]/g)
    if (restes) throw new Error(`Crochets non traités dans « ${titre} » : ${restes.join(', ')}`)
    if (texte.includes('$contrat$')) throw new Error('Le texte contient le délimiteur $contrat$')
    return texte
  }

  const producteur = extraire(`CONTRAT D'ENGAGEMENT PRODUCTEUR — version ${version}`, 'le Producteur')
  const client = extraire(`CONTRAT D'ENGAGEMENT CLIENT — version ${version}`, 'le Client')

  const sql = `-- PCAS — Contrats d'engagement, version ${version} (producteur et client), publiés directement.
-- Généré par scripts/generer-contrats-sql.mjs depuis pcas_contrats_engagement.md : ne pas modifier à la main.
-- Les champs {{…}} sont remplacés à l'affichage par la fiche de l'entreprise et l'identité du signataire ;
-- l'empreinte SHA-256 porte sur le texte ci-dessous.

update public.modeles_contrat set statut = 'archive' where statut = 'en_vigueur';

insert into public.modeles_contrat (type, version, titre, contenu, statut, publie_le, empreinte_sha256)
select type, '${version}', titre, contenu, 'en_vigueur', now(), encode(extensions.digest(convert_to(contenu, 'UTF8'), 'sha256'), 'hex')
from (values
  ('producteur', 'Contrat d''engagement producteur', $contrat$${producteur}$contrat$),
  ('client', 'Contrat d''engagement client', $contrat$${client}$contrat$)
) as v (type, titre, contenu);
`
  writeFileSync(sortie, sql)
  console.log(`${sortie} : producteur ${producteur.length} caractères, client ${client.length} caractères`)
}
