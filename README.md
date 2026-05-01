# Chat IA Lang

API multi-tenant de mensajería con IA — AssistantModule + FaqModule + Widget embeddable.


## Integración con owner-dashboard

Este sistema es un **sistema hoja** del ecosistema SaaS multi-tenant.
El [owner-dashboard](http://localhost:3001) maneja toda la auth, orgs y permisos.

### Cómo funciona el SSO

```
1. El usuario hace login con Firebase en el owner-dashboard
2. El frontend llama POST /api/v1/auth/me al owner-dashboard
3. Cada request a este sistema lleva:
   - Authorization: Bearer {firebaseToken}
   - x-organization-id: {organizationId}
4. El TenantGuard valida el token + llama al dashboard para verificar membership
5. Se verifica productPermissions["chat"].canRead antes de operar
6. canWrite se verifica en endpoints de mutación via WritePermissionGuard
```

### Variables de entorno del ecosistema

| Variable | Descripción |
|----------|-------------|
| `DASHBOARD_URL` | URL del owner-dashboard (ej: https://dashboard.tudominio.com) |
| `FIREBASE_PROJECT_ID` | Mismo proyecto Firebase que el owner-dashboard |
| `FIREBASE_CLIENT_EMAIL` | Service account del proyecto Firebase |
| `FIREBASE_PRIVATE_KEY` | Private key del service account |

### Primer arranque

1. Crear la organización en el owner-dashboard
2. Habilitar el producto "chat" en la org
3. Hacer login con Firebase en el frontend
4. El TenantGuard creará automáticamente la org localmente en el primer request

### Modo desarrollo sin dashboard

Si `DASHBOARD_URL` no está configurado o Firebase no está inicializado:
- Pasar `x-organization-id: {cualquier-id}` en el header
- El sistema arranca en modo dev con permisos de admin completos
- Solo funciona con `NODE_ENV=development`

## Stack

- **NestJS 11** · TypeScript · pnpm
- **Prisma 7** · PostgreSQL 16 (+ pgvector opcional)
- **BullMQ** · Redis 7
- **Groq** (LLM) · LangGraph (flujos)
- **Socket.io** (WebSockets)
- **Firebase Admin** (auth)

## Quickstart local

```bash
# 1. Clonar y dependencias
git clone <repo>
cd chat-ia-lang
pnpm install

# 2. Variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 3. Base de datos y Redis (Docker)
docker-compose up -d postgres redis

# 4. Migraciones
pnpm prisma migrate dev
pnpm prisma generate

# 5. Levantar en modo watch
pnpm start:dev
```

Swagger disponible en: `http://localhost:3000/api/v1/docs`

## Quickstart con Docker completo

```bash
cp .env.example .env   # completar GROQ_API_KEY al menos
docker-compose up
```

## Arquitectura de módulos

```
AppModule
├── ProjectsModule       → CRUD de proyectos (multi-tenant)
├── AssistantModule      → Chat configurable por proyecto
│   ├── AssistantConfigService
│   ├── AssistantSessionService
│   └── AssistantChatService  ←→  FaqModule (RAG fallback)
├── FaqModule            → Base de conocimiento + RAG
│   ├── KnowledgeBaseService
│   ├── KbDocumentService
│   ├── FaqIngestionService  (BullMQ)
│   ├── FaqQueryService      (pgvector / cosine similarity)
│   └── RagService
├── WidgetModule         → Endpoints públicos + snippet.js embeddable
├── AgentsModule         → Registro y perfil de agentes
├── FirebaseModule       → Auth (global)
├── ChannelsModule       → WhatsApp · Instagram · Messenger · TikTok
├── ConversationsModule  → Historial + LangGraph
└── [resto del sistema existente...]
```

## Endpoints principales

### Projects
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/projects` | Crear proyecto |
| GET | `/api/v1/projects` | Listar proyectos |
| GET | `/api/v1/projects/:slug` | Detalle |
| PUT | `/api/v1/projects/:slug` | Actualizar |
| DELETE | `/api/v1/projects/:slug` | Eliminar |

### Assistant
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/projects/:slug/assistant/chat` | Enviar mensaje |
| GET | `/api/v1/projects/:slug/assistant/config` | Ver config |
| PUT | `/api/v1/projects/:slug/assistant/config` | Actualizar config |
| PATCH | `/api/v1/projects/:slug/assistant/config/toggle` | Habilitar/deshabilitar |
| GET | `/api/v1/projects/:slug/assistant/session/:userId` | Ver sesión |
| DELETE | `/api/v1/projects/:slug/assistant/session/:userId` | Eliminar sesión |

### FAQ
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/projects/:slug/faq/knowledge-bases` | Crear KB |
| GET | `/api/v1/projects/:slug/faq/knowledge-bases` | Listar KBs |
| POST | `/api/v1/projects/:slug/faq/knowledge-bases/:kbId/documents` | Crear documento |
| POST | `/api/v1/projects/:slug/faq/knowledge-bases/:kbId/documents/upload` | Upload PDF |
| POST | `/api/v1/projects/:slug/faq/knowledge-bases/:kbId/documents/:docId/reindex` | Re-indexar |
| POST | `/api/v1/projects/:slug/faq/query` | Búsqueda semántica / RAG |

### Widget (público, sin auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/widget/:slug/config` | Config pública |
| POST | `/api/v1/widget/:slug/chat` | Enviar mensaje |
| GET | `/api/v1/widget/:slug/snippet.js` | Script embeddable |

### Agents
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/agents/register` | Registro (sin auth) |
| GET | `/api/v1/agents/me` | Perfil propio |
| GET | `/api/v1/agents` | Listar (admin) |

## Variables de entorno

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `GROQ_API_KEY` | ✅ | API key de Groq |
| `REDIS_URL` | ✅ | Redis connection string |
| `META_APP_SECRET` | ⚠️ | Para webhooks de WhatsApp/IG |
| `FIREBASE_PROJECT_ID` | ⚠️ | Auth real (vacío = modo dev) |
| `FIREBASE_CLIENT_EMAIL` | ⚠️ | Auth real |
| `FIREBASE_PRIVATE_KEY` | ⚠️ | Auth real |
| `APP_URL` | ⚠️ | URL pública (para snippet.js) |

## Auth

- **Desarrollo**: header `x-organization-id: <id>` — sin token
- **Producción**: `Authorization: Bearer <firebase-idToken>`

Registrar agente en primer login:
```bash
POST /api/v1/agents/register
{ "firebaseUid": "...", "name": "...", "email": "..." }
```

## Embeber widget en cualquier web

```html
<script src="https://tu-api.com/api/v1/widget/TU-SLUG/snippet.js"></script>
```
