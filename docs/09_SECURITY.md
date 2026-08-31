# 09 — Sécurité

## 1. Secrets

Ne jamais committer :
- Supabase service_role ;
- mot de passe base ;
- Stripe secret key ;
- webhook secrets ;
- EmailJS private key ;
- tokens GitHub/Netlify ;
- clés Cloudinary privées.

`.gitignore` exclut les fichiers `.env*` locaux.

## 2. Supabase

La Publishable Key n'est pas un mécanisme d'autorisation. La sécurité repose sur :
- Auth ;
- RLS ;
- contraintes SQL ;
- fonctions sécurisées ;
- validation serveur.

## 3. Rôles

Ne jamais faire confiance à une valeur de rôle modifiable par le client sans contrôle SQL.

## 4. Admin régional

Toute requête d'un futur `country_admin` doit être filtrée/validée par son marché côté RLS. Le Super Admin responsable USA n'est pas limité à US, même si son interface peut ouvrir par défaut sur le marché américain.

## 5. Paiements

Ne pas confirmer un paiement uniquement à partir d'une réponse frontend. Utiliser webhooks vérifiés côté serveur.

## 6. Logs

Créer des logs d'audit pour :
- modification produit/prix ;
- changement statut commande ;
- remboursement ;
- suspension vendeur ;
- changement de rôle ;
- actions admins.

## 7. Accès GitHub

Préférer un dépôt privé. Donner le minimum de permissions nécessaire au responsable USA.
