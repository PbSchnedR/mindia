# 💬 Améliorations du Chat Patient

## 📋 Résumé des Changements

Le système de chat patient a été amélioré avec des réponses mockées intelligentes et un bouton de déconnexion.

---

## ✅ Fonctionnalités Ajoutées

### 1. Bouton de Déconnexion dans le Chat

**Emplacement :** En haut à droite du chat, à côté du titre

**Fonctionnement :**
- Clic → Alerte de confirmation
- "Annuler" ou "Déconnexion"
- Redirection vers la page d'accueil après déconnexion

**Code :**
```typescript
const handleSignOut = async () => {
  Alert.alert(
    'Déconnexion',
    'Es-tu sûr·e de vouloir te déconnecter ?',
    [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/');
        },
      },
    ]
  );
};
```

---

### 2. Réponses Mockées Intelligentes de l'IA

**Avant :**
- Réponse unique et générique pour tous les messages

**Après :**
- Détection de mots-clés dans le message du patient
- Réponses contextuelles et empathiques
- 5 réponses génériques variées si aucun mot-clé détecté
- Délai de 800ms pour simuler le "typing"

#### Mots-clés Détectés

| Mots-clés | Réponse Contextuelle |
|-----------|---------------------|
| **stress, stressé** | Conseils sur la respiration et les pauses |
| **anxieux, angoisse, peur** | Validation de l'émotion, questions sur les déclencheurs |
| **triste, tristesse, déprim** | Empathie, suggestion de parler à un proche |
| **colère, énervé, furieux** | Normalisation de l'émotion, respiration profonde |
| **fatigue, fatigué, épuis** | Reconnaissance du besoin de repos |
| **dormir, sommeil, insomnie** | Conseils sur la routine du soir |
| **mieux, bien, content** | Renforcement positif |
| **merci** | Encouragement à revenir |

#### Exemple de Conversation

**Patient :** "Je suis vraiment stressé en ce moment"

**IA :** "Je comprends que tu te sentes stressé·e. Le stress peut être difficile à gérer. As-tu essayé des techniques de respiration ou une courte pause ? Parfois, prendre quelques minutes pour soi peut vraiment aider."

---

**Patient :** "J'ai du mal à dormir"

**IA :** "Le sommeil est essentiel pour ton bien-être. Si tu as des difficultés à dormir, essaie d'établir une routine apaisante le soir : pas d'écrans, lumière tamisée, lecture... En parles-tu avec ton thérapeute ?"

---

**Patient :** "J'ai fait une promenade et je me sens mieux"

**IA :** "C'est vraiment positif de te sentir mieux ! Continue à prendre soin de toi et à identifier ce qui te fait du bien. Ces moments sont précieux."

---

#### Réponses Génériques

Si aucun mot-clé n'est détecté, l'IA choisit aléatoirement parmi ces réponses :

1. "Merci d'avoir partagé ça. Ce que tu ressens est important. Peux-tu m'en dire un peu plus sur ce qui se passe pour toi en ce moment ?"
2. "Je t'écoute. Prends ton temps pour mettre des mots sur ce que tu vis. Les actions proposées ci-dessous peuvent aussi t'aider."
3. "C'est courageux de ta part d'exprimer ce que tu ressens. As-tu identifié ce qui pourrait t'aider à te sentir mieux là, maintenant ?"
4. "Merci de te confier. Ton ressenti est légitime. N'hésite pas à essayer l'une des actions proposées juste en dessous si tu t'en sens capable."
5. "Je comprends. Chaque émotion a sa place. Regarde les suggestions ci-dessous et choisis ce qui te semble faisable maintenant."

---

## 🔧 Implémentation Technique

### Fonction de Génération de Réponses

```typescript
const getMockAIResponse = (userMessage: string): string => {
  const lowercaseMessage = userMessage.toLowerCase();
  
  // Détection de mots-clés
  if (lowercaseMessage.includes('stress') || lowercaseMessage.includes('stressé')) {
    return "Je comprends que tu te sentes stressé·e...";
  }
  
  // ... autres conditions ...
  
  // Réponses génériques variées
  const genericResponses = [
    "Merci d'avoir partagé ça...",
    "Je t'écoute...",
    // ...
  ];
  
  return genericResponses[Math.floor(Math.random() * genericResponses.length)];
};
```

### Flux d'Envoi de Message

```typescript
const handleSend = async () => {
  // 1. Envoyer le message du patient
  const updated = await appendMessage(chatId, 'patient', currentText);
  setMessages(updated.messages);
  
  const userMessage = currentText;
  setCurrentText('');

  // 2. Attendre 800ms (simuler le typing)
  await new Promise(resolve => setTimeout(resolve, 800));

  // 3. Générer et envoyer la réponse mockée
  const aiResponse = getMockAIResponse(userMessage);
  const auto = await appendMessage(chatId, 'ai', aiResponse);
  setMessages(auto.messages);
};
```

