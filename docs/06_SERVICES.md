# 06 — Registre des services One Market

Cette page distingue volontairement **actuel**, **préparé** et **prévu**.

## Supabase — ✅ intégré

Rôle : backend principal.

Utilisé pour :
- PostgreSQL ;
- Auth ;
- Realtime ;
- fonction RPC `checkout_cart`.

## Netlify — 🟦 préparé / hébergement recommandé

Rôle : héberger le build React/Vite.

Le dépôt contient `netlify.toml` :
- build `npm run build` ;
- publication `dist` ;
- fallback SPA vers `index.html` ;
- quelques headers de sécurité.

Les variables Supabase doivent être configurées dans les Environment Variables Netlify, jamais codées en dur.

## GitHub — ✅ gestion du code

Rôle :
- source de vérité du code ;
- historique ;
- branches ;
- Pull Requests ;
- partage contrôlé avec les responsables/développeurs.

Dépôt recommandé : **privé**.

## EmailJS — 🟨 prévu / à intégrer

Cette V6 n'appelle pas encore EmailJS directement.

Usages possibles :
- bienvenue/confirmation ;
- notification de nouvelle commande ;
- changement important de statut ;
- message support ;
- notifications vendeur.

Pour des opérations sensibles ou à fort volume, préférer un envoi serveur plutôt qu'un secret dans le navigateur.

## Cloudinary / service média — 🟨 prévu / partiellement représenté par des URLs

Le frontend affiche déjà des champs URL :
- `product_images.secure_url` ;
- `stores.logo_url` ;
- `stores.banner_url` ;
- `categories.image_url`.

La V6 ne contient pas de composant d'upload. Les futurs dashboards vendeur/admin doivent utiliser un service média sécurisé. Cloudinary est adapté si l'infrastructure NKS continue de l'utiliser.

## Stripe Connect — 🟨 roadmap USA

Rôle cible :
- paiement carte US ;
- onboarding/KYC des vendeurs ;
- split/payout selon l'architecture retenue ;
- commission One Market.

Ne pas l'intégrer uniquement côté frontend : les opérations sensibles doivent passer par un backend/Edge Function/Netlify Function sécurisé.

## Paiements RDC — 🟨 roadmap

Prévoir un PSP compatible RDC, selon disponibilité contractuelle :
- Mobile Money ;
- cartes ;
- autres méthodes locales.

La V6 actuelle laisse paiement + livraison à organiser dans le chat.

## Observabilité — 🟨 recommandé

À ajouter avant une mise à l'échelle :
- monitoring erreurs frontend (ex. Sentry ou équivalent) ;
- logs backend ;
- alertes d'échec checkout ;
- suivi des événements de paiement ;
- audit admin/vendeur.

## Analytics — 🟨 recommandé

À définir : Netlify Analytics, GA4, Matomo ou autre solution conforme à la politique de confidentialité choisie.


## Asset branding actuellement utilisé

Le logo public utilisé par la V6 est chargé depuis Cloudinary :

`https://res.cloudinary.com/nks-services/image/upload/v1788106209/one-market-logo.webp`

Cela évite de dupliquer les médias dans le dépôt. Pour une future migration, conserver un asset public stable ou réintroduire des fichiers locaux dans `public/`.
