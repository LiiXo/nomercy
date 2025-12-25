# 🚀 Démarrage Rapide - Règles des Modes de Jeu

## Étapes pour tester immédiatement

### 1. Initialiser les données d'exemple

```bash
# Dans le terminal, aller dans le dossier Server
cd Server

# Exécuter le script de seed
node src/scripts/seedGameModeRules.js
```

**Résultat attendu:**
```
🌱 Seeding Game Mode Rules...
✅ Connected to MongoDB
🗑️  Cleared existing game mode rules
✅ Successfully seeded game mode rules:
  - Hardcore Mode Rules
  - CDL Mode Rules
👋 Disconnected from MongoDB
```

### 2. Démarrer le serveur (si ce n'est pas déjà fait)

```bash
# Dans le dossier Server
npm start
```

### 3. Démarrer le client (si ce n'est pas déjà fait)

```bash
# Dans un nouveau terminal, aller dans le dossier Client
cd Client
npm run dev
```

### 4. Accéder au panneau admin

1. Ouvrir votre navigateur
2. Aller sur: `http://localhost:5173` (ou votre URL de dev)
3. Se connecter avec un compte admin
4. Aller sur `/admin`
5. Cliquer sur l'onglet **"Règles modes"** (icône livre)

### 5. Tester l'éditeur

#### Créer une nouvelle section

1. **Sélectionner un mode**: Hardcore ou CDL
2. **Remplir le titre**:
   - Français: "Test de Section"
   - English: "Test Section"
3. **Utiliser la barre d'outils**:
   - Cliquer sur **B** puis taper du texte pour le mettre en gras
   - Cliquer sur l'icône de centrage puis taper un titre
   - Cliquer sur l'icône liste pour créer une liste
4. **Voir l'aperçu** en bas de l'éditeur
5. **Cliquer sur "Ajouter la section"**

#### Modifier une section existante

1. Cliquer sur l'icône **crayon** (Edit) d'une section
2. Modifier le contenu
3. Cliquer sur **"Mettre à jour la section"**

#### Supprimer une section

1. Cliquer sur l'icône **poubelle** (Trash)
2. Confirmer la suppression

### 6. Voir le résultat côté utilisateur

Ouvrir dans votre navigateur:
- **Hardcore**: `http://localhost:5173/game-mode-rules/hardcore`
- **CDL**: `http://localhost:5173/game-mode-rules/cdl`

## 🎨 Exemples de Formatage

### Exemple 1: Titre centré avec emoji

1. Cliquer sur l'icône **H2** (Heading 2)
2. Cliquer sur l'icône **centrage**
3. Taper: `⚔️ Règles de Combat ⚔️`

**Résultat HTML:**
```html
<h2 style="text-align: center;">⚔️ Règles de Combat ⚔️</h2>
```

### Exemple 2: Liste avec texte en gras

1. Cliquer sur l'icône **liste à puces**
2. Taper un élément
3. Sélectionner un mot et cliquer sur **B** pour le mettre en gras
4. Appuyer sur **Entrée** pour ajouter un autre élément

**Résultat HTML:**
```html
<ul>
  <li>Mode: <strong>Search & Destroy</strong></li>
  <li>Rounds: <strong>6 rounds</strong></li>
</ul>
```

### Exemple 3: Paragraphe avec mise en forme variée

1. Taper du texte normal
2. Sélectionner des mots et appliquer:
   - **B** pour gras
   - **I** pour italique
   - **U** pour souligné

**Résultat HTML:**
```html
<p>Le mode Hardcore est <strong>très compétitif</strong> et nécessite <em>beaucoup de précision</em>. Les joueurs doivent être <u>concentrés</u>.</p>
```

## 🔍 Vérification

### Backend
✅ Fichiers créés:
- `Server/src/models/GameModeRules.js`
- `Server/src/routes/gameModeRules.routes.js`
- `Server/src/scripts/seedGameModeRules.js`

✅ Fichier modifié:
- `Server/src/index.js` (routes enregistrées)

### Frontend
✅ Fichiers créés:
- `Client/src/components/GameModeRulesEditor.jsx`
- `Client/src/pages/GameModeRules.jsx`

✅ Fichiers modifiés:
- `Client/src/pages/AdminPanel.jsx` (nouvel onglet)
- `Client/src/App.jsx` (nouvelles routes)

## 🐛 Dépannage

### Erreur: "Cannot find module GameModeRules"
- Vérifier que le fichier `Server/src/models/GameModeRules.js` existe
- Redémarrer le serveur

### L'onglet "Règles modes" n'apparaît pas
- Vérifier que vous êtes connecté avec un compte **Staff** ou **Admin**
- Rafraîchir la page

### Le formatage ne fonctionne pas
- S'assurer que le texte est sélectionné avant de cliquer sur un bouton de formatage
- Vérifier que le curseur est dans l'éditeur

### Erreur MongoDB lors du seed
- Vérifier que MongoDB est en cours d'exécution
- Vérifier la variable `MONGODB_URI` dans `.env`

## 📱 Test sur Mobile

1. Trouver votre IP locale: `ipconfig` (Windows) ou `ifconfig` (Mac/Linux)
2. Accéder depuis mobile: `http://[VOTRE_IP]:5173/game-mode-rules/hardcore`
3. Vérifier que le design responsive fonctionne bien

## ✨ Fonctionnalités Clés

### Éditeur Riche
- [x] Gras, Italique, Souligné
- [x] Alignement (gauche, centre, droite)
- [x] Listes à puces et numérotées
- [x] Titres H1, H2, H3
- [x] Aperçu en temps réel

### Gestion
- [x] CRUD complet sur les sections
- [x] Multilingue (4 langues)
- [x] Organisation par mode
- [x] Sections repliables

### Affichage Utilisateur
- [x] Design adapté au mode (Hardcore rouge, CDL cyan)
- [x] Responsive mobile
- [x] Support HTML complet
- [x] Affichage langue utilisateur

## 🎯 Prochaines Étapes

1. ✅ Tester l'éditeur avec tous les boutons de formatage
2. ✅ Créer des règles pour chaque mode
3. ✅ Vérifier l'affichage dans toutes les langues
4. ✅ Intégrer des liens vers ces règles dans vos pages existantes

## 🤝 Besoin d'Aide?

Consultez le fichier `GAME_MODE_RULES_README.md` pour:
- Documentation complète de l'API
- Structure des données
- Exemples avancés
- Guide de maintenance

**Amusez-vous bien à créer vos règles! 🎉**

