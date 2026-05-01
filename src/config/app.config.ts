// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
}));

export const dbConfig = registerAs('db', () => ({
  url: process.env.DATABASE_URL,
}));

export const groqConfig = registerAs('groq', () => ({
  apiKey: process.env.GROQ_API_KEY,
}));

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
}));

export const metaConfig = registerAs('meta', () => ({
  appSecret: process.env.META_APP_SECRET,
}));

export const firebaseConfig = registerAs('firebase', () => ({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}));
