# Système de Règles des Modes de Jeu 📖

## Vue d'ensemble

Un système complet de gestion des règles spécifiques à chaque mode de jeu avec éditeur de texte riche intégré. Les règles peuvent être créées, modifiées et formatées avec du HTML pour chaque mode (Hardcore, CDL, Commun) et dans 4 langues (FR, EN, IT, DE).

## 🎯 Fonctionnalités

### Backend (Server)

#### Nouveau Modèle: `GameModeRules`
- **Chemin**: `Server/src/models/GameModeRules.js`
- **Champs**:
  - `mode`: hardcore | cdl
  - `title`: Titre multilingue (fr, en, it, de)
  - `sections`: Tableau de sections avec:
    - `title`: Titre de la section (multilingue)
    - `content`: Contenu HTML riche (multilingue)
    - `order`: Ordre d'affichage
    - `icon`: Identifiant d'icône
  - `isActive`: État actif/inactif
  - `createdBy`, `updatedBy`: Références utilisateur

#### Nouvelles Routes: `/api/game-mode-rules`
- **Chemin**: `Server/src/routes/gameModeRules.routes.js`

**Routes publiques**:
- `GET /:mode` - Récupérer les règles d'un mode spécifique

**Routes admin**:
- `GET /admin/all` - Récupérer toutes les règles (staff)
- `POST /admin/:mode` - Créer/mettre à jour les règles d'un mode (staff)
- `POST /admin/:mode/section` - Ajouter une section (staff)
- `PUT /admin/:mode/section/:sectionId` - Modifier une section (staff)
- `DELETE /admin/:mode/section/:sectionId` - Supprimer une section (staff)
- `DELETE /admin/:mode` - Supprimer toutes les règles d'un mode (staff)

### Frontend (Client)

#### Composant: `GameModeRulesEditor`
- **Chemin**: `Client/src/components/GameModeRulesEditor.jsx`
- **Fonctionnalités**:
  - Sélection du mode (Hardcore, CDL)
  - Éditeur de texte riche avec barre d'outils complète:
    - **Formatage**: Gras, Italique, Souligné
    - **Alignement**: Gauche, Centre, Droite
    - **Listes**: À puces, Numérotées
    - **Titres**: H1, H2, H3, Paragraphe normal
  - Gestion multilingue (FR, EN, IT, DE)
  - Aperçu en temps réel
  - CRUD complet sur les sections

#### Page Utilisateur: `GameModeRules`
- **Chemin**: `Client/src/pages/GameModeRules.jsx`
- **Route**: `/game-mode-rules/:mode`
- Affichage des règles formatées pour les utilisateurs
- Design adapté au mode (couleurs Hardcore/CDL)
- Support multilingue

#### Intégration Admin Panel
- **Nouvel onglet**: "Règles modes" (icône BookOpen)
- Accessible pour les utilisateurs Staff
- Interface complète de gestion

## 🚀 Installation et Configuration

### 1. Backend

Les routes sont déjà enregistrées dans `Server/src/index.js`:

```javascript
import gameModeRulesRoutes from './routes/gameModeRules.routes.js';
app.use('/api/game-mode-rules', gameModeRulesRoutes);
```

### 2. Initialisation des données

Exécutez le script de seed pour créer des règles d'exemple:

```bash
cd Server
node src/scripts/seedGameModeRules.js
```

Ce script crée:
- Règles Hardcore (3 sections)
- Règles CDL (2 sections)

### 3. Frontend

Les routes sont déjà configurées dans `Client/src/App.jsx`:

```javascript
import GameModeRules from './pages/GameModeRules';

<Route path="/game-mode-rules/:mode" element={
  <PageTransition>
    <GameModeRules />
  </PageTransition>
} />
```

## 📝 Utilisation

### Pour les Admins et Staff

1. **Accéder au panneau admin**: `/admin`
2. **Cliquer sur l'onglet**: "Règles modes"
3. **Sélectionner un mode**: Hardcore ou CDL
4. **Créer/modifier des sections**:
   - Remplir le titre dans les 4 langues (FR et EN obligatoires)
   - Utiliser l'éditeur riche pour formater le contenu
   - Voir l'aperçu en temps réel
   - Sauvegarder

### Barre d'outils de l'éditeur

- **B** (Bold): Texte en gras
- **I** (Italic): Texte en italique
- **U** (Underline): Texte souligné
- **Alignement**: Aligner le texte à gauche, au centre, ou à droite
- **Listes**: Créer des listes à puces ou numérotées
- **H1, H2, H3**: Créer des titres de différentes tailles
- **T**: Revenir au paragraphe normal

### Pour les Utilisateurs

Les utilisateurs peuvent consulter les règles via:
- URL directe: `/game-mode-rules/hardcore`
- URL directe: `/game-mode-rules/cdl`

Ou en intégrant des liens dans vos pages existantes.

## 🎨 Formatage du Contenu

