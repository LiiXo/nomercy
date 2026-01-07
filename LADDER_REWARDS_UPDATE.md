# 🎮 Mise à jour des Récompenses Ladder - Chill vs Compétitif

## 📋 Vue d'ensemble

Le système de récompenses pour les ladders a été mis à jour pour permettre des configurations **distinctes** entre les deux types de ladders :

- **🎮 Ladder Chill (duo-trio)** : Récompenses plus modérées pour un environnement détendu
- **🔥 Ladder Compétitif (squad-team)** : Récompenses plus importantes pour un environnement compétitif

## 🔧 Changements techniques

### 1. Modèle de données (`Server/src/models/Config.js`)

**Avant :**
```javascript
squadMatchRewards: {
  ladderPointsWin: 20,
  ladderPointsLoss: 10,
  // ... autres champs
}
```

**Après :**
```javascript
squadMatchRewardsChill: {
  ladderPointsWin: 15,
  ladderPointsLoss: 8,
  generalSquadPointsWin: 10,
  generalSquadPointsLoss: 5,
  playerPointsWin: 15,
  playerPointsLoss: 8,
  playerCoinsWin: 40,
  playerCoinsLoss: 20,
  playerXPWinMin: 350,
  playerXPWinMax: 450
},

squadMatchRewardsCompetitive: {
  ladderPointsWin: 25,
  ladderPointsLoss: 12,
  generalSquadPointsWin: 20,
  generalSquadPointsLoss: 10,
  playerPointsWin: 25,
  playerPointsLoss: 12,
  playerCoinsWin: 60,
  playerCoinsLoss: 30,
  playerXPWinMin: 550,
  playerXPWinMax: 650
}
```

### 2. Helper de configuration (`Server/src/utils/configHelper.js`)

La fonction `getSquadMatchRewards()` accepte maintenant un paramètre `ladderId` :

```javascript
// Avant
const rewards = await getSquadMatchRewards();

// Après
const rewards = await getSquadMatchRewards(match.ladderId);
// Retourne automatiquement les récompenses Chill ou Compétitif selon le ladderId
```

### 3. Routes de match (`Server/src/routes/match.routes.js`)

Tous les appels à `getSquadMatchRewards()` ont été mis à jour pour passer le `ladderId` du match :

- Route de déclaration de résultat (`/:matchId/result`)
- Route de confirmation de résultat (`/:matchId/confirm`)
- Route de résolution de litige (`/:matchId/resolve`)

### 4. Interface Admin (`Client/src/pages/AdminPanel.jsx`)

L'interface admin a été divisée en **deux sections distinctes** :

1. **🎮 Récompenses Ladder Chill (Duo-Trio)** - Bordure bleue
2. **🔥 Récompenses Ladder Compétitif (Squad-Team)** - Bordure orange

Chaque section permet de configurer :
- 📊 Points Escouade (Ladder Spécifique)
- 🏆 Points Top Escouade Général
- 💰 Gold (Coins)
- ⚡ XP Joueur

## 🚀 Migration

### Script de migration automatique

Un script de migration a été créé pour convertir automatiquement l'ancienne configuration vers le nouveau format :

```bash
cd Server
node scripts/migrate-ladder-rewards.js
```

Le script :
1. ✅ Détecte l'ancienne configuration `squadMatchRewards`
2. 🔄 Crée `squadMatchRewardsChill` avec des valeurs ~25% plus faibles
3. 🔥 Crée `squadMatchRewardsCompetitive` avec des valeurs ~25% plus élevées
4. 🗑️ Supprime l'ancienne configuration
5. 💾 Sauvegarde les changements

### Migration manuelle (si nécessaire)

Si vous préférez configurer manuellement les valeurs :

1. Accédez au panel admin : `/admin`
2. Faites défiler jusqu'aux sections "Récompenses Ladder"
3. Configurez séparément les récompenses pour **Chill** et **Compétitif**
4. Cliquez sur "💾 Enregistrer la Configuration"

## 📊 Valeurs par défaut

### Ladder Chill (duo-trio)
- Points Ladder Victoire : **15** (Défaite : **8**)
- Points Général Victoire : **10** (Défaite : **5**)
- Gold Victoire : **40** (Défaite : **20**)
- XP Victoire : **350-450** (Défaite : **0**)

### Ladder Compétitif (squad-team)
- Points Ladder Victoire : **25** (Défaite : **12**)
- Points Général Victoire : **20** (Défaite : **10**)
- Gold Victoire : **60** (Défaite : **30**)
- XP Victoire : **550-650** (Défaite : **0**)

## 🎯 Résultat

Maintenant, lorsqu'un match se termine :

1. Le système vérifie le `ladderId` du match
2. Si `ladderId === 'duo-trio'` → Utilise les récompenses **Chill**
3. Si `ladderId === 'squad-team'` → Utilise les récompenses **Compétitif**
4. Les points, gold et XP sont attribués selon la configuration appropriée

## ⚠️ Notes importantes

- Les anciennes configurations ne seront **pas** automatiquement migrées au démarrage du serveur
- Il est recommandé d'exécuter le script de migration **avant** de mettre en production
- Vous pouvez modifier les valeurs à tout moment depuis le panel admin
- Les changements prennent effet **immédiatement** pour les nouveaux matchs
- Les matchs en cours ne sont **pas** affectés

## 📝 Compatibilité

- ✅ Compatible avec toutes les fonctionnalités existantes
- ✅ Les classements et statistiques continuent de fonctionner normalement
- ✅ Aucun changement nécessaire côté frontend (sauf panel admin)
- ✅ Les logs incluent maintenant le type de ladder pour le débogage

## 🐛 Dépannage

### Problème : Les récompenses ne changent pas

**Solution :** Vérifiez que :
1. Le script de migration a été exécuté
2. Les valeurs sont bien configurées dans le panel admin
3. Le cache de configuration a été vidé (redémarrage du serveur)

### Problème : Erreur "squadMatchRewardsChill is undefined"

**Solution :** Exécutez le script de migration :
```bash
cd Server
node scripts/migrate-ladder-rewards.js
```

## 📞 Support

En cas de problème, vérifiez les logs du serveur. Les messages incluent maintenant le type de ladder :
```
[MATCH RESULT] Match 123 (duo-trio) - Winner: Squad1, Loser: Squad2
[MATCH RESULT] Config - Ladder Points Win: 15, Loss: 8, General Win: 10, Loss: 5
```


