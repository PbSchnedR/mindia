# MindIA — Documentation Technique et Fonctionnelle

> **Version** : MVP — Derniere mise a jour : Fevrier 2026
>
> MindIA est une application de sante mentale reliant patients et therapeutes via une IA bienveillante, disponible 24h/24 entre les seances de therapie.

---

## Table des matieres

1. [Presentation du projet](#1-presentation-du-projet)
2. [Architecture globale](#2-architecture-globale)
3. [Justification des choix technologiques](#3-justification-des-choix-technologiques)
4. [Documentation fonctionnelle](#4-documentation-fonctionnelle)
5. [Documentation technique — Frontend](#5-documentation-technique--frontend)
6. [Documentation technique — Backend](#6-documentation-technique--backend)
7. [Base de donnees](#7-base-de-donnees)
8. [Authentification et securite](#8-authentification-et-securite)
9. [Intelligence artificielle](#9-intelligence-artificielle)
10. [Design System et UI](#10-design-system-et-ui)
11. [API Reference](#11-api-reference)
12. [Installation et deploiement](#12-installation-et-deploiement)
13. [Roadmap](#13-roadmap)

---

## 1. Presentation du projet

### Contexte

MindIA est ne du constat que l'accompagnement therapeutique se limite souvent aux seances en cabinet. Entre les rendez-vous, les patients peuvent traverser des moments difficiles sans soutien immediat. MindIA comble ce vide en offrant :

- **Un assistant IA bienveillant** disponible 24h/24 pour le patient
- **Un tableau de bord therapeute** pour suivre l'etat de ses patients en temps reel
- **Un journal intime** pour le patient, permettant un suivi emotionnel continu
- **Un systeme de constats** ou le therapeute peut rediger des observations et l'IA peut generer des syntheses

### Objectifs

| Objectif | Description |
|----------|-------------|
| Accessibilite | Application cross-platform (iOS, Android, Web) depuis un seul code source |
| Simplicite | Connexion patient par QR code / magic link sans mot de passe |
| Securite | Donnees sensibles chiffrees, authentification JWT, tokens a usage unique |
| Collaboration | Le therapeute et l'IA travaillent ensemble pour accompagner le patient |
| Responsive | Interface optimisee pour mobile ET desktop |

---

## 2. Architecture globale

```
┌──────────────────────────────────────────────────┐
│                    CLIENT                         │
│  React Native (Expo) + Expo Router + NativeWind   │
│  iOS / Android / Web                              │
└────────────────────┬─────────────────────────────┘
                     │ HTTPS / REST
┌────────────────────▼─────────────────────────────┐
│                   BACKEND                         │
│  Node.js + Express 5                              │
│  JWT Auth + Magic Tokens                          │
│  Google GenAI (Gemini) pour IA                    │
└────────────────────┬─────────────────────────────┘
                     │ Mongoose ODM
┌────────────────────▼─────────────────────────────┐
│                  DATABASE                         │
│  MongoDB                                          │
└──────────────────────────────────────────────────┘
```

### Structure des repertoires

```
VScode/
├── mindia/                  # Frontend (Expo/React Native)
│   ├── app/                 # Pages et routes (Expo Router)
│   ├── components/          # Composants reutilisables
│   ├── lib/                 # Services, API, auth, types
│   ├── hooks/               # Custom hooks
│   ├── constants/           # Design tokens, theme
│   └── assets/              # Images, icones
│
└── mindia-backend/          # Backend (Express/Node.js)
    ├── routes/              # Definitions des routes API
    ├── models/              # Schemas Mongoose
    ├── controllers/         # Logique metier
    └── middlewares.js       # Auth, erreurs
```

---

## 3. Justification des choix technologiques

### Frontend

| Technologie | Justification |
|-------------|--------------|
| **React Native + Expo (SDK 54)** | Permet de deployer une seule base de code sur iOS, Android et Web. Expo simplifie le build et l'acces aux APIs natives (camera, stockage). |
| **Expo Router v6** | Routing file-based inspire de Next.js, natif pour Expo. Simplifie la navigation, le deep-linking et le code-splitting. Les layouts imbriques permettent de gerer les sous-navigations complexes (tabs patient, detail therapeute). |
| **NativeWind v4 (Tailwind CSS)** | Systeme de style utilitaire compatible React Native et Web. Garantit un rendu CSS identique sur toutes les plateformes, evitant les divergences visuelles entre simulateur et vrai appareil. |
| **React Navigation v7** | Bibliotheque de navigation mature et performante, sous-jacente a Expo Router. Gere les transitions, le theming et l'accessibilite. |
| **AsyncStorage** | Stockage cle-valeur persistant cross-platform pour les sessions utilisateur. Alternative legere a SQLite pour les donnees simples. |
| **expo-image** | Chargement d'images optimise avec cache, placeholder et transitions. Plus performant que le `Image` natif. |
| **expo-camera** | Acces natif a la camera pour le scan de QR code. Fallback web disponible. |
| **react-calendly** | Integration du widget Calendly pour la prise de rendez-vous. Solution eprouvee qui evite de recreer un systeme de reservation complet. |
| **Ionicons** | Bibliotheque d'icones vectorielles coherente et complete, integree nativement avec Expo. Remplace les emojis pour un rendu professionnel sur toutes les plateformes. |

### Backend

| Technologie | Justification |
|-------------|--------------|
| **Node.js + Express 5** | Environnement JavaScript unifie front/back. Express 5 offre un meilleur support async/await et une gestion des erreurs native avec les promesses. Ecosysteme NPM riche. |
| **MongoDB + Mongoose** | Base NoSQL flexible, ideale pour le MVP : schemas evolutifs, documents imbriques (messages, conversations, journal), pas de migrations SQL. Mongoose apporte la validation et le typage des schemas. |
| **JWT (jsonwebtoken)** | Standard industriel pour l'authentification stateless. Permet de verifier l'identite sans interroger la base a chaque requete. Token signe cote serveur. |
| **bcrypt** | Hachage de mots de passe avec salage automatique. Protection contre les attaques par dictionnaire et rainbow tables. |
| **Google GenAI (Gemini)** | API IA de Google pour la generation de reponses empathiques et l'OCR. Modele multimodal capable de traiter texte et images. Choisi pour sa capacite a comprendre le contexte emotionnel. |
| **helmet** | Protection HTTP par ajout automatique de headers de securite (CSP, HSTS, X-Frame-Options, etc.). |
| **cors** | Gestion fine des origines autorisees pour les requetes cross-origin. |
| **morgan** | Logging HTTP en developpement pour le debug des requetes. |

### Base de donnees

| Choix | Justification |
|-------|--------------|
| **MongoDB** | Structure document flexible adaptee aux donnees variees (conversations, journal, constats). Les sous-documents evitent les jointures couteuses. Scalable horizontalement pour la production. |
| **Schema unique `User`** | Un seul modele avec role (`therapist` / `patient`) et champs conditionnels. Simplifie les requetes et la gestion des relations therapeute-patient. |
| **TTL sur MagicTokens** | Les tokens QR expirent automatiquement apres 24h grace a l'index TTL de MongoDB, sans cron job. |

### Pourquoi pas... ?

| Alternative ecartee | Raison |
|--------------------|--------|
| Flutter | Ecosysteme moins mature cote web, courbe d'apprentissage Dart |
| Next.js seul | Pas de support natif iOS/Android sans couche React Native |
| PostgreSQL | Over-engineering pour un MVP, schemas rigides |
| Firebase | Vendor lock-in, couts impredictibles a l'echelle |
| Socket.io | Non necessaire au MVP — le polling suffit pour le chat asynchrone |

---

## 4. Documentation fonctionnelle

### 4.1 Parcours utilisateur — Patient

```
QR Code / Email Magic Link
        │
        ▼
  Page de connexion (index.tsx)
  ├── Scanner QR code
  └── Saisir email patient
        │
        ▼
  Dashboard Patient
  ├── 🫧 Ma Bulle (chat IA)
  │     └── Conversation avec l'IA
  │         ├── Suggestions de demarrage
  │         ├── Historique des conversations
  │         └── Reponses empathiques
  ├── 📓 Journal
  │     ├── Ecrire une entree (texte + humeur)
  │     └── Historique en timeline
  ├── 📋 Constats
  │     ├── Constats therapeute (observations)
  │     └── Syntheses IA (generees automatiquement)
  └── 📅 Rendez-vous
        ├── Widget Calendly integre (web)
        └── Lien externe (mobile natif)
```

### 4.2 Parcours utilisateur — Therapeute

```
Email + Mot de passe
        │
        ▼
  Page de connexion (index.tsx)
        │
        ▼
  Dashboard Therapeute
  ├── Liste des patients
  │     ├── Indicateurs d'humeur (vert/orange/rouge)
  │     ├── Resume derniere session IA
  │     └── Statistiques (urgent, en difficulte)
  ├── Detail patient (clic)
  │     ├── 👁 Apercu : QR code + humeur + dernier message + raccourci
  │     ├── 📋 Constats : Ajouter/voir mes constats + constats IA
  │     └── 💬 Discussion : Interface chat (envoyer un message au patient)
  └── ⚙ Parametres
        ├── URL de reservation Calendly
        ├── Notifications (a venir)
        └── Securite (a venir)
```

### 4.3 Fonctionnalites detaillees

| Fonctionnalite | Patient | Therapeute | Description |
|----------------|---------|------------|-------------|
| Connexion QR code | ✅ | — | Scan du QR genere par le therapeute |
| Connexion magic link email | ✅ | — | Saisie de l'email, token automatique |
| Connexion email/mdp | — | ✅ | Authentification classique |
| Chat IA (La Bulle) | ✅ | — | Conversation avec IA empathique, multi-conversations |
| Journal | ✅ | — | Entrees textuelles avec humeur (5 niveaux) |
| Constats therapeute | Lecture | Ecriture | Observations post-seance |
| Syntheses IA | Lecture | Lecture | Generees depuis les echanges patient-IA |
| Discussion therapeute | ✅ | ✅ | Messages directs therapeute-patient |
| Prise de RDV Calendly | ✅ | Config | Widget integre ou lien externe |
| QR code patient | — | ✅ | Generation du QR dans l'apercu patient |
| Suivi d'humeur | ✅ | Lecture | Selecteur 3 niveaux (Bien/Difficile/Urgence) |
| Gestion patients | — | ✅ | Creer, voir, suivre ses patients |
| Parametres | — | ✅ | Booking URL, profil, notifications |

---

## 5. Documentation technique — Frontend

### 5.1 Routes (Expo Router)

| Route | Fichier | Role |
|-------|---------|------|
| `/` | `app/index.tsx` | Page de connexion unifiee (patient/therapeute) |
| `/patient/dashboard` | `app/patient/dashboard.tsx` | Dashboard patient (Bulle, Journal, Constats, RDV) |
| `/patient/chat` | `app/patient/chat.tsx` | Interface de chat IA |
| `/therapist/dashboard` | `app/therapist/dashboard.tsx` | Liste des patients |
| `/therapist/settings` | `app/therapist/settings.tsx` | Parametres therapeute |
| `/therapist/patient/[patientId]` | `app/therapist/patient/[patientId].tsx` | Detail d'un patient |

> Pages legacy (non utilisees dans le flux principal) : `/patient`, `/therapist`, `/patient/magic-link`, `/(tabs)`

### 5.2 Composants reutilisables

| Composant | Fichier | Description |
|-----------|---------|-------------|
| `Button` | `components/ui/button.tsx` | Bouton avec 5 variants (primary, secondary, danger, ghost, soft), 3 tailles, icone optionnelle, loading state |
| `TextField` | `components/ui/text-field.tsx` | Champ de saisie avec label, icone, erreur |
| `PageLayout` | `components/ui/page-layout.tsx` | Layout de page avec header, sticky content, scroll, bottom content |
| `SectionCard` | `components/ui/section-card.tsx` | Card de section avec titre, icone, 3 variants |
| `BottomTabBar` | `components/ui/bottom-tab-bar.tsx` | Barre de navigation mobile avec icones |
| `EmptyState` | `components/ui/empty-state.tsx` | Etat vide avec icone, titre, sous-titre, action |
| `ReportCard` | `components/ui/report-card.tsx` | Card de constat (therapeute ou IA) |
| `MoodSelector` | `components/ui/mood-selector.tsx` | Selecteur d'humeur (3 niveaux avec icones) |
| `QRScanner` | `components/qr-scanner.tsx` | Scanner QR (camera native ou fallback web) |
| `QRCodeDisplay` | `components/qr-code-display.tsx` | Affichage QR code (SVG natif ou API web) |
| `Badge` | `components/ui/badge.tsx` | Badge de severite colore |

### 5.3 Services (`lib/`)

| Module | Fichier | Description |
|--------|---------|-------------|
| **API Client** | `lib/api.ts` | Client HTTP centralise avec retry, health check, et tous les endpoints (auth, users, messages, conversations, reports, journal, crisis-eval, actions, consent, ai) |
| **Auth** | `lib/auth.ts` | Helpers d'authentification : `saveSession`, `getSession`, `signOut`, `signInPatientByMagicToken`, `signInTherapist` |
| **Chat** | `lib/chat.ts` | Gestion des sessions de chat : lister, creer, ajouter un message, definir severite/resume. Fallback local si API indisponible. |
| **People** | `lib/people.ts` | Normalisation des donnees therapeute/patient depuis l'API |
| **Session Context** | `lib/session-context.tsx` | Provider React avec `useSession()` : session, loading, setSession, refresh, signOut |
| **Storage** | `lib/storage.ts` | Abstraction AsyncStorage : `storageGetJson`, `storageSetJson`, `storageRemove` |
| **Types** | `lib/types.ts` | Types TypeScript partages : `Session`, `Severity`, `ChatMessage`, `Patient`, `Therapist`, etc. |
| **Mock DB** | `lib/mockDb.ts` | Base de donnees locale de fallback pour le developpement offline |

### 5.4 Design Tokens

Les design tokens sont centralises dans `constants/tokens.ts` :

```
colors:     primary, primaryLight, primaryMedium, primaryDark,
            bg, bgSecondary, bgTertiary, bgDesktop, bgDark,
            text, textSecondary, textTertiary, textOnPrimary, textOnDark,
            border, borderLight,
            success, warning, error, ai, aiLight, ...

spacing:    xs(4) sm(8) md(12) lg(16) xl(20) 2xl(24) 3xl(32) 4xl(40) 5xl(56)

radius:     xs(4) sm(8) md(12) lg(16) xl(20) 2xl(24) 3xl(32) full(9999)

font:       title, subtitle, sectionTitle, body, bodyMedium, bodySmall,
            button, buttonSm, caption, label

layout:     maxWidth(1080) pagePadding(24) desktopBreakpoint(1024)
            safeAreaTop(25) bottomTabHeight(68)
```

### 5.5 Responsive Design

L'application utilise un systeme desktop/mobile base sur :

```typescript
// hooks/use-breakpoint.ts
const isDesktop = Platform.OS === 'web' && width >= 1024;
```

- **Desktop** : Sidebar + contenu principal, layouts 2 colonnes
- **Mobile** : Navigation par tabs en bas, layouts empiles

> **Important** : Tout le CSS mobile est statique et independant de `Platform.OS` pour garantir un rendu identique entre le simulateur web et un vrai telephone. Les seuls usages de `Platform.OS` sont :
> - Detection desktop (`Platform.OS === 'web'`)
> - URL API (reseau local vs localhost)
> - Implementation QR scanner (camera native vs input web)

---

## 6. Documentation technique — Backend

### 6.1 Architecture

```
index.js (serveur Express)
├── middlewares.js
│   ├── authenticate (JWT)
│   ├── requireTherapist (role check)
│   └── errorHandler
├── routes/
│   ├── user_route.js (auth, CRUD, patients, messages, conversations, reports, journal, crisis, actions, consent)
│   └── ai_route.js (reply, OCR)
├── controllers/
│   ├── user_controller.js
│   └── ai_controller.js
└── models/
    ├── user_model.js (User schema)
    └── MagicToken.js (tokens a usage unique)
```

### 6.2 Middleware

| Middleware | Description |
|------------|-------------|
| `authenticate` | Verifie le JWT dans le header `Authorization: Bearer <token>`. Attache `req.user` (id, role). |
| `requireTherapist` | Verifie que `req.user.role === 'therapist'`. Retourne 403 sinon. |
| `errorHandler` | Catch-all pour les erreurs non gerees. Retourne JSON avec status et message. |

### 6.3 Securite

- **CORS** : Origines autorisees specifiques (pas de wildcard en production)
- **Helmet** : Headers de securite HTTP automatiques
- **bcrypt** : Hachage des mots de passe avec salt
- **JWT** : Tokens signes avec `process.env.JWT_SECRET`
- **Magic Tokens** : Expiration TTL 24h, usage unique, supprimes apres utilisation
- **Express body limit** : 50 Mo max (pour l'OCR d'images)

---

## 7. Base de donnees

### 7.1 Modele User

```
User {
  // Identite
  username: String (required, unique)
  email: String (required, unique)
  role: 'therapist' | 'patient'
  password: String (hache bcrypt, optionnel pour patients)

  // Therapeute
  profession: String
  practiceArea: String
  phone: String
  siret: String
  bookingUrl: String
  professionalLinks: [String]

  // Patient
  therapyTopic: String
  severityLevel: String
  actual_mood: String
  lastSessionAt: Date
  nextSessionAt: Date
  sessionsDone: Number

  // Donnees embarquees
  conversations: [{ messages: [{from, text, createdAt}], createdAt }]
  patients: [ObjectId → User]         // pour les therapeutes
  reports: [{ date, content, from }]
  journal: [{ date, mood, text, tags, crisisLevel }]
  crisisEvaluations: [{ date, conversationId, level, summary, flagged }]
  recommendedActions: [{ title, description, type, url }]
  notificationPrefs: { onPatientCrisis, onPatientMessage, onAiConsult, email, push }
  dataConsent: { accepted, acceptedAt, version }
}
```

### 7.2 Modele MagicToken

```
MagicToken {
  token: String (unique)
  userId: ObjectId → User
  createdBy: ObjectId → User
  createdAt: Date (TTL 24h, auto-expire)
  usedAt: Date (optionnel, marque a l'utilisation)
}
```

---

## 8. Authentification et securite

### Flux d'authentification

```
Patient (QR Code):
  1. Therapeute genere un QR → POST /api/users/:id/token → MagicToken cree
  2. Patient scanne le QR → token extrait
  3. POST /api/auth/verify { token } → JWT retourne
  4. JWT stocke dans AsyncStorage

Patient (Email Magic Link):
  1. Patient saisit son email
  2. POST /api/auth/verify { email } → recherche par email → JWT retourne
  3. JWT stocke dans AsyncStorage

Therapeute:
  1. Saisie email + mot de passe
  2. POST /api/auth/login { email, password } → bcrypt.compare → JWT retourne
  3. JWT stocke dans AsyncStorage
```

### Session cote client

```typescript
interface Session {
  token: string;
  role: 'therapist' | 'patient';
  therapistId: string;
  patientId?: string;
}
```

Le `SessionProvider` :
- Charge la session au demarrage depuis AsyncStorage
- Verifie la validite du token via `/api/auth/profile`
- Expose `useSession()` avec : session, loading, setSession, signOut, refresh

---

## 9. Intelligence artificielle

### 9.1 Chat IA (La Bulle)

- **Modele** : Google Gemini (via `@google/genai`)
- **Contexte** : Les 12 derniers messages sont envoyes comme contexte
- **Personnalite** : L'IA est configuree comme un assistant empathique et bienveillant
- **Fallback** : Si l'API IA est indisponible, des reponses pre-ecrites sont utilisees localement

### 9.2 OCR

- **Usage** : Le therapeute peut prendre en photo des notes manuscrites
- **Modele** : Gemini multimodal (texte + image)
- **Acces** : Protege par `authenticate` + `requireTherapist`

### 9.3 Syntheses automatiques

- Generees cote client via `simpleAutoSummary()` dans `lib/chat.ts`
- Extraction de mots-cles et resume court des echanges
- Stockees dans la session de chat pour affichage dans les constats

---

## 10. Design System et UI

### Principes

1. **Coherence** : Design tokens partages, pas de valeurs magiques
2. **Responsive** : Desktop (sidebar + contenu) / Mobile (tabs + scroll)
3. **Accessibilite** : Contrastes suffisants, `accessibilityRole`, zones de tap 40x40 minimum
4. **Modernite** : Glassmorphism subtil, ombres fines, coins arrondis, animations spring

### Palette de couleurs

| Token | Couleur | Usage |
|-------|---------|-------|
| `primary` | `#6366F1` (Indigo) | Actions principales, accent |
| `primaryLight` | `#EEF2FF` | Fond subtil, boutons soft |
| `success` | `#10B981` | Bonne humeur, confirmation |
| `warning` | `#F59E0B` | Humeur moyenne, attention |
| `error` | `#EF4444` | Urgence, deconnexion |
| `ai` | `#8B5CF6` (Violet) | Elements IA |
| `bg` | `#FFFFFF` | Fond principal |
| `bgDesktop` | `#F1F5F9` | Fond desktop gris clair |

### Composants visuels cles

- **Bulle IA** : Design organique avec cercles decoratifs, animation pulse, glow
- **Cards** : Ombres fines, bordures 1px, coins arrondis 16-24px
- **Sidebar desktop** : Logo + navigation + deconnexion, 260-280px de large
- **Tabs mobile** : Barre en bas, icones Ionicons, badge de notification
- **Chat** : Bulles colorees par auteur (patient bleu, IA gris, therapeute vert)

---

## 11. API Reference

### Authentification

| Methode | Endpoint | Body | Reponse |
|---------|----------|------|---------|
| POST | `/api/auth/register` | `{username, email, password, role}` | `{user, token}` |
| POST | `/api/auth/login` | `{email, password}` | `{user, token}` |
| POST | `/api/auth/verify` | `{token}` ou `{email}` | `{user, token}` |
| GET | `/api/auth/profile` | — (JWT) | `{user}` |

### Utilisateurs

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users` | Tous les utilisateurs |
| GET | `/api/users/:id` | Utilisateur par ID (avec patients si therapeute) |
| PUT | `/api/users/:id` | Modifier un utilisateur |
| DELETE | `/api/users/:id` | Supprimer un utilisateur |

### Patients (therapeute)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users/:id/patients` | Patients du therapeute |
| POST | `/api/users/:id/patients` | Lier un patient existant |
| POST | `/api/users/:id/patients/create` | Creer et lier un patient |
| DELETE | `/api/users/:id/patients/:patientId` | Delier un patient |
| GET | `/api/users/:id/token` | Generer un magic token (QR code) |

### Conversations

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users/:id/conversations` | Lister les conversations |
| POST | `/api/users/:id/conversations` | Creer une conversation |
| GET | `/api/users/:id/conversations/:convId/messages` | Messages d'une conversation |
| POST | `/api/users/:id/conversations/:convId/messages` | Ajouter un message |

### Constats (Reports)

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users/:id/reports` | Lister les constats |
| POST | `/api/users/:id/reports` | Creer un constat |
| DELETE | `/api/users/:id/reports/:reportId` | Supprimer un constat |

### Journal

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users/:id/journal` | Lister les entrees |
| POST | `/api/users/:id/journal` | Ajouter une entree |
| DELETE | `/api/users/:id/journal/:entryId` | Supprimer une entree |

### IA

| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/ai/reply` | Reponse IA a un contexte de chat |
| POST | `/api/ai/ocr` | OCR sur une image (therapeute uniquement) |

### Autres

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/users/:id/crisis-eval` | Evaluations de crise |
| POST | `/api/users/:id/crisis-eval` | Ajouter une evaluation |
| GET | `/api/users/:id/actions` | Actions recommandees |
| PUT | `/api/users/:id/actions` | Definir les actions |
| POST | `/api/users/:id/consent` | Consentement donnees |

---

## 12. Installation et deploiement

### Prerequisites

- Node.js >= 18
- MongoDB (local ou Atlas)
- Expo CLI (`npx expo`)

### Backend

```bash
cd mindia-backend
npm install

# Configuration (.env)
PORT=3000
MONGODB_URI=mongodb://localhost:27017/mindia
JWT_SECRET=votre_secret_jwt
GEMINI_API_KEY=votre_cle_gemini

# Lancement
node index.js
```

### Frontend

```bash
cd mindia
npm install

# Configuration (.env)
EXPO_PUBLIC_API_URL=http://localhost:3000/api

# Lancement
npx expo start          # Dev (web + QR pour mobile)
npx expo start --web    # Web uniquement
npx expo start --android # Android
npx expo start --ios     # iOS
```

### Build production

```bash
# Web
npx expo export --platform web

# Mobile (EAS Build)
eas build --platform android
eas build --platform ios
```

---

## 13. Roadmap

### Realise (MVP)

- [x] Authentification patient (QR code, magic link email)
- [x] Authentification therapeute (email/mot de passe)
- [x] Chat IA bienveillant (multi-conversations)
- [x] Journal patient (entrees + humeur)
- [x] Constats therapeute + syntheses IA
- [x] Suivi d'humeur en temps reel
- [x] Prise de RDV Calendly
- [x] Dashboard therapeute (liste patients, stats urgence)
- [x] Detail patient (apercu, constats, discussion)
- [x] QR code generation pour chaque patient
- [x] UI responsive desktop et mobile
- [x] Design system avec tokens

### A venir

- [ ] Notifications push (patient en crise, nouveau message)
- [ ] Chiffrement de bout en bout des messages
- [ ] Export PDF des constats et du journal
- [ ] Analyse de sentiment avancee (NLP)
- [ ] Mode sombre
- [ ] Exercices guides (respiration, meditation) avec timer
- [ ] Tableau de bord analytique therapeute (graphiques d'evolution)
- [ ] Multi-langue (EN, ES)
- [ ] Tests automatises (Jest + Detox)
- [ ] CI/CD (GitHub Actions + EAS)
- [ ] Conformite RGPD complete avec DPO
- [ ] Certification HDS (Hebergement de Donnees de Sante)

---

*Document genere le 10 fevrier 2026 — MindIA v0.1 (MVP)*
