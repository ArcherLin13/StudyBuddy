export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBX6CId7-RATf0P6cz5-DDqFf6nQu0rmoo',
  authDomain: 'playbuddy-ca350.firebaseapp.com',
  projectId: 'playbuddy-ca350',
  storageBucket: 'playbuddy-ca350.firebasestorage.app',
  messagingSenderId: '21502999697',
  appId: '1:21502999697:web:9df885b4228f08cd94d330',
};

export function isFirebaseConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
}
