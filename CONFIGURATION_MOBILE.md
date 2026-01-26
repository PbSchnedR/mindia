# 📱 Configuration pour téléphone physique

## Problème
Sur un téléphone physique, `localhost` ne fonctionne pas car le téléphone ne peut pas accéder au `localhost` de votre machine de développement. Il faut utiliser l'**adresse IP locale** de votre machine.

## Solution

### 1. Trouver votre adresse IP locale

#### Sur Windows :
```powershell
ipconfig
```
Cherchez la ligne **IPv4 Address** sous votre connexion réseau (Wi-Fi ou Ethernet). Exemple : `192.168.1.100`

#### Sur Mac/Linux :
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```
ou
```bash
ip addr show | grep "inet " | grep -v 127.0.0.1
```

### 2. Configurer l'URL dans le fichier `.env`

Ouvrez le fichier `mindia/.env` et modifiez la ligne `EXPO_PUBLIC_API_URL` :

```env
# Remplacez 192.168.1.100 par VOTRE adresse IP locale
EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api
```

**Exemple :**
- Si votre IP est `192.168.1.100` → `EXPO_PUBLIC_API_URL=http://192.168.1.100:3000/api`
- Si votre IP est `10.0.0.50` → `EXPO_PUBLIC_API_URL=http://10.0.0.50:3000/api`

### 3. Vérifier que le backend accepte les connexions

Le backend a été configuré pour accepter automatiquement les connexions depuis toutes les IPs locales (192.168.x.x, 10.x.x.x, 172.16-31.x.x).

### 4. Redémarrer l'application Expo

Après avoir modifié le `.env`, vous devez redémarrer Expo :

```bash
# Arrêter l'application (Ctrl+C)
# Puis relancer
npm start
# ou
npx expo start
```

### 5. Vérifier la connexion

Dans les logs de l'application, vous devriez voir :
```
[API] URL de base configurée: http://192.168.1.100:3000/api
[API] Plateforme: ios
```
ou
```
[API] URL de base configurée: http://192.168.1.100:3000/api
[API] Plateforme: android
```

## ⚠️ Important

1. **Même réseau Wi-Fi** : Votre téléphone et votre ordinateur doivent être sur le **même réseau Wi-Fi**.

2. **Firewall** : Assurez-vous que le port 3000 n'est pas bloqué par votre firewall Windows/Mac.

3. **IP changeante** : Si votre IP change (redémarrage du routeur), vous devrez mettre à jour le `.env`.

4. **Pour la production** : Utilisez une URL de production (ex: `https://mindia-backend.onrender.com/api`) au lieu de l'IP locale.

## 🔍 Dépannage

### L'application ne se connecte pas au backend

1. Vérifiez que le backend tourne : `http://localhost:3000/api/health`
2. Vérifiez votre IP locale : `ipconfig` (Windows) ou `ifconfig` (Mac/Linux)
3. Vérifiez que l'IP dans `.env` correspond à votre IP actuelle
4. Vérifiez que le téléphone et l'ordinateur sont sur le même Wi-Fi
5. Testez depuis le navigateur du téléphone : `http://VOTRE_IP:3000/api/health`

### Le backend retourne une erreur CORS

Le backend a été configuré pour accepter automatiquement les IPs locales. Si vous avez toujours une erreur CORS, vérifiez les logs du serveur backend.
