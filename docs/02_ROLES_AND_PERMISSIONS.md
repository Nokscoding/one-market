# Rôles et permissions One Market

## 1. Super Admin / Owner NKS

Rôle racine de propriété du produit.

Pouvoirs opérationnels :
- accès global RDC + USA + futurs marchés ;
- vendeurs, livreurs, clients, produits, commandes, paiements, litiges et paramètres ;
- statistiques globales ;
- création/désactivation des rôles opérationnels ;
- intervention sur tous les marchés.

Pouvoirs réservés à la propriété NKS :
- propriété de la marque et du produit ;
- propriété/transfert du dépôt principal ;
- contrôle des comptes racines NKS, facturation maître et secrets propriétaires ;
- décision finale sur transfert de propriété ou cession du produit.

## 2. Super Admin One Market — responsable principal USA

Le responsable USA dispose des **mêmes pouvoirs opérationnels de gestion dans One Market** que le Super Admin / Owner.

Sa responsabilité principale :
- One Market USA ;
- vendeurs US ;
- opérations, catalogue, support et qualité US ;
- livraison et partenaires locaux US ;
- suivi des paiements et performances US ;
- croissance du marché américain.

Il peut intervenir sur les autres marchés si nécessaire. La différence avec l'Owner NKS concerne la **propriété juridique/technique ultime du produit**, pas la gestion quotidienne de One Market.

## 3. Country Admin / Admin Pays (rôle futur optionnel)

Des admins régionaux plus limités pourront être ajoutés sous les Super Admins.

Exemples :
- Admin RDC ;
- Admin USA secondaire ;
- Admin d'un futur pays.

Un `country_admin` est limité par `market_code` / `country_code` côté base de données et RLS.

## 4. Seller / Vendeur
- gérer sa boutique ;
- gérer ses produits, prix, stock et promotions ;
- consulter ses commandes ;
- préparer/confirmer les commandes ;
- consulter ses revenus et règlements ;
- répondre aux clients.

Il ne voit pas les données privées des autres vendeurs.

## 5. Delivery / Livreur
- voir uniquement les livraisons autorisées/attribuées ;
- mettre à jour les statuts ;
- confirmer récupération et livraison ;
- consulter historique et gains selon le modèle final.

## 6. Customer / Client
- consulter le catalogue ;
- panier ;
- checkout ;
- commandes ;
- adresses ;
- suivi ;
- chat ;
- avis lorsque la fonctionnalité est activée.

## 7. Principe de sécurité
Les permissions doivent être appliquées dans Supabase RLS et dans les fonctions serveur/RPC, pas seulement dans l'interface React.

`super_admin` peut opérer globalement. `country_admin`, `seller`, `delivery` et `customer` doivent être limités aux ressources correspondant à leur périmètre.
