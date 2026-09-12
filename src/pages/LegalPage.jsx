import { Cookie, FileText, LockKeyhole, Scale, ShieldCheck, Store } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { LEGAL_VERSION } from '../lib/legal'

const SECTIONS = {
  conditions: {
    icon: Scale,
    eyebrow: 'Informations légales',
    title: 'Conditions d’utilisation',
    intro: 'Les présentes conditions encadrent l’utilisation de One Market, la création d’un compte et les achats effectués sur la marketplace.',
    blocks: [
      ['1. One Market', 'One Market est une marketplace exploitée par NKS Services. Elle met en relation des clients et des boutiques autorisées à vendre sur la plateforme en République démocratique du Congo.'],
      ['2. Compte utilisateur', 'Pour commander, l’utilisateur doit fournir des informations exactes, protéger ses identifiants et utiliser son compte de manière loyale. Un compte peut être limité ou suspendu en cas de fraude, d’abus ou de violation des présentes conditions.'],
      ['3. Produits et boutiques', 'Les produits sont proposés par les boutiques indiquées sur leurs fiches. One Market peut vérifier, masquer ou retirer une annonce qui présente un risque, enfreint les règles de la marketplace ou contient des informations trompeuses.'],
      ['4. Commandes', 'Une commande est confirmée selon la disponibilité réelle du produit et le traitement de la boutique concernée. Pour un panier multi-boutiques, chaque vendeur ne reçoit que les articles qui lui sont destinés.'],
      ['5. Paiement à la livraison', 'Le moyen de paiement actuellement disponible est le paiement à la livraison. Le client paie directement le livreur au moment de recevoir la commande. Aucun débit bancaire en ligne n’est effectué par One Market pour ce mode.'],
      ['6. Livraison', 'Le client choisit le mode de livraison disponible au moment de commander. Les frais de livraison sont affichés séparément du prix des produits lorsqu’ils sont exprimés dans une devise différente.'],
      ['7. Utilisation interdite', 'Il est interdit d’utiliser One Market pour vendre des produits illicites, contrefaits, dangereux, volés, trompeurs ou interdits par la loi applicable, ainsi que pour frauder, contourner les contrôles de sécurité ou porter atteinte à d’autres utilisateurs.'],
      ['8. Évolution du service', 'One Market peut faire évoluer ses fonctionnalités, ses règles et ses conditions afin d’améliorer le service, la sécurité ou respecter les obligations applicables. Une nouvelle version des conditions pourra nécessiter une nouvelle acceptation.'],
    ],
  },
  confidentialite: {
    icon: LockKeyhole,
    eyebrow: 'Protection des données',
    title: 'Politique de confidentialité',
    intro: 'Cette politique explique quelles données One Market utilise, pourquoi elles sont nécessaires et comment elles sont protégées.',
    blocks: [
      ['Données collectées', 'Nous pouvons traiter les informations du compte, coordonnées, adresses de livraison, commandes, favoris, messages, notifications, demandes d’assistance et données nécessaires à la sécurité. Pour les vendeurs, des documents de vérification d’identité ou d’activité peuvent également être demandés.'],
      ['Finalités', 'Ces données servent à fournir la marketplace, traiter les commandes, organiser la livraison, sécuriser les comptes, vérifier les vendeurs, assurer le support, prévenir la fraude et améliorer le fonctionnement de One Market.'],
      ['Documents vendeurs', 'Les pièces d’identité et documents légaux vendeur sont stockés dans un espace privé. Ils ne sont pas publiés sur les pages boutiques et leur accès est limité aux personnes autorisées pour la vérification et la sécurité.'],
      ['Prestataires techniques', 'One Market utilise notamment Supabase pour certaines fonctions de base de données, authentification et stockage privé, ainsi que Cloudinary pour les images publiques de boutiques et produits. Les documents d’identité vendeur ne sont pas placés dans le stockage public d’images.'],
      ['Durée de conservation', 'Les données sont conservées pendant la durée nécessaire à la fourniture du service, au suivi des commandes, à la sécurité, aux obligations applicables et au règlement d’éventuels litiges. Les données devenues inutiles peuvent être supprimées ou anonymisées.'],
      ['Vos choix', 'Vous pouvez mettre à jour vos informations depuis votre compte et contacter One Market pour toute demande relative à vos données. Certaines informations liées à une transaction ou à la sécurité peuvent devoir être conservées pendant une durée supplémentaire.'],
      ['Contact', 'Pour une question concernant la confidentialité ou vos données, contactez NKS Services à nksserviceshelp@gmail.com.'],
    ],
  },
  cookies: {
    icon: Cookie,
    eyebrow: 'Préférences',
    title: 'Cookies et stockage local',
    intro: 'One Market utilise uniquement les technologies nécessaires au fonctionnement du site et respecte le choix enregistré dans votre navigateur.',
    blocks: [
      ['Stockage essentiel', 'Le site utilise des mécanismes de stockage du navigateur pour maintenir la session, mémoriser certaines préférences, sécuriser l’expérience et éviter de redemander inutilement certains choix. Ces éléments sont nécessaires au fonctionnement normal de la marketplace.'],
      ['Mesure et personnalisation', 'Aucun cookie publicitaire n’est nécessaire pour utiliser One Market. Si des outils de mesure ou de personnalisation non essentiels sont ajoutés à l’avenir, leur utilisation devra respecter le choix de consentement présenté à l’utilisateur.'],
      ['Votre choix', 'Vous pouvez accepter les préférences proposées ou conserver uniquement les éléments essentiels. Vous pouvez également supprimer les données du site depuis les réglages de votre navigateur, ce qui peut vous déconnecter ou réinitialiser certaines préférences.'],
      ['Notifications', 'L’autorisation de notifications du navigateur est distincte des cookies. Elle n’est activée qu’après votre accord et peut être retirée à tout moment depuis les paramètres du navigateur ou de l’appareil.'],
    ],
  },
  vendeurs: {
    icon: Store,
    eyebrow: 'Vendre sur One Market',
    title: 'Conditions vendeur',
    intro: 'Ces conditions complètent les conditions générales pour toute personne ou entreprise qui demande l’ouverture d’une boutique One Market.',
    blocks: [
      ['Vérification obligatoire', 'L’ouverture d’une boutique est soumise à une vérification One Market. Un particulier doit au minimum justifier son identité. Une entreprise peut devoir fournir des documents professionnels ou légaux adaptés à son statut. One Market peut demander des informations complémentaires avant de prendre une décision.'],
      ['Exactitude des informations', 'Le vendeur garantit que son identité, ses coordonnées, ses documents, ses réseaux, ses produits, prix, stocks, descriptions et images sont exacts et qu’il dispose du droit de vendre les articles proposés.'],
      ['Produits autorisés', 'Le vendeur ne peut publier aucun produit interdit par la loi ou les règles de One Market, notamment des produits contrefaits, volés, dangereux, trompeurs ou dont la commercialisation nécessite une autorisation qu’il ne possède pas.'],
      ['Commandes et stock', 'Le vendeur doit maintenir son stock à jour, traiter les commandes dans des délais raisonnables et signaler rapidement toute impossibilité de fournir un produit. Les changements de statut doivent refléter la situation réelle de la commande.'],
      ['Badges One Market', 'Les badges “Boutique vérifiée” et “Partenaire One Market” sont attribués uniquement par One Market. Ils peuvent être retirés si les critères ne sont plus remplis ou si le vendeur enfreint les règles de la marketplace.'],
      ['Suspension', 'One Market peut suspendre une boutique, limiter ses annonces ou demander une nouvelle vérification en cas de fraude présumée, documents expirés, plaintes importantes, activité interdite ou risque pour les utilisateurs.'],
      ['Données et documents', 'Le vendeur autorise One Market à traiter les informations et documents transmis uniquement pour la gestion du compte vendeur, la vérification, la sécurité, le support et les obligations applicables, conformément à la politique de confidentialité.'],
    ],
  },
}