---

## 🎯 Utilisation

### Test du Chat

1. **Connectez-vous en tant que patient**
   - Scannez un QR code ou utilisez un token JWT

2. **Ouvrez la bulle de parole**
   - Cliquez sur "Ouvrir ma bulle" dans le dashboard

3. **Testez les réponses contextuelles**
   - Écrivez "Je suis stressé" → Réponse sur le stress
   - Écrivez "J'ai du mal à dormir" → Réponse sur le sommeil
   - Écrivez "Je me sens mieux" → Réponse positive

4. **Testez le bouton de déconnexion**
   - Cliquez sur "Déconnexion" en haut à droite
   - Confirmez la déconnexion
   - Vous êtes redirigé vers la page d'accueil

---

## 🔄 Migration vers IA Réelle

Quand vous serez prêt à intégrer une vraie IA (GPT, Claude, etc.), remplacez simplement la fonction `getMockAIResponse` :

```typescript
// Remplacer ceci (mock)
const aiResponse = getMockAIResponse(userMessage);

// Par ceci (vraie IA)
const aiResponse = await callRealAI(userMessage, conversationHistory);
```

**Avantages de cette approche :**
- ✅ Le flux de conversation est déjà en place
- ✅ L'interface utilisateur est prête
- ✅ Les messages sont sauvegardés en base de données
- ✅ Le système fonctionne de manière autonome en attendant

---

## 📊 Exemples de Réponses

### Scénario 1 : Stress
```
Patient: "Je suis super stressé par mon travail"
IA: "Je comprends que tu te sentes stressé·e. Le stress peut être difficile 
     à gérer. As-tu essayé des techniques de respiration ou une courte pause ? 
     Parfois, prendre quelques minutes pour soi peut vraiment aider."
```

### Scénario 2 : Insomnie
```
Patient: "J'arrive pas à dormir depuis 3 jours"
IA: "Le sommeil est essentiel pour ton bien-être. Si tu as des difficultés 
     à dormir, essaie d'établir une routine apaisante le soir : pas d'écrans, 
     lumière tamisée, lecture... En parles-tu avec ton thérapeute ?"
```

### Scénario 3 : Message Générique
```
Patient: "J'ai passé une journée compliquée"
IA: "Je t'écoute. Prends ton temps pour mettre des mots sur ce que tu vis. 
     Les actions proposées ci-dessous peuvent aussi t'aider."
```

### Scénario 4 : Amélioration
```
Patient: "Merci, je me sens beaucoup mieux maintenant"
IA: "C'est vraiment positif de te sentir mieux ! Continue à prendre soin 
     de toi et à identifier ce qui te fait du bien. Ces moments sont précieux."
```

---

## 🐛 Points d'Attention

### Limites du Système Mock

1. **Détection simple** : Les mots-clés sont détectés de manière basique (includes)
2. **Pas de contexte** : L'IA ne se souvient pas des messages précédents
3. **Pas de nuances** : Les réponses sont prédéfinies
4. **Langue française uniquement** : Les mots-clés sont en français

### Améliorations Futures

- [ ] Intégrer une vraie IA (GPT-4, Claude, etc.)
- [ ] Ajouter un historique de conversation pour le contexte
- [ ] Détecter la langue du patient automatiquement
- [ ] Améliorer la détection de sentiments (NLP)
- [ ] Ajouter des réponses multi-étapes (suivi de conversation)
- [ ] Intégrer des ressources externes (numéros d'urgence, exercices)

---

## ✅ Checklist de Test

- [ ] Le bouton de déconnexion s'affiche dans le chat
- [ ] Cliquer sur "Déconnexion" affiche une alerte de confirmation
- [ ] La déconnexion redirige vers la page d'accueil
- [ ] Les messages sont envoyés correctement
- [ ] L'IA répond après un délai de ~800ms
- [ ] Les réponses sont contextuelles (testez chaque mot-clé)
- [ ] Les réponses génériques varient
- [ ] Les messages sont sauvegardés en base de données
- [ ] Le chat fonctionne sur mobile
- [ ] Le clavier ne masque pas le champ de saisie

---

## 📚 Documentation Complète

- **`app/patient/chat.tsx`** - Composant principal du chat
- **`app/patient/dashboard.tsx`** - Dashboard patient avec bouton "Ouvrir ma bulle"
- **`lib/chat.ts`** - Fonctions utilitaires pour les messages
- **`lib/api.ts`** - API pour l'envoi/réception de messages

---

## 🎉 Résultat Final

Le patient peut maintenant :
- ✅ Se déconnecter facilement depuis le chat
- ✅ Recevoir des réponses empathiques et contextuelles
- ✅ Vivre une expérience de conversation naturelle
- ✅ Bénéficier d'un système fonctionnel en attendant l'IA réelle

**Le système est prêt pour les tests utilisateurs !** 🚀
