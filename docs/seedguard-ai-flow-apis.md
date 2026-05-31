# APIs usadas por seedguard-ai-flow

Este documento resume las APIs consumidas por `seedguard-ai-flow/`, con foco en el flujo de procesamiento de imágenes de semillas que NEXO debe integrar.

Fuente analizada: frontend React/Vite en `seedguard-ai-flow/src`.

## Configuración base

La app usa una sola variable de entorno para apuntar al backend:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Todos los endpoints se construyen como:

```text
{VITE_API_URL}/api/...
```

En varios módulos, si no existe `VITE_API_URL`, el fallback es:

```text
http://localhost:8000
```

La autenticación usa un token guardado en `localStorage`:

```ts
localStorage.getItem("token")
```

Cuando aplica, se envía:

```http
Authorization: Bearer <token>
```

## Flujo principal de análisis

El flujo del wizard es:

1. Login.
2. Crear sesión del wizard.
3. Buscar o guardar productor.
4. Guardar lote.
5. Guardar muestra.
6. Subir imágenes para análisis IA.
7. Guardar reporte.
8. Consultar overlays/procesamientos visuales.
9. Descargar PDF.

## Endpoints críticos para NEXO

### 1. Login

`POST /api/login`

Usado en `LoginPage.tsx`.

Nota para NEXO: la pantalla del navegador puede estar en `/login`, pero la API que muestra el backend Flask es `POST /api/login`. En NEXO se dejo configurable como `SEEDDSS_LOGIN_PATH=/api/login` para consumir `POST {SEEDDSS_API_URL}{SEEDDSS_LOGIN_PATH}`.

Request JSON:

```json
{
  "email": "usuario@example.com",
  "password": "password"
}
```

Response esperado:

```json
{
  "user": {
    "user_id": "string",
    "name": "string",
    "role_name": "Administrador | Supervisor | Laboratorista | string"
  },
  "token": "jwt-or-token"
}
```

El frontend guarda:

```ts
localStorage.setItem("user", JSON.stringify(data.user));
localStorage.setItem("token", data.token);
```

### 2. Iniciar sesión de wizard

`POST /api/start_wizard`

Usado en `SeedVerificationWizard.tsx`.

Headers:

```http
Authorization: Bearer <token>
```

Request: sin body.

Response esperado:

```json
{
  "session_id": "string"
}
```

### 3. Rollback de wizard

`POST /api/rollback_wizard`

Usado al volver desde el paso de análisis.

Headers:

```http
Content-Type: application/json
Authorization: Bearer <token>
```

Request JSON:

```json
{
  "session_id": "string"
}
```

### 4. Buscar productor

`GET /api/get_producer?cod_or_name=<texto>`

Usado en `ProducerForm.tsx`.

Headers:

```http
Authorization: Bearer <token>
```

Response esperado:

```json
{
  "name": "string",
  "cod_producer": "string",
  "phone": "string",
  "address": "string"
}
```

### 5. Guardar productor

`POST /api/save_producer`

Usado en `ProducerForm.tsx`.

Headers:

```http
Content-Type: application/json
Authorization: Bearer <token>
```

Request JSON:

```json
{
  "name": "string",
  "cod_producer": "string",
  "phone": "string",
  "address": "string",
  "session_id": "string"
}
```

### 6. Guardar lote

`POST /api/save_lot`

Usado en `LoteForm.tsx`.

Headers:

```http
Content-Type: application/json
Authorization: Bearer <token>
```

Request JSON:

```json
{
  "producer": "string",
  "species": "Soja",
  "variety": "MUNASQA | PATUJÚ | SW4864 | NS6483 | string",
  "category": "Básica | Registrada | Cetificada | string",
  "reception": "YYYY-MM-DD",
  "created_by": "user_id",
  "session_id": "string"
}
```

Response esperado:

```json
{
  "lot_id": "string"
}
```

### 7. Guardar muestra

`POST /api/save_sample`

Usado en `SampleForm.tsx`.

Headers:

```http
Content-Type: application/json
Authorization: Bearer <token>
```

Request JSON:

```json
{
  "lot_id": "string",
  "sample_date": "YYYY-MM-DD",
  "analyst": "string",
  "observations": "string",
  "session_id": "string"
}
```

Response esperado:

```json
{
  "sample_id": "string"
}
```

### 8. Analizar grupo de imágenes

`POST /api/analyze_group`

Este es el endpoint principal para el procesamiento de imágenes de semillas. Usado en `ImageAnalysis.tsx`.

Content-Type:

```http
multipart/form-data
```

Request `FormData`:

