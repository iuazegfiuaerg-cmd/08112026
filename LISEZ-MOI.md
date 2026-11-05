# Le TCG gratuit pour Internet

Cette version utilise **Netlify Free + Supabase Free**. Elle conserve l’interface, les boosters, les messages, les cartes et les échanges, avec une base et des photos privées partagées entre vos appareils. L’ancienne version Node/SQLite reste dans son dossier et fonctionne toujours en local.

## Avant de commencer

Suis le fichier **TUTORIEL-HEBERGEMENT-GRATUIT.md**, fourni à côté de l’archive. Il explique les deux sites, les comptes gratuits, les réglages, les tests et les mises à jour.

Cette version ne se déploie pas par simple dépôt de public/ : Netlify doit aussi construire la fonction serveur, depuis un dépôt GitHub privé contenant ce dossier complet. Le fichier netlify.toml configure tout ; aucune commande à taper n’est nécessaire dans le tutoriel.

## Contenu

- `public/` : interface du jeu. Les photos ne sont pas dans ce dossier.
- `netlify/functions/tcg.mjs` : serveur qui vérifie les connexions et parle à Supabase.
- `supabase/installation.sql` : à copier dans SQL Editor de Supabase.
- `photos-a-importer/` : 12 JPEG optimisés à téléverser dans le bucket **privé** `tcg-photos`, sans changer leur nom et sans sous-dossier.
- `netlify.toml` : configuration de déploiement.

Les photos restent reconnaissables et sans filtre artistique ; elles ont été redimensionnées, réorientées si nécessaire et compressées en JPEG pour réduire les quotas et fonctionner avec les fonctions Netlify. Les originaux sont conservés dans l’autre version. Les nouveaux ajouts sont limités à 2 Mo après préparation par l’interface.

## Réglages à saisir dans Netlify

| Nom | Valeur |
|---|---|
| `SUPABASE_URL` | URL HTTPS du projet Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé **legacy service_role** du même projet, uniquement côté serveur |
| `INIT_ANAS_PASSWORD` | Ton mot de passe TCG choisi, de 10 à 128 caractères |
| `INIT_MYRIAM_PASSWORD` | Son mot de passe TCG choisi, de 10 à 128 caractères |

La clé Supabase ne doit jamais être collée dans public/, dans un message, dans GitHub ou dans le champ mot de passe du livre. Les deux comptes sont créés au premier appel à la fonction ; des comptes existants ne sont pas remplacés. Après avoir vérifié vos deux connexions, les deux variables INIT peuvent être supprimées. Aucun formulaire public ne permet de créer un troisième compte.

Le mot de passe du livre reste séparé : **08112025**.

## Limites des offres gratuites

Il faut rester sur les plans Free. Netlify applique des quotas et peut suspendre les sites lorsque les crédits sont consommés. Supabase Free peut être mis en pause après une semaine d’inactivité ; la reprise se fait depuis son tableau de bord. La gratuité ne signifie pas disponibilité illimitée. Aucun abonnement ni déploiement payant n’a été effectué pour préparer ces fichiers.

## État de vérification

La fonction et le SQL ont été exécutés ensemble avec un PostgreSQL local et des réponses HTTP Supabase simulées : connexions, cookie sécurisé, autorisations, 12 cartes, tirages, limites quotidiennes, bonus, échanges, ajout et lecture de photos. La configuration réelle Netlify/Supabase devra être validée après création de tes projets avec la liste de contrôle du tutoriel. Aucun projet cloud Supabase ni compte hébergeur n’a été créé en ton nom.
