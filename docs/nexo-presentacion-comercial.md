# NEXO

## Plataforma AgTech para calidad de semillas, parcelas inteligentes y riego de precision

NEXO es una plataforma digital para productores, tecnicos agricolas y empresas del sector semillero que necesitan tomar mejores decisiones antes y durante la siembra. El sistema conecta el analisis de calidad de semillas, el registro de parcelas, datos climaticos y recomendaciones de riego basadas en FAO-56 en una sola experiencia operativa.

La propuesta es simple: convertir datos dispersos en una recomendacion accionable para producir con mayor precision, reducir desperdicio de agua y mejorar la trazabilidad del proceso agricola.

## Problema Que Resuelve

En muchos procesos agricolas, la informacion clave vive separada:

- Las muestras de semillas se analizan por un lado.
- Las parcelas se registran manualmente o se pierden en mapas y planillas.
- El clima se consulta aparte.
- Las decisiones de riego dependen de experiencia, horas de bombeo o estimaciones generales.
- El productor no siempre puede cruzar calidad de semilla, ubicacion, clima y necesidad real de agua.

NEXO centraliza esos datos para que el productor pueda pasar de una decision intuitiva a una decision respaldada por datos.

## Propuesta De Valor

NEXO permite:

- Verificar semillas mediante imagenes y analisis asistido por IA.
- Registrar productores, lotes y muestras de semillas.
- Delimitar parcelas directamente sobre un mapa.
- Consultar datos climaticos para la zona de la parcela.
- Calcular recomendaciones de riego usando el modelo FAO-56.
- Ajustar el riego considerando la calidad del lote de semillas.
- Consultar un asistente IA con contexto real del sistema.
- Visualizar indicadores generales en un dashboard operativo.

El resultado es una plataforma que une calidad, ubicacion, clima y riego en un mismo flujo.

## Modulos Del Sistema

### 1. Landing Comercial

La aplicacion inicia con una landing page publica orientada a presentar el producto. Explica el valor de NEXO, sus principales funcionalidades y dirige al usuario hacia login o registro.

Incluye:

- Presentacion de la plataforma.
- Flujo general del producto.
- Acceso a login.
- Acceso a creacion de cuenta.
- Mensaje comercial para productores y tecnicos.

### 2. Autenticacion

NEXO cuenta con vistas separadas para login y registro.

El login permite acceder al area privada del sistema y conservar la sesion del usuario en el navegador. Una vez autenticado, el usuario entra al dashboard principal.

### 3. Dashboard Principal

El dashboard resume el estado operativo del sistema con indicadores clave.

Muestra:

- Total de analisis de semillas.
- Calidad promedio estimada.
- Parcelas registradas.
- Lotes de semillas disponibles.
- Datos climaticos guardados.
- Riego estimado para el dia.
- Parcelas recientes.
- Lotes recientes.
- Actividad general del sistema.

Esta pantalla funciona como panel ejecutivo para entender rapidamente que informacion existe y que decisiones pueden tomarse.

### 4. Verificacion De Semillas

NEXO replica un flujo completo de control de calidad de semillas:

1. Registro o busqueda del productor.
2. Registro del lote.
3. Registro de la muestra.
4. Carga de imagenes.
5. Analisis por IA.
6. Resultados e informe.

El usuario puede subir varias imagenes de semillas y obtener indicadores de calidad. El sistema esta preparado para trabajar con resultados como:

- Clase predicha.
- Confianza del modelo.
- Impurezas detectadas.
- Variaciones de color.
- Danos visibles o senales de alerta.
- Tamano relativo.
- Resumen por imagen.
- Informe de resultados.

Estos datos luego pueden servir como insumo para decisiones agronomicas y recomendaciones de riego.

### 5. Gestion De Parcelas

El sistema permite trabajar con parcelas de dos formas:

- Seleccionar una parcela ya registrada.
- Dibujar una nueva parcela sobre el mapa.

El usuario puede delimitar una zona haciendo clic sobre el mapa. La aplicacion va mostrando una previsualizacion del poligono hasta finalizar el dibujo.

Al guardar una parcela, NEXO registra:

- Nombre de la parcela.
- Codigo interno.
- Poligono en formato geoespacial.
- Centro geografico.
- Area aproximada en metros cuadrados y hectareas.
- Metodo de riego.
- Fuente de agua por definir o configurable.