```ts
form.append("files", file, file.name); // una o varias imágenes
form.append("generated_by", producerData.name);
form.append("sample_id", sampleData.sampleId);
form.append("predicted_class", "");
form.append("probability", "0");
form.append("observations", sampleData.notes ?? "");
```

Campos:

| Campo | Tipo | Requerido | Descripción |
|---|---:|---:|---|
| `files` | File[] | Sí | Imágenes de semillas. El frontend acepta `image/*`. |
| `generated_by` | string | Sí | Nombre del productor en el flujo actual. |
| `sample_id` | string | Sí | ID de muestra generado por `/api/save_sample`. |
| `predicted_class` | string | No | Se envía vacío desde frontend. |
| `probability` | string/number | No | Se envía `"0"` desde frontend. |
| `observations` | string | No | Notas de la muestra. |

Response esperado:

```json
{
  "analysis_id": "string",
  "report_id": "string",
  "predicted_class": "string",
  "probability": 0.98,
  "probability_vector": [0.01, 0.98, 0.01],
  "features": {
    "image-or-seed-key": {
      "Color medio (H)": "number|string",
      "Variación de color": "number|string",
      "Tamaño relativo": "number|string",
      "Circularidad": "number|string",
      "Daños mecánicos": "number|string",
      "Impurezas": "Yes|No|string",
      "MorphologicalState": "Good|string",
      "Damage_ratio": 0.05,
      "Impurities_count": 0,
      "ColorVariation_H": 30,
      "AspectRatio": 0.9
    }
  }
}
```

Uso posterior en frontend:

```ts
localStorage.setItem("latest_analysis_id", data.analysis_id);
localStorage.setItem("latest_report_id", data.report_id);
```

Mapeo de datos a métricas de NEXO:

```ts
"Pureza física (%)": MorphologicalState === "Good" ? 98 : (1 - Damage_ratio) * 100
"Materia inerte (%)": Impurities === "Yes" ? Impurities_count * 2 : 1
"Daños mecánicos (%)": Damage_ratio * 100
"Homogeneidad de color": ColorVariation_H < 50 ? "Uniforme" : "Variable"
"Forma y tamaño": AspectRatio > 0.8 ? "Dentro del rango" : "Fuera del rango"
```

### 9. Guardar reporte

`POST /api/save_report`

Usado inmediatamente después de `/api/analyze_group`.

Headers:

```http
Content-Type: application/json
Authorization: Bearer <token>
```

Request JSON:

```json
{
  "session_id": "string",
  "sample_id": "string",
  "predicted_class": "string",
  "probability": 0.98,
  "features": {},
  "observations": "string"
}
```

El frontend solo valida que `res.ok`; no usa la respuesta.

### 10. Obtener imágenes procesadas con overlays

`GET /api/get_overlay_images/{analysis_id}`

Usado en `FinalReport.tsx` y en el modal de `Dashboard.tsx`.

Response esperado:

```json
{
  "images": [
    {
      "filename": "string",
      "image_base64": "data:image/png;base64,..."
    }
  ]
}
```

La UI interpreta los overlays así:

- Verde: contorno de la semilla.
- Rojo: manchas y daños mecánicos.
- Azul: impurezas externas.

### 11. Descargar reporte PDF

`GET /api/download_report/{analysis_id}`

Usado en `FinalReport.tsx`.

Response esperado:

```http
Content-Type: application/pdf
```

El frontend descarga el blob con nombre:

```text
Reporte_<analysis_id>.pdf
```

## Endpoints de evaluación del modelo

Estos endpoints no son parte del flujo principal del productor, pero sirven para depurar/mostrar cómo trabaja el modelo.

### 12. Procesamiento paso a paso

`POST /api/process_image_steps`

Usado en `ModelEvaluation.tsx`.

Headers:

```http
Authorization: Bearer <token>
```

Request `FormData`:

```ts
formData.append("image", selectedFile);
```

Response esperado:

```json
{
  "steps": {
    "step1": "Escala de grises",
    "step2": "Detección de bordes",
    "step3": "Umbralización",
    "step4": "Segmentación",
    "step5": "Preprocesamiento final"
  },
  "visuals": {
    "gray_image": "base64",
    "edges_image": "base64",
    "thresh_image": "base64",
    "segmented_image": "base64",
    "preprocessed_image": "base64"
  },
  "all_probabilities": [0.1, 0.8, 0.1]
}
```

### 13. Predicción simple paso a paso

`POST /api/predict_step_by_step`

Usado en `ModelEvaluation.tsx`.

Headers:

```http
Authorization: Bearer <token>
```

Request `FormData`:

```ts
formData.append("image", selectedFile);
```

Response esperado:

