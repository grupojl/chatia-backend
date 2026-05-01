// src/config/validation.schema.ts
import * as Joi from 'joi';

export const validationSchema = Joi.object({
  // ── Servidor ───────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  // ── Base de datos ──────────────────────────────────────────────────────────
  DATABASE_URL: Joi.string().required(),

  // ── Redis ──────────────────────────────────────────────────────────────────
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  // ── Groq ───────────────────────────────────────────────────────────────────
  GROQ_API_KEY: Joi.string().required(),

  // ── Ecosistema SaaS ────────────────────────────────────────────────────────
  DASHBOARD_URL: Joi.string().uri().required(),

  // ── Firebase (compartido con owner-dashboard) ──────────────────────────────
  // Opcionales: si no están, el sistema arranca en modo dev sin auth real
  FIREBASE_PROJECT_ID: Joi.string().optional().allow(''),
  FIREBASE_CLIENT_EMAIL: Joi.string().optional().allow(''),
  FIREBASE_PRIVATE_KEY: Joi.string().optional().allow(''),

  // ── Webhooks de canales ────────────────────────────────────────────────────
  META_APP_SECRET: Joi.string().optional().allow(''),

  // ── CORS ───────────────────────────────────────────────────────────────────
  ALLOWED_ORIGINS: Joi.string().optional().allow(''),
}).options({ allowUnknown: true });
