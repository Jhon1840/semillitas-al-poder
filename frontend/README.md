# Frontend NEXO

Documentacion del frontend de NEXO. Esta guia resume el flujo actual, la arquitectura de pantallas, dependencias, variables de entorno y puntos de integracion con el backend.

## Resumen

El frontend esta construido con:

- Next.js 16
- React 19
- TypeScript
- lucide-react

El objetivo actual del frontend es validar un flujo inicial de producto:

1. Mostrar una landing publica que explique NEXO.
2. Permitir login o registro por separado.
3. Entrar a un area privada con sidebar.
4. Delimitar una zona en el mapa para usarla como parcela de riego.
5. Subir imagenes de semillas y enviarlas al backend.

## Rutas

### Publicas

- `/`
  Landing de presentacion del producto.
- `/login`
  Inicio de sesion.
- `/register`
  Registro de usuario.

### Privadas

- `/dashboard`
  Vista principal para delimitar una zona en el mapa y guardarla como parcela de riego.
- `/upload`
  Pantalla para subir una o varias imagenes de semillas y enviarlas al backend.

Las rutas privadas usan `localStorage` para comprobar que exista `nexo-token`. Si no existe, el frontend redirige a `/login`.

## Flujo funcional

### 1. Landing

La landing vive en [PublicLanding.tsx](c:/Users/jhonv/OneDrive/Documentos/sistema/frontend/components/PublicLanding.tsx) y cumple dos objetivos:

- presentar el producto
- enviar al usuario a login o registro

### 2. Login

La pantalla esta en [login/page.tsx](c:/Users/jhonv/OneDrive/Documentos/sistema/frontend/app/login/page.tsx).

Al iniciar sesion:

- llama a `POST /api/v1/auth/seeddss-login`
- guarda `nexo-token` en `localStorage`
- guarda `nexo-email` en `localStorage`
- redirige a `/dashboard`

### 3. Register

La pantalla esta en [register/page.tsx](c:/Users/jhonv/OneDrive/Documentos/sistema/frontend/app/register/page.tsx).

Al registrar:

- llama a `POST /api/v1/auth/register`
- muestra confirmacion
- redirige a `/login`

### 4. Dashboard

La pantalla esta en [dashboard/page.tsx](c:/Users/jhonv/OneDrive/Documentos/sistema/frontend/app/dashboard/page.tsx).

El flujo actual del dashboard es:

1. dibujar una zona sobre el mapa
2. consultar clima estimado usando el centro del poligono
3. marcar esa zona como "zona seleccionada para riego"
4. guardar la parcela en backend

Cuando se guarda, el frontend envia:

- `producer_id`
- `name`
- `code`
- `polygon_geojson`
- `centroid_latitude`
- `centroid_longitude`
- `area_m2`
- `irrigation_method: "zona_delimitada"`
- `water_source_type: "por_definir"`

### 5. Upload

La pantalla esta en [upload/page.tsx](c:/Users/jhonv/OneDrive/Documentos/sistema/frontend/app/upload/page.tsx).

Permite:

- seleccionar una o varias imagenes
- enviar `sample_id` opcional
- enviar `generated_by` opcional
- enviar `observations` opcional
- mandar `multipart/form-data` a `POST /api/v1/seed-samples/external-analysis`

## Sidebar privado

El shell privado vive en [AppShell.tsx](c:/Users/jhonv/OneDrive/Documentos/sistema/frontend/components/AppShell.tsx).

Actualmente provee:

- sidebar izquierdo
- modo expandido y colapsado
- persistencia del estado del sidebar con `localStorage`
- datos de sesion visibles
- boton de logout

Claves usadas en `localStorage`:

- `nexo-token`
- `nexo-email`
- `nexo-sidebar-collapsed`

## Mapa y seleccion de parcela

El componente del mapa vive en [ParcelMap.tsx](c:/Users/jhonv/OneDrive/Documentos/sistema/frontend/components/ParcelMap.tsx).

Responsabilidades:

- cargar Google Maps
- permitir clicks para agregar vertices
- construir el poligono
- calcular centroide
- calcular area aproximada
- notificar al dashboard mediante `onPolygonChange`

El componente soporta `purpose="irrigation"` para adaptar textos y estilos a la seleccion de una zona de riego.

## Integracion con backend

La capa de integracion principal esta en [api.ts](c:/Users/jhonv/OneDrive/Documentos/sistema/frontend/lib/api.ts).

Funciones actuales:

- `login`
- `registerUser`
- `fetchProducers`
- `createPlot`
- `fetchWeatherForLocation`
- `uploadSeedImages`

### Endpoints usados

- `POST /api/v1/auth/seeddss-login`
- `POST /api/v1/auth/register`
- `GET /api/v1/producers`
- `POST /api/v1/plots`
- `POST /api/v1/weather/fetch/open-meteo`
- `POST /api/v1/seed-samples/external-analysis`

## Variables de entorno

El frontend depende de:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_api_key
```

### `NEXT_PUBLIC_API_URL`

Base URL del backend consumida desde el navegador.

### `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Clave usada para cargar Google Maps JavaScript API en el dashboard.

Requisitos para que funcione:

- Maps JavaScript API habilitada en Google Cloud
- billing activo
- restricciones de referrer compatibles con `http://localhost:3000/*`

## Estructura de archivos

```txt
frontend/
  app/
    dashboard/
      layout.tsx
      page.tsx
    login/
      page.tsx
    register/
      page.tsx
    upload/
      page.tsx
    globals.css
    layout.tsx
    page.tsx
  components/
    AppShell.tsx
    ParcelMap.tsx
    PublicLanding.tsx
  lib/
    api.ts
  Dockerfile
  package.json
  tsconfig.json
```

## Docker

El frontend se levanta desde `docker-compose.yml` con el servicio `frontend`.

Comandos utiles:

```bash
docker compose up --build
docker compose restart frontend
docker compose logs -f frontend
docker compose exec frontend npm run typecheck
```

## Desarrollo local

Dentro de `frontend/`:

```bash
npm install
npm run dev
```

URL local:

```txt
http://localhost:3000
```

## Usuario demo

Para pruebas existe un usuario demo sembrado desde backend:

```txt
Email: demo@nexo.app
Password: Nexo1234
```

## Estado actual del producto

El frontend actual ya cubre un MVP navegable:

- landing publica
- auth separada
- area privada con sidebar
- seleccion de parcela para riego en mapa
- consulta de clima por centroide
- subida de imagenes al backend

Lo que todavia esta en evolucion:

- calculo de riego completo desde frontend
- seleccion de campañas y recomendaciones
- gestion avanzada de parcelas existentes
- experiencia movil mas refinada en el mapa
