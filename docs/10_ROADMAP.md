# 10 — Roadmap technique

## Phase A — Solidifier la base V6

- tests de build ;
- variables d'environnement ;
- documentation ;
- audits RLS ;
- gestion d'erreurs réseau ;
- traductions.

## Phase B — Rôles et gouvernance

- `super_admin` ;
- `country_admin` ;
- `seller` ;
- `delivery` ;
- `customer` ;
- scope `market_code`.

## Phase C — Espace Vendeur

- onboarding ;
- KYC ;
- boutique ;
- catalogue ;
- images ;
- stock ;
- commandes ;
- chat ;
- paiements/payouts.

## Phase D — Admin Pays

- dashboard RDC ;
- dashboard USA ;
- approbation vendeurs ;
- commandes ;
- livraisons ;
- support ;
- statistiques ;
- incidents.

## Phase E — Livreur

- affectation ;
- statut collecte ;
- en route ;
- livré ;
- preuve/OTP ;
- historique.

## Phase F — Paiements

USA : Stripe Connect ou architecture validée.
RDC : PSP/local/mobile money selon contrat et conformité.

Inclure :
- commissions ;
- payouts ;
- webhooks ;
- remboursements ;
- rapprochement ;
- logs.

## Phase G — Production

- monitoring ;
- analytics ;
- sauvegardes ;
- tests end-to-end ;
- sécurité ;
- processus incident ;
- conformité et documents légaux.
