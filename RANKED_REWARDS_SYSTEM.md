# 🏆 Système de Récompenses Mode Classé

## 📋 Vue d'ensemble

Le système de récompenses du mode classé permet de distribuer automatiquement des gains aux joueurs à la fin de chaque match. Toutes les récompenses sont **entièrement configurables** via le panel admin.

---

## 🎮 Types de Récompenses

### Pour les **GAGNANTS** 🏆

1. **📊 Points Ladder Classé** (`pointsWin`)
   - Utilisés pour le classement spécifique du mode classé
   - Détermine le rang du joueur : Bronze, Silver, Gold, Platinum, Diamond, Master, Grandmaster, Champion
   - Visible dans le classement du mode classé

2. **💰 Gold** (`coinsWin`)
   - Monnaie du jeu
   - Utilisable dans la boutique ou pour d'autres fonctionnalités

3. **⚡ XP Top Player** (`xpWinMin` à `xpWinMax`)
   - Expérience pour le classement général des joueurs
   - Affiché sur la page d'accueil dans le "Top Players"
   - Valeur aléatoire entre min et max pour chaque victoire

### Pour les **PERDANTS** 💔

1. **📊 Points Ladder Classé** (`pointsLoss`)
   - Généralement négatif (exemple : -10, -12, -18, -20)
   - Le joueur ne peut jamais descendre en dessous de 0 points
   - Affecte le rang dans le ladder classé

2. **🎁 Gold de Consolation** (`coinsLoss`)
   - Récompense pour encourager les joueurs même en cas de défaite
   - Toujours positif (exemple : 15, 20, 25, 30)

3. **⚡ XP Top Player**
   - Les perdants ne reçoivent **PAS** d'XP (toujours 0)

---

## ⚙️ Configuration via Panel Admin

### Accès
1. Se connecter en tant qu'admin
2. Aller sur `/admin`
3. Onglet **"Configuration"**
4. Section **"⚔️ Récompenses Mode Classé (Ranked)"**

### Structure

Le système distingue **2 modes** et **4 types de jeu** :

#### Modes
- 🔥 **Hardcore**
- 🎯 **CDL**

#### Types de jeu (par mode)
- Duel
- Team Deathmatch
- Domination
- Search & Destroy

### Champs configurables (pour chaque combinaison mode/type)

| Champ | Type | Description | Exemple Hardcore | Exemple CDL |
|-------|------|-------------|------------------|-------------|
| **Points Victoire** | Nombre | Points gagnés en victoire | +35 | +40 |
| **Points Défaite** | Nombre | Points perdus en défaite | -18 | -20 |
| **Gold Victoire** | Nombre | Gold gagné en victoire | 80 | 90 |
| **Gold Consolation** | Nombre | Gold gagné en défaite | 25 | 30 |
| **XP Min** | Nombre | XP minimum (victoire) | 700 | 700 |
| **XP Max** | Nombre | XP maximum (victoire) | 800 | 800 |

---

## 🔄 Flux de Distribution des Récompenses

### 1. Fin du Match
- Les deux référents déclarent le résultat
- Si accord : le match passe en statut `completed`
- Si désaccord : le match passe en `disputed` (litige)

### 2. Résolution (Admin ou Accord)
Quand le gagnant est décidé (accord ou résolution admin) :
1. La fonction `distributeRankedRewards()` est appelée automatiquement
2. Pour chaque joueur du match :
   - Déterminer s'il est gagnant ou perdant
   - Récupérer la configuration des récompenses selon le mode et type de jeu
   - Calculer les récompenses appropriées

### 3. Mise à jour des données

#### Pour le **Ranking** (Classement Ladder Classé)
```javascript
// Modèle : Ranking
- points : Mis à jour selon pointsWin/pointsLoss (min: 0)
- wins/losses : Incrémenté
- currentStreak : Série de victoires
- bestStreak : Meilleure série
```

#### Pour le **User** (Joueur)
```javascript
// Modèle : User.stats
- gold : Ajout de coinsWin ou coinsLoss
- xp : Ajout d'XP si gagnant (0 si perdant)
- wins/losses : Stats globales
```

#### Dans le **Match**
```javascript
// Enregistrement dans match.players[i].rewards
{
  pointsChange: +35 ou -18,
  goldEarned: 80 ou 25,
  xpEarned: 750 ou 0
}
```

---