L'éditeur génère du HTML qui supporte:
- **Balises de formatage**: `<strong>`, `<em>`, `<u>`
- **Titres**: `<h1>`, `<h2>`, `<h3>`
- **Paragraphes**: `<p>`
- **Listes**: `<ul>`, `<ol>`, `<li>`
- **Alignement**: `style="text-align: center/left/right"`

### Exemple de contenu riche

```html
<h2 style="text-align: center;">⚔️ Règles de Match ⚔️</h2>
<p>Tous les matchs se jouent en <strong>Best of 3</strong>.</p>
<ul>
  <li>Mode: Search & Destroy</li>
  <li>Rounds: <em>6 rounds</em></li>
  <li>Temps: <u>90 secondes</u></li>
</ul>
<p style="text-align: center;"><strong>Fair-play avant tout!</strong></p>
```

## 🔧 Structure Technique

### Modèle de Données

```javascript
{
  mode: "hardcore", // ou "cdl"
  title: {
    fr: "Règles du Mode Hardcore",
    en: "Hardcore Mode Rules",
    it: "Regole Modalità Hardcore",
    de: "Hardcore-Modus-Regeln"
  },
  sections: [
    {
      title: { fr: "...", en: "...", it: "...", de: "..." },
      content: { fr: "<html>...</html>", en: "...", it: "...", de: "..." },
      order: 0,
      icon: "gamepad"
    }
  ],
  isActive: true,
  createdBy: ObjectId,
  updatedBy: ObjectId
}
```

### Séparation des Règles

- **Règles Générales** (existant): Règles de plateforme globales
  - Onglet: "Règlement général"
  - Modèle: `Rule`
  - Sections fixes: generalRules, matchRules, squadRules, sanctions, cheating

- **Règles des Modes de Jeu** (nouveau): Règles spécifiques aux modes
  - Onglet: "Règles modes"
  - Modèle: `GameModeRules`
  - Modes: hardcore, cdl
  - Sections personnalisables avec contenu riche
  - Permissions: Staff et Admin

## 📚 Exemples d'Utilisation

### Ajouter un lien vers les règles d'un mode

```jsx
import { Link } from 'react-router-dom';

<Link to="/game-mode-rules/hardcore">
  Voir les règles Hardcore
</Link>
```

### Créer une section avec mise en forme

1. Titre de section: "Vue d'ensemble"
2. Contenu avec formatage:
   - Ajouter un titre H2 centré
   - Écrire du texte avec des mots en gras
   - Créer une liste à puces
   - Ajouter une note centrée en italique

## 🌐 Support Multilingue

Toutes les sections supportent 4 langues:
- 🇫🇷 Français (obligatoire)
- 🇬🇧 English (obligatoire)
- 🇮🇹 Italiano (optionnel)
- 🇩🇪 Deutsch (optionnel)

Les utilisateurs voient automatiquement la version dans leur langue préférée (définie dans leur profil).

## ⚠️ Notes Importantes

1. **FR et EN obligatoires**: Chaque section doit avoir un titre et un contenu en français et en anglais
2. **Contenu HTML**: Le contenu est stocké en HTML et rendu avec `dangerouslySetInnerHTML`
3. **Sécurité**: Seuls les admins peuvent créer/modifier les règles
4. **Ordre des sections**: Défini par le champ `order` (0, 1, 2, ...)

## 🎯 Cas d'Usage

### 1. Règles par Mode de Jeu
Créez des règles spécifiques pour:
- Mode Hardcore (règles strictes, armes interdites)
- Mode CDL (format professionnel, GAs)

### 2. Format Professionnel
Utilisez le formatage riche pour:
- Mettre en évidence les points importants (gras)
- Créer des listes d'armes/équipements interdits
- Centrer les titres de sections
- Ajouter des emojis pour rendre plus visuel

### 3. Mises à Jour Faciles
- Modifiez facilement une section existante
- Ajoutez de nouvelles sections sans toucher au code
- Gérez les traductions indépendamment

## 🛠️ Maintenance

### Ajouter un nouveau mode

1. Modifier `GameModeRules.js`:
```javascript
enum: ['hardcore', 'cdl', 'nouveau_mode']
```

2. Modifier `gameModeRules.routes.js`:
```javascript
if (!['hardcore', 'cdl', 'nouveau_mode'].includes(mode))
```

3. Ajouter dans `GameModeRulesEditor.jsx`:
```javascript
const MODES = [
  ...
  { value: 'nouveau_mode', label: 'Nouveau Mode', color: 'green' }
];
```

## 🎉 Résumé

Vous disposez maintenant d'un système complet et professionnel pour gérer les règles de vos modes de jeu avec:
- ✅ Éditeur de texte riche (gras, centré, listes, etc.)
- ✅ Support multilingue (4 langues)
- ✅ Interface admin intuitive
- ✅ Page utilisateur élégante
- ✅ Gestion par mode de jeu
- ✅ Système de sections organisées

Profitez de ce nouvel outil pour créer des règles claires et professionnelles! 🚀