El mapa inicia centrado en Santa Cruz, Bolivia, para adaptarse al contexto agricola local.

### 6. Mapa De Riego

La pantalla de riego permite visualizar y seleccionar la zona sobre la cual se quiere calcular la recomendacion.

El flujo esperado es:

1. Seleccionar una parcela existente o registrar una nueva.
2. Asociar un lote de semillas previamente analizado.
3. Consultar clima para la ubicacion.
4. Aplicar calculo FAO-56.
5. Obtener una recomendacion de agua.

El mapa esta disenado para ser interactivo:

- Boton para habilitar dibujo.
- Puntos sucesivos para construir el poligono.
- Previsualizacion del area mientras se dibuja.
- Edicion visual de la zona delimitada.
- Calculo de area aproximada.
- Seleccion de zona para riego.

### 7. Calculo De Riego FAO-56

NEXO utiliza el enfoque FAO-56 basado en evapotranspiracion del cultivo.

La formula base es:

```txt
ETc = Kc x ET0
```

Donde:

- `ET0` es la evapotranspiracion de referencia estimada con datos climaticos.
- `Kc` es el coeficiente del cultivo segun etapa fenologica.
- `ETc` es la evapotranspiracion real del cultivo.

El sistema considera:

- Temperatura maxima.
- Temperatura minima.
- Temperatura media.
- Lluvia.
- Lluvia efectiva.
- Humedad.
- Viento.
- Radiacion estimada.
- Area de la parcela.
- Etapa del cultivo.
- Calidad del lote de semillas.

La calidad del lote puede ajustar el factor de semilla. Si un lote presenta mayor vigor y pureza, el sistema puede tratarlo como una siembra mas uniforme. Si hay alertas de calidad, puede ajustar de forma conservadora la recomendacion.

El calculo operativo estima:

```txt
Lluvia efectiva = precipitacion x 0.8
Deficit hidrico = max(ETc - lluvia efectiva, 0)
Litros recomendados = deficit_mm x area_m2
```

Tambien permite comparar contra un consumo tradicional basado en:

- Horas de bombeo por semana.
- Caudal de la bomba en litros por segundo.

Con eso se estima un porcentaje de ahorro:

```txt
Ahorro de agua = ((Volumen tradicional - Volumen NEXO) / Volumen tradicional) x 100
```

### 8. Clima En Tiempo Real

NEXO consulta datos climaticos para la ubicacion de la parcela y los guarda como snapshots.

Actualmente el sistema registra:

- Temperatura.
- Precipitacion.
- Humedad.
- Viento.
- Radiacion.
- Indice UV.
- Fecha de consulta.
- Proveedor climatico.

Estos datos alimentan el calculo de riego y tambien quedan disponibles para el asistente IA.

### 9. Asistente IA

NEXO incorpora un chat tecnico conectado a Gemini.

El asistente puede responder con contexto de:

- Productores.
- Parcelas.
- Clima.
- Lotes y analisis de semillas.
- Recomendaciones de riego.
- Estimaciones FAO-56.
- Contexto especifico de pruebas de semillas.

El objetivo del asistente es ayudar al usuario a interpretar los datos, explicar resultados y sugerir que informacion falta registrar para mejorar la recomendacion.

Ejemplos de preguntas que puede responder:

- Que parcela requiere mas agua hoy?
- Que significa este resultado de semillas?
- Como afecta la calidad del lote al riego?
- Que datos faltan para una recomendacion mas precisa?
- Cual es la lamina de agua recomendada para esta parcela?
- Que lote tiene mejor calidad disponible?

### 10. Reportes Y Trazabilidad

El sistema esta preparado para conservar informacion historica:

- Productores.
- Parcelas.
- Campanas de cultivo.
- Muestras de semillas.
- Imagenes de semillas.
- Resultados de analisis.
- Consultas climaticas.
- Calculos de riego.
- Recomendaciones.
- Contextos usados por el asistente.

Esto permite construir trazabilidad desde la semilla hasta la decision de riego.

## Beneficios Para El Productor

### Mejor Decision De Siembra

El productor puede conocer el estado del lote de semillas antes de tomar decisiones de siembra, descarte, limpieza o inspeccion adicional.

### Menor Desperdicio De Agua

