# Backend steps that follow from adding google-services.json (Firebase / FCM)

You added `google-services.json` to the project root. That enables Firebase initialization in the Android native binary and is the prerequisite for sending remote pushes via Firebase Cloud Messaging (FCM). This document lists exactly what your backend must do (and how to test it) to send production pushes to Android devices that register FCM tokens.

Assumptions:
- `google-services.json` is present at the project root and `app.config.js` has `android.googleServicesFile` set.
- Your Android build is created via EAS so the native binary includes the FCM config.

This file does NOT list alternative providers; it is focused solely on the Firebase (FCM) flow.

---

## 1) Create a Firebase service account (server credentials)

1. Open the Firebase console for your project -> Settings -> Service accounts.
2. Click "Generate new private key" for the Admin SDK; this downloads a JSON file (call it `service-account.json`).
3. Store `service-account.json` securely (do NOT commit it). Use your cloud provider secrets, CI secrets, or a secure file store.

---

## 2) Backend dependencies

Install the Firebase Admin SDK on your server:

```
npm install firebase-admin
```

---

## 3) Minimal backend flow (register token + send push)

1. App registers token with your backend (see sample endpoint below).
2. Backend stores token(s) for the driver in a table/collection.
3. When you need to notify a driver, backend looks up their token(s) and calls FCM via Firebase Admin SDK.
4. Backend handles delivery errors and removes invalid tokens.

---

## 4) Suggested DB schema (example)

- Collection/table `device_tokens`:
  - id
  - driver_id (string)
  - token (string) — FCM device token
  - platform (string) — e.g. "android"
  - created_at, updated_at

Keep duplicates unique on (driver_id, token).

---

## 5) Example server code (Node.js) — register + send via firebase-admin

Create `server/push-server.js` (example):

```js
// server/push-server.js
const express = require('express');
const bodyParser = require('body-parser');
const admin = require('firebase-admin');
// Initialize with the downloaded service account JSON file
const serviceAccount = require('../path/to/service-account.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const app = express();
app.use(bodyParser.json());

// Example in-memory store; replace with your DB upsert logic
const deviceTokens = new Map(); // driverId -> Set of tokens

// Register token endpoint
app.post('/driver/register-push-token', async (req, res) => {
  const { driverId, token, platform } = req.body;
  if (!driverId || !token) return res.status(400).json({ error: 'driverId and token required' });

  const set = deviceTokens.get(driverId) || new Set();
  set.add(token);
  deviceTokens.set(driverId, set);
  // Persist in DB in production

  return res.json({ ok: true });
});

// Internal endpoint to send a push to a driver
app.post('/internal/send/push', async (req, res) => {
  const { driverId, title, body, data } = req.body;
  const tokens = Array.from(deviceTokens.get(driverId) || []);
  if (tokens.length === 0) return res.status(404).json({ error: 'no tokens' });

  // Build message payload for multiple tokens
  const message = {
    tokens,
    android: { priority: 'high', notification: { title, body } },
    data: data || {},
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    // Response contains successes and failures — remove invalid tokens
    const failedTokens = [];
    response.responses.forEach((r, idx) => {
      if (!r.success) {
        const err = r.error;
        // Typical error codes: 'messaging/registration-token-not-registered', 'messaging/invalid-registration-token'
        if (err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')) {
          failedTokens.push(tokens[idx]);
        }
      }
    });

    // Remove failed tokens from your DB
    if (failedTokens.length > 0) {
      const set = deviceTokens.get(driverId) || new Set();
      failedTokens.forEach(t => set.delete(t));
      deviceTokens.set(driverId, set);
      // Persist deletion in DB
    }

    return res.json({ successCount: response.successCount, failureCount: response.failureCount });
  } catch (err) {
    console.error('FCM send error', err);
    return res.status(500).json({ error: 'send_failed' });
  }
});

app.listen(3001, () => console.log('Push server running on 3001'));
```

Replace the in-memory store with real DB persistence and upsert behavior.

---

## 6) App-side: which token to register with this backend

