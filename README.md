# Contratación de la Gobernación de San Andrés

Visualización de los contratos firmados por la **Gobernación del Departamento Archipiélago
de San Andrés, Providencia y Santa Catalina** (NIT 892400038) desde el 1 de enero de 2025,
a partir de los datos abiertos del SECOP II publicados en `datos.gov.co`.

Tres vistas: mapa de calor, listado con búsqueda integral, y un editor para corregir la
ubicación de los barrios.

## Lo que hay que saber antes de leer el mapa

**Los contratos del SECOP no traen coordenadas.** Los 9.614 registros figuran ejecutándose
en la misma dirección — la sede de la Gobernación, en el Edificio Coral Palace. Un mapa de
"un punto por contrato" sería 9.614 puntos apilados en un píxel.

El único campo con variación geográfica real es `domicilio_representante_legal`: dónde vive
el representante legal del contratista. El mapa de calor muestra **eso**, y no el lugar de
ejecución del contrato. Con esa base:

| | |
|---|---|
| Contratos ubicables | ~45% |
| Sin domicilio útil (`NO DEFINIDO`) | ~35% |
| Domicilio presente pero no reconocido | ~20% |
| Barrios con coordenada de OpenStreetMap | 23 de 49 |
| Barrios con coordenada aproximada (±300 m) | 26 de 49 |

Sirve para leer **concentración relativa** entre zonas. No sirve para medir montos por zona
ni para localizar direcciones.

Dos campos más que conviene no malinterpretar:

- **`valor_pagado` se omite deliberadamente.** Solo 10 de 9.614 contratos lo reportan
  (incluso entre los 3.316 "Cerrado", solo 9). Graficarlo sugeriría una ejecución cercana
  a cero que el dato no respalda.
- **`referencia_del_contrato` es idéntico a `id_contrato`** en el 100% de las filas, así que
  no se muestra como campo aparte.

## Cómo correrlo

```bash
npm install
npm run data:all
npm run dev
```

`data:all` descarga el CSV desde datos.gov.co, baja el contorno de la isla desde
OpenStreetMap y genera los JSON en `public/data/`. Los JSON ya vienen commiteados, así que
`npm run dev` funciona sin ese paso.

Para la descarga conviene un token de Socrata (gratis, evita el rate limit):

```bash
cp .env.example .env.local
```

## El editor de barrios

OpenStreetMap tiene cobertura pobre de los barrios de San Andrés: de 19 nombres frecuentes
en los datos, solo 2 aparecían indexados. Por eso 26 de las 49 ubicaciones son aproximadas
y necesitan conocimiento local.

La pestaña **Editor de barrios** existe para eso:

- Mapa satelital (Esri) o callejero (OSM) para reconocer el terreno.
- La lista está ordenada por número de contratos, así se arregla primero lo que más pesa.
  Los chips marcan el origen: `OSM`, `aprox` o `editado`.
- Seleccioná un barrio y hacé clic en el mapa (o arrastrá el punto) para reubicarlo.
- La pestaña **Sin reconocer** lista los textos de domicilio que ningún alias captura, con
  su frecuencia. Asignalos a un barrio existente o creá uno nuevo ubicándolo en el mapa.
  Cada asignación sube la cobertura del mapa de calor.
- **Guardar** escribe `data/gazetteer.json` directamente (solo en local: en Vercel el
  filesystem es de solo lectura, ahí se usa **Descargar**).

Después de guardar, recalculá los datos:

```bash
npm run data:build
```

`data/gazetteer.json` también se edita a mano sin problema: es un JSON plano con `barrios`
(nombre → lat/lon/origen) y `alias` (texto normalizado → barrio).

## Desplegar en Vercel

Importá el repo en Vercel: detecta Next.js y no necesita configuración. El sitio es estático
salvo `/api/gazetteer`, que solo lee en producción.

El refresco automático lo hace GitHub Actions, no Vercel: `.github/workflows/actualizar-datos.yml`
corre los lunes, regenera `public/data/` y commitea si algo cambió, lo que dispara el
redespliegue. Requiere un secret `SODA_APP_TOKEN` en el repo
(Settings → Secrets and variables → Actions).

## Estructura

```
scripts/fetch_data.py      descarga el CSV del SECOP (paginado, deduplicado)
scripts/fetch_geo.py       contorno de la isla desde Overpass, cosido y simplificado
scripts/geocode_barrios.py geocodificación inicial contra OSM/Nominatim
scripts/build_data.py      CSV + gazetteer -> public/data/*.json
data/gazetteer.json        barrios y alias — editable a mano o desde el editor
app/, components/, lib/    la aplicación Next.js
```

Los JSON que consume el navegador van codificados con diccionarios: 3,6 MB en crudo,
~950 KB comprimidos, y se cargan una sola vez para que la búsqueda sobre los 9.614
contratos sea instantánea sin backend.

## Fuentes

- Contratos: [datos.gov.co, dataset `jbjy-vk9h`](https://www.datos.gov.co/d/jbjy-vk9h) (SECOP II)
- Contorno de la isla y ubicación de barrios: © OpenStreetMap contributors (ODbL)
- Imagen satelital del editor: © Esri, Maxar, Earthstar Geographics
