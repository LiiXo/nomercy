# 📋 Liste de Tests - Modifications Récentes

## 🔴 1. Gestion des Litiges (Admin Panel)

### ✅ Test 1.1 : Annuler un litige (remettre en cours)
- [ ] Aller dans Admin Panel > Onglet "Litiges"
- [ ] Trouver un match en litige (ladder ou ranked)
- [ ] Cliquer sur "✓ Annuler le litige"
- [ ] Vérifier que le match repasse en statut "in_progress"
- [ ] Vérifier que le litige disparaît de la liste

### ✅ Test 1.2 : Annuler complètement un match (admin)
- [ ] Aller dans Admin Panel > Onglet "Litiges"
- [ ] Trouver un match en litige
- [ ] Cliquer sur "⛔ Annuler le match"
- [ ] Entrer une raison (optionnel)
- [ ] Confirmer l'annulation
- [ ] Vérifier que le match passe en statut "cancelled"
- [ ] Vérifier qu'aucune équipe n'est déclarée gagnante/perdante
- [ ] Vérifier que le match disparaît de la liste des litiges

### ✅ Test 1.3 : Résoudre un litige ladder (attribuer victoire)
- [ ] Aller dans Admin Panel > Onglet "Litiges"
- [ ] Trouver un match ladder en litige
- [ ] Cliquer sur "🏆 [Équipe] gagne" pour chaque équipe
- [ ] Vérifier que le match passe en statut "completed"
- [ ] Vérifier que les points sont attribués correctement

---

## 👤 2. Suppression de Compte

### ✅ Test 2.1 : Blocage si match ladder en cours
- [ ] Créer/accepter un match ladder avec une squad
- [ ] Aller dans Mon Profil > Paramètres
- [ ] Essayer de supprimer le compte
- [ ] Vérifier le message d'erreur : "Vous ne pouvez pas supprimer votre compte si vous avez un match en cours"
- [ ] Terminer ou annuler le match
- [ ] Réessayer la suppression → doit fonctionner

### ✅ Test 2.2 : Blocage si match ranked en cours
- [ ] Démarrer un match ranked (mode duel ou autre)
- [ ] Aller dans Mon Profil > Paramètres
- [ ] Essayer de supprimer le compte
- [ ] Vérifier le message d'erreur
- [ ] Terminer le match ranked
- [ ] Réessayer la suppression → doit fonctionner

### ✅ Test 2.3 : Blocage si squad existe
- [ ] Avoir une squad active
- [ ] Essayer de supprimer le compte
- [ ] Vérifier le message d'erreur concernant la squad
- [ ] Quitter la squad
- [ ] Réessayer la suppression → doit fonctionner

---

## 📢 3. Onglet "Mes Litiges"

### ✅ Test 3.1 : Accès depuis le menu déroulant (Desktop)
- [ ] Se connecter
- [ ] Cliquer sur l'avatar en haut à droite
- [ ] Vérifier la présence de "Mes Litiges" dans le menu
- [ ] Cliquer sur "Mes Litiges"
- [ ] Vérifier que la page s'affiche correctement

### ✅ Test 3.2 : Accès depuis le menu mobile
- [ ] Se connecter sur mobile/tablette
- [ ] Ouvrir le menu hamburger
- [ ] Vérifier la présence de "Mes Litiges"
- [ ] Cliquer dessus
- [ ] Vérifier que la page s'affiche correctement

### ✅ Test 3.3 : Affichage des litiges ladder
- [ ] Avoir un match ladder en litige (via votre squad)
- [ ] Aller sur "Mes Litiges"
- [ ] Vérifier que le match apparaît avec :
  - Nom de l'équipe challenger
  - Nom de l'équipe opponent
  - Raison du litige
  - Date de signalement
  - Bouton "Voir la feuille de match"

### ✅ Test 3.4 : Affichage des litiges ranked
- [ ] Avoir un match ranked en litige
- [ ] Aller sur "Mes Litiges"
- [ ] Vérifier que le match apparaît avec :
  - Mode de jeu (Duel, TDM, etc.)
  - Raison du litige
  - Date de signalement
  - Bouton "Voir la feuille de match"

### ✅ Test 3.5 : Aucun litige
- [ ] Se connecter avec un compte sans litige
- [ ] Aller sur "Mes Litiges"
- [ ] Vérifier le message "Aucun litige en cours"
- [ ] Vérifier l'icône de succès (bouclier vert)

---

## 🗺️ 4. Gestion des Maps (Staff)

### ✅ Test 4.1 : Créer une map (compte staff)
- [ ] Se connecter avec un compte staff (pas admin)
- [ ] Aller dans Admin Panel > Onglet "Maps"
- [ ] Cliquer sur "Ajouter une map"
- [ ] Remplir les informations
- [ ] Sauvegarder
- [ ] Vérifier que la map est créée