Because you added `google-services.json` and will build with EAS, the Android native runtime will initialize Firebase. The Android client must obtain an FCM device token and POST that token to `/driver/register-push-token`.

Notes for app implementer:
- If you use the Firebase Android SDK to read the token directly, get it via `FirebaseMessaging.getInstance().getToken()` (native). In an Expo app, you can use a custom dev client or use libraries that expose the native FCM token to JS.
- If your app currently calls `Notifications.getExpoPushTokenAsync()` (Expo token), that token is for Expo's push service and is not a raw FCM token. To use direct FCM sends (above) you must register the raw FCM token from the native Firebase SDK.

If you prefer to keep using Expo push tokens, your backend must use Expo push API instead — that is outside the exact scope of this document (this doc assumes you will send directly to FCM because `google-services.json` is present).

---

## 7) Testing

1. Build an Android binary with EAS (development or production) so `google-services.json` is embedded:

```powershell
eas build -p android --profile development
```

2. Install on a physical Android device (or an emulator with Google Play services).
3. From the app, obtain the raw FCM token (native) and POST it to your `/driver/register-push-token` endpoint.
4. Use the `POST /internal/send/push` endpoint to send a message to the driver; confirm the device receives it.

Alternative quick test (Firebase console):
- Use Firebase Console -> Cloud Messaging -> Send your test message to a specific registration token (paste the token) to validate delivery without using your server.

---

## 8) Production considerations

- Security: ensure token registration endpoint is authenticated (only drivers may register tokens for their driverId).
- Clean-up: handle invalid token responses from FCM and remove them from DB.
- Rate limiting: avoid sending too many notifications to a single device.
- Token rotation: if token changes (Firebase may refresh tokens), the app must re-register.

---

If you want, I can add a minimal server file (the example above) to `server/` in your repo and wire a simple persistent store (SQLite) so you can test immediately. Confirm if you want that and I will commit it.
---

## 1) What you must provide to native builds

- Android: `google-services.json` from Firebase (placed at project root and referenced in `app.config.js`) so FCM initializes in the native binary.
- iOS: an APNs Auth Key (.p8) or certificate (or `GoogleService-Info.plist` if you use Firebase iOS integration). Upload APNs credentials to EAS when prompted or via `eas credentials`.

Without those native credentials `Notifications.getExpoPushTokenAsync()` will fail at runtime and you'll only get local notifications.

---

## 2) Minimal backend responsibilities

1. Provide an endpoint for the app to register the driver's push token and platform. Store `driverId` → `{ token, platform, updatedAt }` in a DB table/collection.
2. When an event happens (new ride, ride cancelled, arrival), look up the driver(s) push token(s) and send a push using your chosen provider.
3. Handle push provider responses; remove or mark invalid tokens.
4. Optionally: implement batching, rate limiting and retry/backoff.

### Suggested DB schema (example)

- Table `device_tokens` (or collection):
  - id (uuid)
  - driver_id (string)
  - token (string)
  - platform ("android" | "ios" | "expo")
  - client (optional, e.g. "expo-client", "prod-playstore")
  - created_at, updated_at

---

## 3) Endpoints (example)

- POST /driver/register-push-token
  - body: { driverId, token, platform }
  - upsert token in `device_tokens`

- POST /send/push (admin/internal)
  - body: { driverId, type, title, message, data }
  - server finds token(s) for driverId and calls push provider

---

## 4) Option A — Use Expo Push Service (recommended for Expo apps)

Pros: Simple server API, handles platform mapping for you. Works well with `Notifications.getExpoPushTokenAsync()`.

Install on backend:

```
npm install expo-server-sdk-node node-fetch
```

Example server code (Node.js / express):