## 📊 Système de Rangs

Le rang est calculé selon les points accumulés dans le ladder classé :

| Rang | Points Min | Points Max | Couleur | Icône |
|------|-----------|-----------|---------|-------|
| Bronze | 0 | 499 | Bronze | 🛡️ |
| Silver | 500 | 999 | Argent | 🛡️ |
| Gold | 1000 | 1499 | Or | 🏅 |
| Platinum | 1500 | 1999 | Cyan | 🏅 |
| Diamond | 2000 | 2499 | Bleu | ⭐ |
| Master | 2500 | 2999 | Violet | 👑 |
| Grandmaster | 3000 | 3499 | Rouge | 🔥 |
| Champion | 3500+ | ∞ | Or/Rouge | ⚡ |

---

## 🎯 Cas d'Usage

### Exemple 1 : Match Search & Destroy en Hardcore

**Configuration** :
- pointsWin: +35
- pointsLoss: -18
- coinsWin: 80
- coinsLoss: 25
- xpWinMin: 700
- xpWinMax: 800

**Joueur A (Gagnant)** :
- Points Ladder : 1250 → 1285 (+35)
- Gold : 450 → 530 (+80)
- XP : 5600 → 6375 (+775, aléatoire entre 700-800)
- Rang : Gold → Gold

**Joueur B (Perdant)** :
- Points Ladder : 1520 → 1502 (-18)
- Gold : 320 → 345 (+25, consolation)
- XP : 4200 → 4200 (+0)
- Rang : Platinum → Platinum

### Exemple 2 : Protection contre les points négatifs

**Joueur C (Perdant avec peu de points)** :
- Points Ladder : 8 → 0 (-18 appliqué, mais minimum = 0)
- Gold : 100 → 125 (+25)
- XP : 2000 → 2000 (+0)
- Rang : Bronze → Bronze

---

## 🔧 Fonctions Techniques

### Server : `distributeRankedRewards(match)`
**Fichier** : `Server/src/routes/rankedMatch.routes.js`

```javascript
async function distributeRankedRewards(match) {
  // 1. Récupère la config des récompenses
  const rewards = await getRankedMatchRewards(match.gameMode, match.mode);
  
  // 2. Pour chaque joueur
  for (const player of match.players) {
    const isWinner = player.team === match.result.winner;
    
    // 3. Calcule les récompenses
    const rankedPointsChange = isWinner ? pointsWin : pointsLoss;
    const goldChange = isWinner ? coinsWin : coinsLoss;
    const xpChange = isWinner ? random(xpWinMin, xpWinMax) : 0;
    
    // 4. Met à jour Ranking (ladder classé)
    ranking.points = Math.max(0, ranking.points + rankedPointsChange);
    ranking.wins/losses += 1;
    
    // 5. Met à jour User (stats globales)
    user.stats.gold += goldChange;
    user.stats.xp += xpChange;
  }
}
```

### Server : `getRankedMatchRewards(gameMode, mode)`
**Fichier** : `Server/src/utils/configHelper.js`

```javascript
export const getRankedMatchRewards = async (gameMode, mode) => {
  const config = await getRewardsConfig();
  return config.rankedMatchRewards[mode][gameMode];
};
```

---

## 🚀 Appels API

### Déclarer un résultat (Référent)
```http
POST /api/ranked-matches/:matchId/result
{
  "winner": 1 // ou 2
}
```

### Forcer un résultat (Admin)
```http
POST /api/ranked-matches/admin/:matchId/force-result
{
  "winner": 1,
  "reason": "Preuve fournie par l'équipe 1"
}
```

### Résoudre un litige (Admin)
```http
POST /api/ranked-matches/admin/:matchId/resolve-dispute
{
  "winner": 2,
  "resolution": "Après analyse des preuves, victoire équipe 2"
}
```

---

## 📝 Logs

Le système génère des logs détaillés à chaque distribution :

