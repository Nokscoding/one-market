# 01 — Architecture technique

## Vue d'ensemble

```text
Navigateur
   │
   ▼
React + React Router
   │
   ├── AuthContext ───────────────► Supabase Auth
   │
   ├── Pages publiques ──────────► Supabase PostgreSQL
   │
   ├── CartContext ──────────────► carts / cart_items
   │
   ├── CheckoutPage ─────────────► RPC checkout_cart()
   │
   ├── OrderPage ────────────────► orders / seller_orders / order_items
   │
   └── ChatPage ─────────────────► conversations / messages + Realtime

Build Vite ──► dist/ ──► Netlify
Source ──────► GitHub
```

## Frontend

`src/main.jsx` initialise l'application dans cet ordre :

1. `BrowserRouter` — navigation client.
2. `AuthProvider` — session et profil.
3. `CartProvider` — panier du client connecté.
4. `App` — routes, header, footer et intro.

## Principe multi-pays

La V6 reconnaît deux codes pays :

- `CD` = République démocratique du Congo ;
- `US` = États-Unis.

Le filtre pays se base actuellement sur `stores.country_code`. Le profil client contient aussi `profiles.country_code`.

Pour une vraie gouvernance régionale, ajouter un modèle de rôles avec scope régional, par exemple :

```text
role = super_admin | country_admin | seller | delivery | customer

Deux comptes peuvent avoir `role = super_admin` : Owner NKS et responsable principal USA (`primary_market = US`).
market_code = CD | US | ...
```

Le rôle ne doit jamais être contrôlé uniquement par le frontend : Supabase RLS doit vérifier l'accès côté base.

## Principe multi-vendeurs

Le panier peut contenir plusieurs boutiques. Le frontend regroupe visuellement les lignes par boutique. Au checkout, la fonction `checkout_cart` doit créer :

- une commande globale `orders` ;
- plusieurs sous-commandes `seller_orders`, une par boutique ;
- les lignes `order_items` correspondantes ;
- idéalement une `conversation` par sous-commande.

Cette séparation est essentielle pour empêcher un vendeur de gérer les articles d'un autre vendeur.
