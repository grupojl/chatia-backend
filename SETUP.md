# WhatsApp AI Module — Guía de integración

## Stack
- **NestJS** + TypeScript
- **Prisma** + PostgreSQL (comparte la misma DB del proyecto existente)
- **Groq** — inferencia LLM (llama-3.3-70b-versatile)
- **Meta WhatsApp Business API** — envío/recepción de mensajes
- **LangGraph** — motor de estado del agente (implementado en el módulo `langgraph`)

---

## 1. Instalar dependencias nuevas

```bash
pnpm add @nestjs/axios axios
```

---

## 2. Aplicar la migración de base de datos

Copiá el contenido de `prisma/migrations/whatsapp_ai_module.sql` y ejecutalo en tu base de datos, o usá Prisma migrate:

```bash
# Opción A: migración manual (recomendado si ya tenés migraciones existentes)
psql $DATABASE_URL -f prisma/migrations/whatsapp_ai_module.sql

# Opción B: agregar los modelos al schema.prisma y correr migrate
# 1. Abrí prisma/schema.prisma y pegá todos los modelos del archivo prisma/schema.prisma de este módulo
# 2. Luego:
npx prisma migrate dev --name whatsapp_ai_module
npx prisma generate
```

---

## 3. Agregar variables de entorno

Añadí al `.env` del proyecto:

```env
GROQ_API_KEY="gsk_xxxxxxxxxxxxxxxxxxxxxxxx"
META_APP_SECRET="tu_meta_app_secret"
APP_URL="https://tu-dominio.com"
```

---

## 4. Copiar archivos al proyecto

Estructura de archivos a copiar:

```
src/
├── meta/
│   ├── meta.module.ts
│   ├── meta.service.ts
│   ├── whatsapp-accounts.controller.ts
│   ├── whatsapp-accounts.service.ts
│   └── whatsapp-accounts.module.ts
├── groq/
│   ├── groq.module.ts
│   └── groq.service.ts
├── langgraph/
│   ├── langgraph.types.ts
│   ├── langgraph.engine.ts
│   ├── langgraph.module.ts
│   └── nodes/
│       └── index.ts
├── conversations/
│   ├── conversations.service.ts
│   ├── conversations.controller.ts
│   └── conversations.module.ts
├── webhooks/
│   ├── webhooks.controller.ts
│   ├── webhooks.service.ts
│   └── webhooks.module.ts
├── contacts/
│   ├── contacts.service.ts
│   ├── contacts.controller.ts
│   └── contacts.module.ts
├── messages/
│   ├── messages.service.ts
│   ├── messages.controller.ts
│   └── messages.module.ts
├── ai-config/
│   ├── ai-config.service.ts
│   ├── ai-config.controller.ts
│   └── ai-config.module.ts
├── app.module.ts      ← reemplazar
└── main.ts            ← reemplazar
```

---

## 5. Reemplazar app.module.ts y main.ts

Los archivos `src/app.module.ts` y `src/main.ts` de este módulo **reemplazan** los existentes. Tienen todos los imports correctos.

---

## 6. Configurar una cuenta de WhatsApp Business en Meta