```json
{
  "label": "string",
  "probability": 0.98,
  "steps": {
    "step6": "Extracción de features",
    "step7": "Predicción de probabilidades",
    "step8": "Selección de clase"
  },
  "visuals": {
    "features_histogram": "base64",
    "probabilities_bar": "base64",
    "selected_class_bar": "base64"
  }
}
```

### 14. Métricas del modelo

`GET /api/evaluate_model`

Usado en `ModelEvaluation.tsx`.

Headers:

```http
Authorization: Bearer <token>
```

Response esperado:

```json
{
  "metrics": {
    "accuracy": 0.95,
    "precision": 0.95,
    "recall": 0.95,
    "f1_score": 0.95,
    "evaluation_time": 1.23,
    "prediction_time_total": 0.42,
    "prediction_time_per_image": 0.01,
    "num_images": 100,
    "classification_report": {}
  },
  "class_metrics": [
    {
      "class": "string",
      "precision": 0.95,
      "recall": 0.95,
      "f1_score": 0.95
    }
  ],
  "confusion_matrix_base64": "data:image/png;base64,..."
}
```

## Endpoints de consulta administrativa e historial

### 15. Listar análisis

`GET /api/analyses?limit=100`

Usado en `Dashboard.tsx`.

Response esperado: array de reportes.

```json
[
  {
    "_id": "string",
    "analysis_id": "string",
    "image_id": "string",
    "sample_guid": "string",
    "sample_id": "string",
    "predicted_class": "string",
    "probability": 0.98,
    "probability_vector": [0.01, 0.98, 0.01],
    "features": {},
    "model_version": "string",
    "path": "string",
    "captured_at": "ISO date",
    "processed_at": "ISO date",
    "reviewed": false,
    "review_notes": null
  }
]
```

### 16. Lotes

`GET /api/lots?user_id=<id>&search=&producer=&species=&variety=&category=&reception_from=&reception_to=`

`DELETE /api/lots`

Delete body:

```json
{
  "lot_id": "string",
  "user_id": "string"
}
```

### 17. Muestras

`GET /api/samples?user_id=<id>&search=&lot_name=&sample_date_from=&sample_date_to=&analyst=`

`DELETE /api/samples`

Delete body:

```json
{
  "sample_id": "string",
  "user_id": "string"
}
```

### 18. Usuarios y roles

`GET /api/roles`

`GET /api/users?search=&role=&active=`

`POST /api/users`

Request desde dashboard:

```json
{
  "name": "string",
  "email": "string",
  "password": "string",
  "role": "role_id as string"
}
```

`PUT /api/users`

```json
{
  "user_id": "string",
  "name": "string",
  "email": "string",
  "role_id": 1,
  "active": "Activo | Inactivo"
}
```

`DELETE /api/users`

```json
{
  "user_id": "string"
}
```

`POST /api/users/change_password`

```json
{
  "user_id": "string",
  "new_password": "string"
}
```

## Integración recomendada para NEXO

Para NEXO, lo mínimo necesario es implementar/consumir estos endpoints del servicio externo SeedDSS:

1. `POST /api/analyze_group`
2. `POST /api/save_report`
3. `GET /api/get_overlay_images/{analysis_id}`
4. `GET /api/download_report/{analysis_id}`

Si NEXO maneja productores, lotes y muestras en su propia base de datos, puede omitir:

- `/api/save_producer`
- `/api/save_lot`
- `/api/save_sample`
- `/api/start_wizard`
- `/api/rollback_wizard`

En ese caso NEXO debería enviar a `/api/analyze_group`:

```ts
const form = new FormData();
images.forEach((file) => form.append("files", file, file.name));
form.append("generated_by", producerName);
form.append("sample_id", nexoSeedSampleId);
form.append("predicted_class", "");
form.append("probability", "0");
form.append("observations", notes ?? "");
```

Y guardar en NEXO:

- `analysis_id`
- `report_id`
- `predicted_class`
- `probability`
- `probability_vector`
- `features`
- overlays obtenidos desde `/api/get_overlay_images/{analysis_id}`

## Observaciones importantes

- El endpoint principal acepta múltiples imágenes bajo el campo `files`.
- El frontend no envía `Authorization` a `/api/analyze_group`, pero sí a `/api/save_report`. Conviene confirmar si el backend externo exige token o no.
- Las imágenes procesadas se devuelven como base64 o data URL, no como URLs públicas.
- El cálculo de métricas agronómicas en la app se deriva de `features`, especialmente:
  - `MorphologicalState`
  - `Damage_ratio`
  - `Impurities`
  - `Impurities_count`
  - `ColorVariation_H`
  - `AspectRatio`
- La app asume soya/soja como especie principal.