```js
// server/expo-push.js
const express = require('express');
const { Expo } = require('expo-server-sdk');
const bodyParser = require('body-parser');

const expo = new Expo();
const app = express();
app.use(bodyParser.json());

// register token
app.post('/driver/register-push-token', async (req, res) => {
  const { driverId, token, platform } = req.body;
  // validate token starts with ExponentPushToken or store raw token if native
  // upsert into DB: device_tokens
  // return 200
  res.json({ ok: true });
});

// internal send endpoint
app.post('/send/push', async (req, res) => {
  const { driverId, title, message, data } = req.body;
  // fetch tokens from DB for driverId
  const tokens = [/* look up Expo push tokens from DB */];

  const messages = [];
  for (const pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      // optionally convert or skip
      continue;
    }

    messages.push({
      to: pushToken,
      sound: 'default',
      title,
      body: message,
      data: data || {},
      priority: 'high',
    });
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (err) {
      console.error('Expo push send error', err);
    }
  }

  // Optionally handle receipts async
  res.json({ ok: true, ticketsCount: tickets.length });
});

app.listen(3000);
```

Notes:
- Use `expo.sendPushNotificationsAsync` to send. Keep and process receipts for reliability (see expo-server-sdk docs).
- If you store native FCM or APNs tokens instead of Expo tokens, you'll either need to use the native provider directly or translate tokens into Expo tokens (not recommended).

---

## 5) Option B — Send directly via FCM (Android) and APNs (iOS)

Use this if you prefer not to use Expo push service.

### Android (FCM) — recommended: Firebase Admin SDK (HTTP v1)

Install:

```
npm install firebase-admin
```

Server example (send to FCM token):

```js
// server/fcm-send.js
const admin = require('firebase-admin');
// Initialize with service account JSON (secure in env/CI)
const serviceAccount = require('./service-account.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function sendToFcmToken(token, title, body, data = {}) {
  const message = {
    token,
    android: {
      priority: 'high',
      notification: { title, body },
    },
    data: Object.keys(data).reduce((acc, k) => ({ ...acc, [k]: String(data[k]) }), {}),
  };

  const resp = await admin.messaging().send(message);
  return resp;
}
```

### iOS (APNs)

Options:
- Use Firebase Admin to send to iOS devices via FCM (requires FCM for iOS configured), or
- Use `node-apn` to talk to APNs directly using an APNs Auth Key (.p8).

Example sending via APNs (node-apn):

```
npm install apn
```

```js
const apn = require('apn');
const provider = new apn.Provider({
  token: {
    key: process.env.APN_KEY_PATH, // path to .p8
    keyId: process.env.APN_KEY_ID,
    teamId: process.env.APN_TEAM_ID,
  },
  production: true,
});

async function sendApns(deviceToken, title, body, payload = {}) {
  const note = new apn.Notification();
  note.alert = { title, body };
  note.payload = payload;
  note.topic = 'com.instaaid.driver';
  note.sound = 'default';
  return provider.send(note, deviceToken);
}
```

Notes:
- When sending directly you must store tokens per platform and call the appropriate provider.
- Handle response errors: invalid/expired tokens should be removed from DB.

---

## 6) Payload suggestions (ride events)

- New ride request (ride_request):
  - title: "🚨 New Emergency Ride"
  - body: "New ride 2.3km away — urgent"
  - data: { type: 'ride_request', rideId: '...', pickup: {...}, drop: {...}, urgency: 'high' }

- Ride cancelled (ride_cancellation):
  - title: "Ride Cancelled"
  - body: "Ride 004b1e73 cancelled by patient"
  - data: { type: 'ride_cancellation', rideId:'...', cancelledBy: 'patient', reason: '...' }

Keep the payload small (APNs/FCM limits). Include the rideId so the app can fetch full details if needed.

---

## 7) Operational & security notes

- Rate limit pushes per device to avoid spamming. Batch notifications when possible.
- Use server-side authentication for registration endpoints (only authenticated drivers should register tokens for their driverId).
- Rotate service account / APNs keys carefully; update credentials via EAS when rebuilding.
- Monitor push failures and remove invalid tokens.

---

## 8) Troubleshooting

- If `Notifications.getExpoPushTokenAsync()` fails with Firebase initialization errors on Android, confirm `google-services.json` is bundled and you built a native binary (EAS) with it.
- If iOS tokens fail, test on a physical device and ensure APNs credentials were uploaded to EAS.
- Use the Expo push tool or Firebase Admin logs to check delivery.

---

