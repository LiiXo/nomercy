# 🔧 Instructions pour corriger l'erreur E11000 duplicate key

## Problème
L'erreur `E11000 duplicate key error collection: nomercy.gamemoderules index: mode_1` indique qu'il existe un ancien index unique sur le champ `mode` seul dans MongoDB, ce qui entre en conflit avec l'index composite `{ mode, location, subType }`.

## Solution 1 : Via MongoDB Compass (Recommandé)

1. Ouvrir MongoDB Compass
2. Se connecter à votre base de données
3. Aller dans la collection `gamemoderules`
4. Cliquer sur l'onglet "Indexes"
5. Trouver l'index nommé `mode_1` (qui n'a que le champ `mode`)
6. Cliquer sur le bouton "Drop Index" à côté de cet index
7. Confirmer la suppression

## Solution 2 : Via MongoDB Shell (mongosh)

```javascript
// Se connecter à MongoDB
use nomercy

// Lister les index existants
db.gamemoderules.getIndexes()

// Supprimer l'ancien index mode_1
db.gamemoderules.dropIndex("mode_1")

// Vérifier que l'index composite existe
db.gamemoderules.getIndexes()
```

Vous devriez voir :
- ✅ `mode_1_location_1_subType_1` (index composite unique) - DOIT EXISTER
- ❌ `mode_1` (index simple) - DOIT ÊTRE SUPPRIMÉ

## Solution 3 : Via le script Node.js

Exécuter le script de correction :

```bash
cd Server
node scripts/fix-gamemoderules-index.js
```

**Note :** Assurez-vous que le fichier `.env` contient la variable `MONGODB_URI` correcte.

## Vérification

Après avoir supprimé l'index, vous pouvez vérifier que tout fonctionne :

1. Aller dans Admin Panel > Règles des Modes de Jeu
2. Modifier une section existante
3. Sauvegarder
4. L'erreur E11000 ne devrait plus apparaître

## Index corrects

La collection `gamemoderules` devrait avoir ces index :

1. `_id_` (index par défaut)
2. `mode_1_location_1_subType_1` (unique) - **C'est le bon index**
3. `isActive_1` (non unique)
4. `location_1` (non unique)
5. `subType_1` (non unique)

**L'index `mode_1` seul ne devrait PAS exister.**







