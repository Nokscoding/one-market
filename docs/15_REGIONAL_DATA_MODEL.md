# 15 — Modèle régional RDC / USA

## Objectif

Une seule plateforme One Market, mais des opérations régionales séparées.

```text
ONE MARKET GLOBAL
│
├── CD — One Market RDC
│   ├── Admin RDC
│   ├── vendeurs CD
│   ├── livreurs CD
│   └── opérations CD
│
└── US — One Market USA
    ├── Admin USA
    ├── vendeurs US
    ├── livreurs US
    └── opérations US
```

## Ce qui existe déjà

- `profiles.country_code`
- `stores.country_code`
- filtres catalogue `CD` / `US`

## Ce qu'il faut ajouter

Créer un modèle explicite de membership/rôle, par exemple :

```text
user_roles
- user_id
- role
- market_code nullable
- store_id nullable
- is_active
- created_at
```

Exemples :

```text
Super Admin:  role=super_admin, market_code=NULL
Super Admin USA: role=super_admin, primary_market=US
Admin USA secondaire (optionnel): role=country_admin, market_code=US
Vendeur A:    role=seller, market_code=US, store_id=<A>
Livreur B:    role=delivery, market_code=US
Client:       role=customer
```

## RLS des Country Admins

Une policy ne doit pas dire seulement "role = country_admin". Elle doit aussi vérifier le marché :

```text
role = country_admin AND market_code = resource.market_code
```

ou dériver le marché via la boutique/sous-commande.

## Commandes transfrontalières

Une commande peut contenir des boutiques de pays différents. Il faut distinguer :

- pays du client ;
- pays de la boutique ;
- marché qui opère la sous-commande ;
- `is_cross_border` ;
- devise ;
- méthode de paiement ;
- mode de livraison.

L'administration doit se faire au niveau de `seller_order`, pas seulement de `orders`, car une commande globale peut contenir une sous-commande CD et une sous-commande US.
