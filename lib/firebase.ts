import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getVertexAI, getGenerativeModel } from 'firebase/vertexai-preview';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;

// Initialize Firebase
if (!getApps().length) {
  app = initializeApp(firebaseConfig);

  // Initialize App Check with reCAPTCHA v3
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  }
} else {
  app = getApps()[0];
}

// Initialize Vertex AI
export const vertexAI = getVertexAI(app);

// Get generative model (Gemini)
export const getAIModel = (modelName: string = 'gemini-2.0-flash-001') => {
  return getGenerativeModel(vertexAI, { model: modelName });
};

export { app };