### ✅ Test 4.2 : Modifier une map (compte staff)
- [ ] Se connecter avec un compte staff
- [ ] Aller dans Admin Panel > Onglet "Maps"
- [ ] Modifier une map existante
- [ ] Sauvegarder
- [ ] Vérifier que les modifications sont appliquées

### ✅ Test 4.3 : Supprimer une map (compte staff)
- [ ] Se connecter avec un compte staff
- [ ] Aller dans Admin Panel > Onglet "Maps"
- [ ] Supprimer une map
- [ ] Vérifier que la map est supprimée

---

## 💬 5. Suppression de Conversation (Staff)

### ✅ Test 5.1 : Supprimer une conversation (compte staff)
- [ ] Se connecter avec un compte staff
- [ ] Aller dans Admin Panel > Onglet "Messages"
- [ ] Trouver une conversation
- [ ] Cliquer sur "Supprimer"
- [ ] Vérifier que la conversation est supprimée
- [ ] Vérifier qu'elle disparaît de la liste

### ✅ Test 5.2 : Tentative de suppression (compte user normal)
- [ ] Se connecter avec un compte user normal (pas staff)
- [ ] Essayer d'accéder à la route de suppression via l'API
- [ ] Vérifier que l'erreur 403 est retournée
- [ ] Vérifier le message "Accès réservé au staff"

---

## 📱 6. Dialog Historique Match (Responsive)

### ✅ Test 6.1 : Dialog sur mobile (< 768px)
- [ ] Aller sur un profil de joueur
- [ ] Cliquer sur "Voir détails" d'un match dans l'historique
- [ ] Vérifier que le dialog s'affiche correctement :
  - Padding adapté (p-2)
  - Tailles de police réduites
  - Grid en une colonne
  - Boutons et badges adaptés
  - Pas de débordement horizontal

### ✅ Test 6.2 : Dialog sur tablette (768px - 1024px)
- [ ] Tester le dialog sur une taille d'écran moyenne
- [ ] Vérifier que le layout s'adapte correctement
- [ ] Vérifier que les deux colonnes s'affichent si espace suffisant

### ✅ Test 6.3 : Dialog sur desktop (> 1024px)
- [ ] Tester le dialog sur un grand écran
- [ ] Vérifier que tout s'affiche correctement :
  - Grid en 2 colonnes
  - Tailles de police normales
  - Espacements corrects

### ✅ Test 6.4 : Contenu du dialog
- [ ] Vérifier l'affichage de l'équipe challenger
- [ ] Vérifier l'affichage de l'équipe opponent
- [ ] Vérifier les rosters des deux équipes
- [ ] Vérifier les badges gagnant/perdant
- [ ] Vérifier les informations du match (mode, date, etc.)

---

## 🖼️ 7. Upload Banner

### ✅ Test 7.1 : Upload banner normal (< 10MB)
- [ ] Aller dans Mon Profil
- [ ] Uploader une image banner normale
- [ ] Vérifier que l'upload fonctionne
- [ ] Vérifier que la banner s'affiche sur le profil

### ✅ Test 7.2 : Upload banner GIF (< 50MB)
- [ ] Aller dans Mon Profil
- [ ] Uploader un GIF animé (entre 10MB et 50MB)
- [ ] Vérifier que l'upload fonctionne (plus d'erreur 413)
- [ ] Vérifier que le GIF s'anime sur le profil

### ✅ Test 7.3 : Upload banner trop gros (> 50MB)
- [ ] Essayer d'uploader un fichier > 50MB
- [ ] Vérifier qu'une erreur appropriée est retournée

### ✅ Test 7.4 : Suppression de banner
- [ ] Supprimer la banner
- [ ] Vérifier qu'elle disparaît du profil
- [ ] Vérifier que l'avatar remonte correctement (pas de gradient)

---

## 📜 8. Règles de Mode de Jeu

### ✅ Test 8.1 : Ajouter une section (Hardcore - Rankings - Duo/Trio)
- [ ] Aller dans Admin Panel > Onglet "Règles des Modes de Jeu"
- [ ] Sélectionner : Hardcore > Rankings > Duo/Trio
- [ ] Remplir le titre (FR et EN obligatoires)
- [ ] Remplir le contenu (FR et EN obligatoires)
- [ ] Ajouter la section
- [ ] Vérifier qu'elle apparaît dans la liste
- [ ] Vérifier qu'aucune erreur 500 n'apparaît

