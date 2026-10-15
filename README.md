# monentrepriselocale.fr — dépôt archivé

> **Ce dépôt n'est plus utilisé.** Depuis le 15 octobre 2026, toutes les modifications du site
> se font dans le dépôt **[monentrepriselocale-v2](https://github.com/jaozaka-source/monentrepriselocale-v2)**.

Ce dépôt conserve l'export d'origine du site depuis Hostinger Horizons (application web + PocketBase),
tel qu'il a été importé le 15 octobre 2026. Il sert uniquement d'archive : n'y faites plus de modifications.

## Où se trouve le site maintenant

| | |
|---|---|
| Code source | [jaozaka-source/monentrepriselocale-v2](https://github.com/jaozaka-source/monentrepriselocale-v2) |
| Branche en ligne | `main` (redéployée automatiquement par Hostinger à chaque modification) |
| Branche de travail | `develop` |
| Hébergement | Hostinger — application Node.js |
| Base de données | MySQL Hostinger (remplace PocketBase) |

## Ce qui a changé par rapport à ce dépôt

- Le site est hébergé comme application Node.js sur Hostinger, et non plus sur la plateforme Horizons.
- PocketBase est remplacé par une base MySQL Hostinger. Le site intègre une API compatible
  PocketBase, si bien que les pages et l'espace client fonctionnent comme avant.
- Les automatismes (e-mails, tickets, paiements Stripe, signature des contrats) tournent
  désormais dans l'application et envoient les e-mails par la boîte mail Hostinger.