Al calcular el riego segun clima, etapa del cultivo y area real de la parcela, NEXO ayuda a evitar riegos por exceso.

### Trazabilidad Operativa

Cada lote, muestra, parcela y recomendacion queda asociado a un flujo digital.

### Mayor Claridad Tecnica

El asistente IA permite explicar resultados complejos en lenguaje simple, util para productores, tecnicos y equipos comerciales.

### Integracion De Datos

La plataforma conecta imagenes, clima, mapa y calculo agronomico en un solo lugar.

## Beneficios Para Empresas Semilleras Y AgTech

NEXO tambien puede ser usado como herramienta para:

- Demostraciones comerciales.
- Servicios de asistencia tecnica.
- Seguimiento de calidad de lotes.
- Digitalizacion de recomendaciones agronomicas.
- Soporte a productores.
- Reportes para clientes.
- Pilotos de agricultura de precision.

## Tecnologia

NEXO esta construido como una aplicacion moderna full stack.

Backend:

- Python.
- FastAPI.
- PostgreSQL.
- PostGIS.
- SQLAlchemy.
- Alembic.
- Redis.
- Celery.
- Integraciones HTTP con servicios externos.

Frontend:

- Next.js.
- React.
- TypeScript.
- Componentes interactivos.
- Google Maps para visualizacion y delimitacion de parcelas.

Infraestructura:

- Docker Compose.
- Servicios separados para frontend, backend, base de datos, Redis y worker.
- Configuracion por variables de entorno.

IA:

- Integracion con Gemini para asistente conversacional.
- Contexto operativo construido desde la base de datos.
- Uso de resultados de analisis de semillas para enriquecer respuestas.

## Flujo Comercial Del Producto

El flujo que se puede presentar a un cliente es:

1. El productor entra a NEXO.
2. Registra o selecciona un lote de semillas.
3. Sube imagenes para verificar calidad.
4. Registra o selecciona su parcela.
5. NEXO consulta clima para la ubicacion.
6. El sistema calcula la necesidad de riego mediante FAO-56.
7. La calidad de la semilla ajusta la recomendacion.
8. El productor recibe una sugerencia clara de riego.
9. El asistente IA puede explicar el resultado.

## Diferenciador

NEXO no es solo un mapa, ni solo un verificador de semillas, ni solo un dashboard.

Su valor esta en cruzar tres capas que normalmente estan separadas:

- Calidad de semilla.
- Condicion climatica.
- Necesidad hidrica de la parcela.

Con esa union, el sistema puede responder una pregunta mucho mas valiosa:

> Cuanta agua necesita esta parcela, considerando el clima de hoy y el lote de semillas que realmente se va a sembrar?

## Estado Actual Del MVP

El MVP actual incluye:

- Landing publica.
- Login.
- Registro.
- Dashboard ejecutivo.
- Sidebar navegable.
- Verificacion de semillas paso a paso.
- Carga multiple de imagenes.
- Resultados de analisis.
- Pantalla de mapa de riego.
- Dibujo de poligonos sobre mapa.
- Registro de parcelas.
- Consulta climatica.
- Calculo operativo FAO-56.
- Ajuste por calidad de semilla.
- Asistente IA con contexto.
- Backend dockerizado.
- Frontend dockerizado.
- Base de datos PostgreSQL con migraciones.

## Roadmap Sugerido

Para evolucionar de MVP a producto comercial, se puede avanzar en:

- Gestion completa de campanas por productor.
- Vinculacion formal entre parcela, campana y lote de semilla.
- Reportes PDF comerciales.
- Panel de ahorro acumulado de agua.
- Historial de recomendaciones por parcela.
- Gestion de bombas y costos energeticos.
- Alertas automaticas por clima o deficit hidrico.
- Roles de usuario por empresa.
- Multiempresa o multitenancy.
- App movil o vista responsive optimizada para campo.
- Integracion con estaciones meteorologicas o APIs climaticas adicionales.

## Mensaje De Venta

NEXO ayuda a productores y empresas agricolas a tomar decisiones mas inteligentes desde la semilla hasta el riego.

Al combinar IA para calidad de semillas, mapas de parcelas, clima y calculo FAO-56, la plataforma transforma datos tecnicos en recomendaciones claras, trazables y accionables.

NEXO es una herramienta para producir con mas precision, cuidar el agua y profesionalizar la gestion agricola.