### ✅ Test 8.2 : Ajouter une section (CDL - Ranked - Duel)
- [ ] Sélectionner : CDL > Ranked > Duel
- [ ] Ajouter une section avec formatage riche
- [ ] Vérifier que la section est sauvegardée
- [ ] Vérifier que le formatage est conservé

### ✅ Test 8.3 : Modifier une section existante
- [ ] Modifier une section existante
- [ ] Changer le titre et le contenu
- [ ] Sauvegarder
- [ ] Vérifier que les modifications sont appliquées

### ✅ Test 8.4 : Supprimer une section
- [ ] Supprimer une section
- [ ] Confirmer la suppression
- [ ] Vérifier qu'elle disparaît de la liste

### ✅ Test 8.5 : Validation des champs obligatoires
- [ ] Essayer d'ajouter une section sans titre FR
- [ ] Vérifier le message d'erreur
- [ ] Essayer d'ajouter une section sans contenu EN
- [ ] Vérifier le message d'erreur

### ✅ Test 8.6 : Affichage des règles dans Rankings
- [ ] Aller sur la page Rankings
- [ ] Cliquer sur "Règles" pour un ladder
- [ ] Vérifier que les règles créées s'affichent correctement

### ✅ Test 8.7 : Affichage des règles dans Ranked Mode
- [ ] Aller sur la page Ranked Mode
- [ ] Sélectionner un mode de jeu
- [ ] Cliquer sur "Règles du mode"
- [ ] Vérifier que les règles créées s'affichent correctement

---

## 🔄 9. Tests de Régression

### ✅ Test 9.1 : Match history avec équipe supprimée
- [ ] Vérifier qu'un match avec une équipe supprimée affiche toujours le nom
- [ ] Vérifier que le nom est en italique et non cliquable
- [ ] Vérifier le texte "Équipe supprimée" si aucune info n'est disponible

### ✅ Test 9.2 : Profil public sans banner
- [ ] Aller sur un profil public sans banner
- [ ] Vérifier qu'il n'y a pas de gradient banner
- [ ] Vérifier que l'avatar est bien positionné en haut

### ✅ Test 9.3 : Délai de 12h pour rejouer un joueur en duel
- [ ] Jouer un match ranked duel avec un joueur
- [ ] Essayer de rejouer immédiatement → doit être bloqué
- [ ] Attendre 12h (ou modifier la date en DB pour test)
- [ ] Réessayer → doit fonctionner

### ✅ Test 9.4 : Délai de 6h pour rejouer une équipe en ladder
- [ ] Jouer un match ladder avec une équipe
- [ ] Essayer de rejouer immédiatement → doit être bloqué
- [ ] Attendre 6h (ou modifier la date en DB pour test)
- [ ] Réessayer → doit fonctionner

### ✅ Test 9.5 : Map Nuketown uniquement pour Duel 1v1 ranked
- [ ] Vérifier que Nuketown n'apparaît que pour le mode Duel en ranked
- [ ] Vérifier qu'elle n'apparaît pas dans les autres modes

---

## 🎯 10. Tests Multi-utilisateurs

### ✅ Test 10.1 : Litige signalé par un joueur
- [ ] Joueur A : Signaler un litige sur un match
- [ ] Joueur B : Vérifier que le litige apparaît dans "Mes Litiges"
- [ ] Admin : Vérifier que le litige apparaît dans Admin Panel > Litiges

### ✅ Test 10.2 : Résolution de litige par admin
- [ ] Admin : Résoudre un litige en attribuant la victoire
- [ ] Joueur A : Vérifier que le match est terminé
- [ ] Joueur B : Vérifier que le match est terminé
- [ ] Vérifier que les points sont attribués correctement

---

## 📝 Notes de Test

### Environnements à tester :
- [ ] Desktop (Chrome, Firefox, Edge)
- [ ] Mobile (iOS Safari, Android Chrome)
- [ ] Tablette

### Comptes de test nécessaires :
- [ ] Compte Admin
- [ ] Compte Staff (pas admin)
- [ ] Compte User normal
- [ ] Compte avec Squad
- [ ] Compte sans Squad

### Données de test à préparer :
- [ ] Matchs en litige (ladder et ranked)
- [ ] Matchs en cours
- [ ] Matchs terminés avec équipes supprimées
- [ ] Banners de différentes tailles
- [ ] GIFs animés

---

## ✅ Checklist Finale

- [ ] Tous les tests ci-dessus sont passés
- [ ] Aucune erreur console dans le navigateur
- [ ] Aucune erreur dans les logs serveur
- [ ] Les traductions fonctionnent (FR, EN, DE, IT)
- [ ] Les permissions sont correctes (admin, staff, user)
- [ ] La responsivité est correcte sur tous les écrans

---

**Date de création :** $(date)
**Dernière mise à jour :** $(date)







