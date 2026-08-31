# One Market — V6

> **Produit NKS Services** — Marketplace multi-vendeurs conçue pour fonctionner avec plusieurs marchés, notamment la **RDC** et les **États-Unis**.

Ce dépôt est la base officielle du **frontend public / client** de One Market V6. Il est volontairement documenté pour faciliter la reprise du projet par un développeur, un responsable régional ou le futur responsable **One Market USA**.

## ⚠️ À lire avant toute modification

La V6 présente dans ce dépôt implémente principalement **l'espace Client / Utilisateur**. Les espaces **Super Admin**, **Admin Pays**, **Vendeur** et **Livreur** font partie de l'architecture cible, mais ne sont pas encore inclus comme dashboards complets dans cette V6.

Ne pas confondre :

- **ce qui existe déjà dans le code** ;
- **ce qui existe dans Supabase** ;
- **ce qui est prévu dans la roadmap**.

Le fichier [`PROJECT_STATUS.md`](PROJECT_STATUS.md) donne l'état exact.

## Démarrage ultra rapide

```bash
npm install
cp .env.example .env.local
# renseigner Supabase dans .env.local
npm run dev
```

Build production :

```bash
npm run build
```

Le résultat est généré dans `dist/`.

## Stack actuelle

| Couche | Service / technologie | État |
|---|---|---|
| Frontend | React 18 | ✅ Intégré |
| Routing | React Router | ✅ Intégré |
| Build | Vite | ✅ Intégré |
| Icônes | Lucide React | ✅ Intégré |
| Auth | Supabase Auth | ✅ Intégré |
| Base de données | Supabase PostgreSQL | ✅ Intégré |
| Realtime | Supabase Realtime | ✅ Intégré |
| Checkout métier | Supabase RPC `checkout_cart` | ✅ Intégré |
| Hébergement | Netlify | 🟦 Préparé par `netlify.toml` |
| Emails | EmailJS | 🟨 Prévu / à brancher dans cette V6 |
| Médias | URLs stockées en base (`secure_url`, `logo_url`, etc.) | ✅ Lu par le frontend |
| Upload médias | Cloudinary / service média | 🟨 À confirmer / brancher pour les dashboards |
| Paiement USA | Stripe / Stripe Connect | 🟨 Roadmap |
| Paiement RDC | PSP local / Mobile Money / carte | 🟨 Roadmap |
| Source code | GitHub | ✅ Ce dépôt |

## Les utilisateurs One Market

Architecture cible :

```text
NKS SERVICES / ONE MARKET
│
├── Super Admin / Owner NKS
├── Super Admin One Market — responsable principal USA
│   └── gouvernance globale et tous les pays
│
├── Admin Pays
│   ├── Admin RDC
│   └── Admin USA
│
├── Vendeurs
├── Livreurs
└── Clients / Utilisateurs
```

Le responsable principal de One Market USA est un **Super Admin One Market** : il dispose des mêmes pouvoirs opérationnels de gestion que le Super Admin / Owner, avec une responsabilité quotidienne centrée sur le marché US. NKS Services conserve la propriété du produit, des comptes racines et des décisions de propriété. Voir [`docs/02_ROLES_AND_PERMISSIONS.md`](docs/02_ROLES_AND_PERMISSIONS.md).

## Routes actuellement présentes

| Route | Écran | Accès |
|---|---|---|
| `/` | Accueil | Public |
| `/catalog` | Catalogue + recherche + filtres | Public |
| `/stores` | Liste des boutiques | Public |
| `/store/:slug` | Boutique | Public |
| `/product/:id` | Fiche produit | Public |
| `/auth` | Connexion / création de compte | Public |
| `/cart` | Panier multi-boutiques | Client connecté |
| `/checkout` | Adresse + création de commande | Client connecté |
| `/orders` | Mes commandes | Client connecté |
| `/orders/:id` | Détail d'une commande et sous-commandes vendeurs | Client connecté |
| `/chat/:id` | Chat client ↔ vendeur | Client connecté |
| `/account` | Profil client | Client connecté |

## Logique marketplace importante

Une commande One Market peut contenir des articles de plusieurs boutiques. Le panier est donc regroupé visuellement par boutique et le backend transforme une commande globale en **plusieurs `seller_orders`**. Chaque vendeur ne doit traiter que sa sous-commande.

Aujourd'hui, après le checkout, **le paiement et la livraison sont convenus dans le chat avec chaque vendeur**. Ce fonctionnement doit évoluer lorsque les paiements intégrés RDC/USA seront activés.

## Documentation

Commencer par :

1. [`START_HERE_USA.txt`](START_HERE_USA.txt) — prise en main rapide pour le responsable USA.
2. [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — ce qui fonctionne et ce qui reste à construire.
3. [`docs/01_ARCHITECTURE.md`](docs/01_ARCHITECTURE.md) — architecture technique.
4. [`docs/02_ROLES_AND_PERMISSIONS.md`](docs/02_ROLES_AND_PERMISSIONS.md) — utilisateurs et droits.
5. [`docs/03_SCREENS_AND_ROUTES.md`](docs/03_SCREENS_AND_ROUTES.md) — tous les onglets / fenêtres.
6. [`docs/04_CODE_MAP.md`](docs/04_CODE_MAP.md) — rôle de chaque fichier.
7. [`docs/05_SUPABASE.md`](docs/05_SUPABASE.md) — base, Auth, Realtime, RLS et RPC.
8. [`docs/06_SERVICES.md`](docs/06_SERVICES.md) — Supabase, Netlify, EmailJS, Cloudinary, paiements, etc.
9. [`docs/07_NETLIFY_DEPLOYMENT.md`](docs/07_NETLIFY_DEPLOYMENT.md) — mise en ligne.
10. [`docs/08_USA_MANAGER_GUIDE.md`](docs/08_USA_MANAGER_GUIDE.md) — règles du marché USA.
11. [`docs/09_SECURITY.md`](docs/09_SECURITY.md) — clés, RLS, accès et bonnes pratiques.
12. [`docs/10_ROADMAP.md`](docs/10_ROADMAP.md) — suite du développement.
13. [`docs/11_DATABASE_REFERENCE.md`](docs/11_DATABASE_REFERENCE.md) — tables utilisées par la V6.
14. [`docs/12_DEVELOPER_WORKFLOW.md`](docs/12_DEVELOPER_WORKFLOW.md) — workflow Git et développement.
15. [`docs/13_EMAILS_EMAILJS.md`](docs/13_EMAILS_EMAILJS.md) — emails transactionnels.
16. [`docs/14_PAYMENTS_RDC_USA.md`](docs/14_PAYMENTS_RDC_USA.md) — paiements par marché.
17. [`docs/15_REGIONAL_DATA_MODEL.md`](docs/15_REGIONAL_DATA_MODEL.md) — séparation RDC/USA.
18. [`docs/USA_MANAGER_GUIDE_EN.md`](docs/USA_MANAGER_GUIDE_EN.md) — English handoff summary.

## Propriété

One Market est un **produit NKS Services**. Le code, l'identité, les données et l'infrastructure doivent rester sous contrôle NKS. Les futurs responsables régionaux peuvent être limités à leur marché. Le responsable principal USA, lui, est un Super Admin One Market avec accès opérationnel global, son périmètre quotidien restant les États-Unis.

Voir [`LICENSE.md`](LICENSE.md).
