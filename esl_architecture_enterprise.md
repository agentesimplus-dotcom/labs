# ESL Platform – Arquitectura Enterprise Multi-Tenant
Fecha: 2026-02-20

---

## 1. Principios arquitectónicos

1. **Separación estricta API vs Worker** (no mezclar HTTP con render/cola/MQTT)
2. **Procesamiento asíncrono basado en colas** (bulk updates sin tumbar el API)
3. **Idempotencia y trazabilidad total** (outbox + acks + retries)
4. **Multi-tenant desde el modelo de datos** (tenant_id/store_id en todo)
5. **Offline-first para Gateways** (reintentos y recuperación por estado)
6. **Cache inteligente por hash de diseño** (render 1 vez, reutiliza N)
7. **Observabilidad desde el día 1** (logs/métricas/health)

---

## 2. Stack tecnológico

### Backend API
- **Node.js + Fastify** (preferible por rendimiento)
- **Prisma ORM** (migraciones + tipado)
- **Auth**: JWT (Dashboard)
- **Integraciones**: API Keys con scopes y rotación
- **Rate limiting** por tenant

### Worker
- **Node.js** (proceso separado)
- **BullMQ + Redis** (jobs de render y publish)
- Concurrencia controlada (para node-canvas)

### Base de datos
- **MySQL 8.0+**
- Índices compuestos orientados a multi-store y colas/outbox

### Mensajería
- **MQTT (mqtt.js)**
- Broker: **Mosquitto / EMQX**

### Procesamiento de imagen
- **node-canvas**
- Dithering configurable
- Bit-packing determinista (según Jingles v2)

### Frontend
- **React + Tailwind**
- **Fabric.js** (editor)
- Validación estricta de resolución/paleta/safe areas

### Infra (dev/prod)
- **Docker Compose** (dev)
- Componentes: `api`, `worker`, `mysql`, `redis`, `mqtt-broker`

---

## 3. Arquitectura general

**Flujo principal**

Frontend → API (Fastify) → Job Queue (Redis/BullMQ) → Worker → Outbox (MySQL) → MQTT → Gateway → Tag

**Objetivo**
- El API no debe bloquearse por render ni por MQTT.
- El worker escala horizontalmente.

---

## 4. Modelo multi-tenant

**Regla:** toda entidad crítica incluye `tenant_id` y la mayoría incluye `store_id`.

Jerarquía:

- Tenant
  - Stores
    - Gateways
    - Tags
    - Products
    - Commands
    - (Opcional) Templates/Designs

**Aislamiento:** ninguna consulta debe depender solo de un `id` sin filtrar por `tenant_id` (y `store_id` cuando aplique).

---

## 5. Modelo de datos (MySQL)

> Nota: PK/UK/Índices son parte del diseño, no opcional.

### 5.1 Tenants
- `id`
- `name`
- `status`
- `created_at`

### 5.2 Stores
- `id`
- `tenant_id` (INDEX)
- `name`
- `timezone`
- `status`

### 5.3 TagModels
- `id`
- `name`
- `width`
- `height`
- `supports_red` (boolean)
- `bit_packing_version`

### 5.4 Gateways
- `mac_address` (PK)
- `tenant_id`
- `store_id`
- `last_seq` BIGINT
- `status` (ONLINE/OFFLINE/UNKNOWN)
- `last_seen_at`
- `firmware_version`

Índices sugeridos:
- `INDEX(store_id)`
- `INDEX(status)`

### 5.5 Tags
- `mac_address` (PK)
- `tenant_id`
- `store_id`
- `model_id`
- `product_id` (nullable)
- `last_seq` BIGINT
- `last_update_at`
- `last_seen_at`
- `status`

Índices sugeridos:
- `INDEX(store_id, product_id)`
- `INDEX(store_id, status)`

### 5.6 ESL_Commands (Outbox Pattern)
- `id` (UUID)
- `tenant_id`
- `store_id`
- `gateway_mac`
- `tag_mac`
- `seq` BIGINT
- `payload_hash` (SHA-256)
- `status` (PENDING/SENT/ACK/FAILED)
- `attempts` INT
- `next_retry_at` DATETIME
- `last_error` TEXT
- `created_at` DATETIME
- `ack_at` DATETIME (nullable)

Índices sugeridos:
- `INDEX(status, next_retry_at)`
- `INDEX(gateway_mac, status)`
- `INDEX(tag_mac, status)`

### 5.7 ESL_RenderCache (Cache por hash)
- `design_hash` (PK)
- `model_id`
- `hex_black` LONGTEXT
- `hex_red` LONGTEXT (nullable)
- `width`
- `height`
- `created_at`

---

## 6. Control atómico de secuencias (CRÍTICO)

**Nunca** generar `seq` en memoria.

Ejemplo de incremento atómico:

- `UPDATE gateways SET last_seq = last_seq + 1 WHERE mac_address = ?;`
- luego recuperar `last_seq` (en transacción).

> Si el protocolo exige seq por tag, replicar `last_seq` en Tags y aplicar atomicidad equivalente.

---

## 7. Flujo de render escalable

### 7.1 Endpoint
- `POST /tags/bulk-update`

No renderiza inmediatamente.

Crea jobs en cola:
- `{ tenant_id, store_id, tag_mac, design_hash }`

### 7.2 Worker (Render + Publish)
1. Normaliza **DTO estable** del diseño (evitar depender del JSON crudo de Fabric)
2. Calcula `design_hash`
3. Verifica `ESL_RenderCache`
   - Si existe: reutiliza `hex_black/hex_red`
   - Si no existe: renderiza y almacena cache
4. Genera canales:
   - Canal negro (negro vs resto)
   - Canal rojo (rojo vs resto; si aplica)
5. Empaqueta bits según Jingles v2
6. Inserta comando en `ESL_Commands` (PENDING)
7. Publica por MQTT
8. Marca estado `SENT`
9. Espera/recibe ACK → `ACK` o programa reintento

---

## 8. Validación estricta (Frontend + Backend)

### Frontend (Guardia de calidad)
- Restricción de resolución por TagModel (ej. 400x300 para 4.2")
- Paletas permitidas:
  - **BWR**: #FFFFFF, #000000, #FF0000
  - **BW**: #FFFFFF, #000000
- Safe areas (márgenes 2–3 px)
- Preview E-ink (dithering/contraste)
- Snap-to-pixel y bloqueo de elementos fuera de bounds
- Restricción de fuentes (whitelist) y tamaños mínimos

### Backend (obligatorio)
- Revalida todo lo anterior
- Rechaza payloads inválidos aunque el frontend “diga” que están bien

---

## 9. Idempotencia, acks y resiliencia

Cada comando debe ser:
- Identificado por `command_id` (UUID)
- Deducible por `payload_hash`

Estados:
- `PENDING` → `SENT` → `ACK`
- `FAILED` con reintentos controlados por `next_retry_at`

Reintentos:
- Backoff exponencial
- Límite de intentos configurable
- Reprocesamiento seguro tras reinicio (por Outbox)

---

## 10. Seguridad

- JWT para dashboard
- API Keys para integraciones:
  - scopes (ej. `products:read`, `tags:update`)
  - expiración y rotación
- Rate limiting por tenant
- Auditoría: quién cambió qué, cuándo, desde qué store

---

## 11. Observabilidad (operación real)

- Logs estructurados (pino) con:
  - `tenant_id`, `store_id`, `gateway_mac`, `tag_mac`, `command_id`
- Métricas:
  - jobs pendientes
  - latencia de render
  - tasa de ACK
  - retries
  - gateways offline
- Endpoints:
  - `/health`
  - `/metrics`

---

## 12. Requisitos de escalabilidad

El sistema debe soportar (desde software, no “a fuerza de hardware”):
- 60 tiendas por tenant
- 10,000 etiquetas (orden de magnitud)
- Actualizaciones masivas (bulk)
- Gateways intermitentes (offline/online)
- Escalado horizontal del worker

---

## 13. Instrucción para Agent Manager (control del repo)

Pega esto en el Agent Manager:

**Prompt**

Toma control del repositorio actual y genera la estructura completa definida en este documento.

1) Crea un monorepo con:
- `apps/api`
- `apps/worker`
- `apps/web`
- `packages/shared`

2) Configura:
- Fastify en `apps/api`
- Prisma + migraciones MySQL
- BullMQ + Redis
- Cliente MQTT + manejadores
- node-canvas para render
- pino logger
- ESLint + Prettier
- Swagger/OpenAPI

3) Implementa:
- Outbox pattern (`ESL_Commands`)
- Control atómico de secuencias (`last_seq`)
- Cache por `design_hash` (`ESL_RenderCache`)
- DTO estable para diseños (no depender del JSON crudo de Fabric)
- Validación backend estricta
- Retries con backoff
- Docker Compose (mysql + redis + mqtt + api + worker)

4) Endpoints mínimos:
- `POST /tags/bulk-update`
- `GET /gateways/:mac/status`
- `GET /tags/:mac/status`
- `POST /render/preview`

5) Tests unitarios:
- `pack_to_hex()` con golden tests (bit order/padding/endian)
- validadores del DTO

Objetivo: dejar el proyecto listo para escalar horizontalmente el worker y soportar 60 tiendas y 10,000 etiquetas con actualizaciones masivas y gateways intermitentes.

---

## 14. Instrucción sugerida para ejecutar el Agent Manager

Una vez creado el repositorio vacío, pega la sección **13** (Prompt) en el Agent Manager y ejecútalo.

