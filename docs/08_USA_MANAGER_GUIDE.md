# Guide du Super Admin — One Market USA

## Position

Le responsable principal USA est **Super Admin One Market**. Il dispose des mêmes pouvoirs opérationnels de gestion que le Super Admin / Owner, avec un focus quotidien sur les États-Unis.

## Priorités USA
- recruter et valider les vendeurs US ;
- maintenir un catalogue fiable ;
- surveiller les commandes et incidents ;
- organiser les partenaires de livraison ;
- suivre les paiements/règlements ;
- gérer le support et les litiges ;
- suivre conversion, GMV, commission, panier moyen, réachat et qualité vendeurs ;
- proposer les évolutions produit nécessaires au marché US.

## Accès
Le rôle cible est :

```text
role = super_admin
primary_market = US
```

`primary_market = US` décrit sa responsabilité principale ; ce champ ne doit pas réduire ses permissions globales de Super Admin.

## Gouvernance
Les deux Super Admins peuvent gérer One Market. Pour les changements critiques (paiements, RLS, authentification, suppression de données, structure des rôles, clés/infrastructure), utiliser une revue croisée.

NKS Services reste propriétaire du produit One Market, de la marque, du dépôt principal et des comptes racines.

## À développer en priorité
1. Dashboard Super Admin partagé.
2. Vue filtrable par marché, avec USA comme vue par défaut du responsable US.
3. Dashboard vendeur.
4. Dashboard livreur.
5. Paiements marketplace USA conformes.
6. Logs/audit des actions administratives.