```
[RANKED REWARDS] ====================================
[RANKED REWARDS] Match 673abc123... - Winner: Team 1
[RANKED REWARDS] Mode: hardcore | GameMode: Search & Destroy
[RANKED REWARDS] Config - Gagnants: 35pts ladder, 80 gold, 700-800 XP
[RANKED REWARDS] Config - Perdants: -18pts ladder, 25 gold (consolation), 0 XP
[RANKED REWARDS] ====================================
[RANKED REWARDS] Joueur: Player123 (🏆 GAGNANT)
[RANKED REWARDS]   └─ Ladder Classé: 1250 → 1285 (+35)
[RANKED REWARDS]   └─ Gold: 450 → 530 (+80)
[RANKED REWARDS]   └─ XP Top Player: 5600 → 6375 (+775)
[RANKED REWARDS]   └─ Record: 45V - 23D (Série: 3)
[RANKED REWARDS] ✅ Récompenses distribuées avec succès
```

---

## 🎨 Interface Admin

L'interface a été améliorée avec :
- ✅ Design moderne avec gradients et bordures colorées
- ✅ Organisation claire par mode (Hardcore/CDL) et type de jeu
- ✅ Tous les champs configurables visibles
- ✅ Descriptions et explications intégrées
- ✅ Icônes visuelles pour une meilleure UX
- ✅ Section d'information avec légende complète

### Capture d'écran conceptuelle :
```
┌─────────────────────────────────────────────────────────┐
│ ⚔️ Récompenses Mode Classé (Ranked)                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 🔥 Hardcore                                             │
│ ┌──────────────────┬──────────────────┐                │
│ │ 🎮 Duel          │ 🎮 Team Death... │                │
│ │                  │                   │                │
│ │ 📊 Points Ladder │ 📊 Points Ladder │                │
│ │ ✅ Victoire: 20  │ ✅ Victoire: 25  │                │
│ │ ❌ Défaite: -10  │ ❌ Défaite: -12  │                │
│ │                  │                   │                │
│ │ 💰 Gold          │ 💰 Gold          │                │
│ │ ✅ Victoire: 50  │ ✅ Victoire: 60  │                │
│ │ 🎁 Consol.: 15   │ 🎁 Consol.: 20   │                │
│ │                  │                   │                │
│ │ ⚡ XP Top Player │ ⚡ XP Top Player │                │
│ │ Min: 700         │ Min: 700         │                │
│ │ Max: 800         │ Max: 800         │                │
│ └──────────────────┴──────────────────┘                │
└─────────────────────────────────────────────────────────┘
```

---

## 🛠️ Fichiers Modifiés

### Backend
1. **`Server/src/models/Config.js`**
   - Ajout de `coinsLoss` aux récompenses par défaut
   - Structure complète des récompenses ranked

2. **`Server/src/routes/rankedMatch.routes.js`**
   - Amélioration de `distributeRankedRewards()` avec logs détaillés
   - Support complet de coinsLoss et XP
   - Commentaires explicatifs

3. **`Server/src/utils/configHelper.js`**
   - Déjà supportait `coinsLoss` dans les defaults
   - Gestion du fallback des récompenses

### Frontend
4. **`Client/src/pages/AdminPanel.jsx`**
   - Interface complète pour configurer toutes les récompenses
   - Design moderne et intuitif
   - Section d'information explicative

---

## ✅ Checklist de Vérification

- [x] Points ladder classé gagnants configurables
- [x] Points ladder classé perdants configurables
- [x] Gold gagnants configurable
- [x] Gold consolation perdants configurable
- [x] XP Top Player (min/max) configurable
- [x] Protection contre points négatifs (min: 0)
- [x] Mise à jour du Ranking (ladder classé)
- [x] Mise à jour du User (stats + XP top player)
- [x] Enregistrement des récompenses dans le match
- [x] Logs détaillés pour debugging
- [x] Interface admin complète et intuitive
- [x] Support des 2 modes (hardcore/cdl)
- [x] Support des 4 types de jeu
- [x] Documentation complète

---

## 🎯 Prochaines Étapes (Optionnel)

1. **Badges de rang** : Afficher visuellement le rang sur les profils
2. **Historique des récompenses** : Page dédiée pour voir l'évolution
3. **Notifications** : Alertes quand on change de rang
4. **Saisons** : Reset périodique avec récompenses de fin de saison
5. **Bonus de série** : Récompenses supplémentaires pour les streaks

---

## 📞 Support

En cas de problème ou question :
1. Vérifier les logs serveur avec `[RANKED REWARDS]`
2. Vérifier la configuration dans le panel admin
3. S'assurer que les valeurs par défaut sont correctes dans `Config.js`

---

**Créé le** : 12 janvier 2026
**Version** : 1.0
**Statut** : ✅ Implémenté et fonctionnel