1. Ir a [Meta for Developers](https://developers.facebook.com/apps)
2. Crear una app de tipo "Business"
3. Agregar el producto "WhatsApp"
4. Obtener el `Phone Number ID`, `WABA ID` y generar un `Access Token` permanente

---

## 7. Crear la cuenta en el backend

```bash
# POST /api/v1/whatsapp-accounts
# Headers: Authorization: Bearer <firebase_token>
#          x-organization-id: <org_id>
{
  "name": "Mi negocio",
  "phoneNumberId": "1234567890",
  "wabaId": "0987654321",
  "accessToken": "EAAxxxxx..."
}

# La respuesta incluye:
# - webhookUrl: la URL que vas a configurar en Meta
# - webhookVerifyToken: el token de verificación
```

---

## 8. Configurar el webhook en Meta

1. En el panel de Meta → WhatsApp → Configuración → Webhooks
2. URL del callback: `https://tu-dominio.com/api/v1/webhooks/meta/{phoneNumberId}`
3. Token de verificación: el `webhookVerifyToken` que devolvió el paso anterior
4. Suscribirse a: `messages`

---

## 9. Configurar la IA

```bash
# PUT /api/v1/whatsapp-accounts/:accountId/ai-config
{
  "systemPrompt": "Sos un asistente virtual de una inmobiliaria...",
  "personaName": "Sofia",
  "groqModel": "llama-3.3-70b-versatile",
  "temperature": 0.7,
  "maxTokens": 1024,
  "contextWindowSize": 10,
  "humanTakeoverKeywords": ["hablar con alguien", "quiero un asesor", "precio final"],
  "welcomeMessage": "¡Hola! Soy Sofia, ¿en qué te puedo ayudar hoy? 😊"
}
```

---

## Endpoints disponibles

### WhatsApp Accounts
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/whatsapp-accounts` | Crear cuenta WA |
| GET | `/whatsapp-accounts` | Listar cuentas |
| GET | `/whatsapp-accounts/:id` | Ver detalle |
| PATCH | `/whatsapp-accounts/:id` | Actualizar |
| POST | `/whatsapp-accounts/:id/rotate-token` | Rotar verify token |

### AI Config
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/whatsapp-accounts/:id/ai-config` | Ver config |
| PUT | `/whatsapp-accounts/:id/ai-config` | Actualizar config |
| PATCH | `/whatsapp-accounts/:id/ai-config/toggle` | Habilitar/deshabilitar IA |

### Conversaciones
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/conversations` | Listar (filtros: status, accountId, page) |
| GET | `/conversations/:id` | Detalle con mensajes |
| POST | `/conversations/:id/messages` | Enviar mensaje manual |
| PATCH | `/conversations/:id/takeover` | Agente toma control |
| PATCH | `/conversations/:id/release` | Devolver al bot |
| PATCH | `/conversations/:id/resolve` | Marcar como resuelta |

### Mensajes
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/conversations/:id/messages` | Historial paginado |
| GET | `/messages/stats` | Estadísticas globales |

### Contactos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/contacts` | Listar (filtros: status, search) |
| GET | `/contacts/stats` | Estadísticas |
| GET | `/contacts/:id` | Detalle |
| PATCH | `/contacts/:id` | Actualizar |

### Webhooks (públicos, llamados por Meta)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/webhooks/meta/:phoneNumberId` | Verificación Meta |
| POST | `/webhooks/meta/:phoneNumberId` | Recibir eventos |

---

## Flujo del agente LangGraph

```
Mensaje entrante de WhatsApp
         │
    [classify]         → detecta intent + entidades con Groq 8B (rápido)
         │
 [retrieve_context]    → actualiza el stage de la conversación
         │
    [generate]         → genera respuesta con Groq 70B
         │
    [validate]         → filtra respuestas comprometidas
         │
   ¿shouldEscalate?
    /           \
[human_takeover] [respond]
         │           │
      notifica    actualiza
      al equipo   historial
```

### Stages del ciclo de vida
- `INITIAL` → primer contacto
- `QUALIFYING` → recopilando necesidades
- `INFORMED` → usuario recibió info de una propiedad
- `NEGOTIATING` → discutiendo condiciones
- `CLOSING` → coordinando visita
- `FOLLOW_UP` → post-contacto

---

## Modelos Groq disponibles

```typescript
import { GROQ_MODELS } from './groq/groq.service';

GROQ_MODELS.LLAMA_70B          // 'llama-3.3-70b-versatile'  — mejor calidad
GROQ_MODELS.LLAMA_8B           // 'llama-3.1-8b-instant'     — más rápido, para clasificación
GROQ_MODELS.MIXTRAL            // 'mixtral-8x7b-32768'        — contexto largo
```

---

## Notas de seguridad

- El `accessToken` de Meta se guarda en texto plano en la DB. Para producción, considerá encriptarlo con `crypto` antes de guardar (AES-256).
- La firma HMAC del webhook de Meta se verifica automáticamente si `META_APP_SECRET` está configurado.
- Los tokens de verificación del webhook se rotan con `POST /whatsapp-accounts/:id/rotate-token`.