export default function LegalPage() {
  const { section } = useParams()
  const data = SECTIONS[section]
  if (!data) return <Navigate to="/legal/conditions" replace />
  const Icon = data.icon || FileText

  return (
    <main className="legal-page section-shell">
      <header className="legal-hero">
        <div className="legal-icon"><Icon size={26}/></div>
        <div><span className="eyebrow">{data.eyebrow}</span><h1>{data.title}</h1><p>{data.intro}</p><small>Version {LEGAL_VERSION} · One Market par NKS Services</small></div>
      </header>

      <div className="legal-layout">
        <aside className="legal-nav" aria-label="Documents légaux">
          <Link className={section === 'conditions' ? 'active' : ''} to="/legal/conditions"><Scale size={17}/> Conditions</Link>
          <Link className={section === 'confidentialite' ? 'active' : ''} to="/legal/confidentialite"><ShieldCheck size={17}/> Confidentialité</Link>
          <Link className={section === 'cookies' ? 'active' : ''} to="/legal/cookies"><Cookie size={17}/> Cookies</Link>
          <Link className={section === 'vendeurs' ? 'active' : ''} to="/legal/vendeurs"><Store size={17}/> Vendeurs</Link>
        </aside>
        <article className="legal-content">
          {data.blocks.map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}
          <div className="legal-contact"><ShieldCheck size={20}/><div><strong>Une question ?</strong><span>Contact : nksserviceshelp@gmail.com</span></div></div>
        </article>
      </div>
    </main>
  )
}
