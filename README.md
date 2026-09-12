# One Market V10 — Client RDC

Marketplace multi-vendeurs de NKS Services. Cette version recentre la V1 sur la **RDC** avec **paiement à la livraison**.

## Lancer en local

```powershell
cd C:\\Users\\willy\\Downloads\\one-market
git pull
npm.cmd install
npm.cmd run dev
```

Ouvrir ensuite `http://localhost:5173`.

## Configuration

Créer `.env.local` à la racine :

```env
VITE_SUPABASE_URL=https://mvbcazbyftjenjuydxft.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=VOTRE_CLE_PUBLISHABLE
```

Ne jamais mettre de `service_role` dans le frontend ou dans GitHub.

## V10 côté client

- accueil marketplace inspiré des patterns Amazon, identité One Market ;
- recherche centrale, catégories, boutiques et rails produits ;
- catalogue avec filtres prix/catégorie/boutique et tri ;
- fiche produit avec galerie, variantes et bloc d'achat ;
- panier persistant Supabase multi-boutiques ;
- adresses RDC ;
- checkout paiement à la livraison ;
- création transactionnelle de commande via `checkout_cart` ;
- commandes globales + sous-commandes vendeurs ;
- suivi de commande ;
- profil, adresses, notifications et sécurité ;
- interface responsive desktop/mobile ;
- écran de diagnostic si `.env.local` manque au lieu d'une page blanche.

## Backend Supabase

Le projet `onemarket` contient déjà les migrations suivantes :

- `foundation_profiles_roles_rls`
- `catalog_demo_categories_stores_products`
- `client_cart_checkout_orders`
- `harden_checkout_variant_stock`
- `validate_cart_items`
- index de performance complémentaires

Toutes les tables exposées utilisées par la V10 ont RLS activé.

## Périmètre

V1 : RDC uniquement, paiement à la livraison. Les paiements automatiques, retours complets, Mobile Money/cartes et expansion USA restent après la V1.
