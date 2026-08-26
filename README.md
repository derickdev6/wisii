# Contratación de la Gobernación de San Andrés

Visualización de la contratación de la **Gobernación del Departamento Archipiélago
de San Andrés, Providencia y Santa Catalina** (NIT 892400038), a partir de los datos
abiertos de `datos.gov.co`. Cubre **37.955 contratos entre marzo de 2015 y agosto de 2026**,
uniendo los dos sistemas de contratación pública del país.

Tres vistas: mapa de calor, listado con búsqueda integral, y un editor para corregir la
ubicación de los barrios.

## Las dos fuentes

| | SECOP II | SECOP I |
|---|---|---|
| Dataset | `jbjy-vk9h` | `f789-7hwg` |
| Período | jun 2020 – ago 2026 | mar 2015 – sep 2022 |
| Contratos | 31.975 | 5.980 |
| Identificación de la entidad | por NIT | solo por nombre (el NIT figura como "No Definido") |
| Domicilio del contratista | sí | **no existe el campo** |
| Ejecución de pagos | sí (casi nunca diligenciada) | no se publica |

Los dos sistemas no comparten identificador de contrato. En el solape de 2020 se
descartaron **115 registros** que aparecían en ambos con el mismo contratista, fecha de
firma y valor. Los valores de tipo y modalidad que solo diferían en mayúsculas
("Prestación de servicios" vs "Prestación de Servicios") se unifican al deletreo más
frecuente para que los filtros no queden partidos en dos.

## Lo que hay que saber antes de leer el mapa

**Los contratos del SECOP no traen coordenadas.** En SECOP II los 31.975 registros figuran
ejecutándose en la misma dirección — la sede de la Gobernación, en el Edificio Coral
Palace. Un mapa de "un punto por contrato" sería un solo píxel.

El único campo con variación geográfica real es `domicilio_representante_legal`: dónde vive
el representante legal del contratista. El mapa de calor muestra **eso**, y no el lugar de
ejecución del contrato. SECOP I no publica ese campo, así que sus 5.980 contratos no pueden
ubicarse nunca.

| | |
|---|---|
| Contratos con el campo domicilio (SECOP II) | 31.975 |
| De ellos, ubicados en un barrio | 14.731 (46.1%) |
| Sin domicilio útil (`NO DEFINIDO`) | 10.760 |
| Domicilio presente pero no reconocido | 6.484 |
| Cobertura sobre el total de 37.955 | 38.8% |
| Barrios con coordenada de OpenStreetMap | 23 de 49 |
| Barrios con coordenada aproximada (±300 m) | 26 de 49 |

Sirve para leer **concentración relativa** entre zonas. No sirve para medir montos por zona
ni para localizar direcciones.

Dos campos más que conviene no malinterpretar:

- **`valor_pagado` se omite deliberadamente.** Solo 30 de 37.955 contratos lo
  reportan. Graficarlo sugeriría una ejecución cercana a cero que el dato no respalda.
- **Los registros sin fecha de firma quedan fuera.** En SECOP II son 2.265 y están todos en
  estados previos a la firma (Borrador, Cancelado, enviado Proveedor, En aprobación), con
  valores corruptos: hay borradores por encima de $1.000 billones COP, mil veces el PIB del
  país. Exigir fecha de firma elimina los dos problemas a la vez.

## Cómo correrlo

```bash
npm install
npm run data:all
npm run dev
```

`data:all` descarga los CSV de los dos datasets, baja el contorno de la isla desde
OpenStreetMap y genera los JSON en `public/data/`. La consulta de SECOP I tarda varios
minutos: `nombre_entidad` no está indexado en ese dataset. Los JSON ya vienen commiteados, así que
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
scripts/fetch_data.py      descarga SECOP II (paginado, deduplicado)
scripts/fetch_secop1.py    descarga SECOP I (una sola consulta, lenta)
scripts/fetch_geo.py       contorno de la isla desde Overpass, cosido y simplificado
scripts/geocode_barrios.py geocodificación inicial contra OSM/Nominatim
scripts/build_data.py      une ambas fuentes + gazetteer -> public/data/*.json
data/gazetteer.json        barrios y alias — editable a mano o desde el editor
app/, components/, lib/    la aplicación Next.js
```

Los JSON que consume el navegador van codificados con diccionarios (el objeto del contrato
solo se representa una vez y los prefijos constantes de id se guardan aparte): 10,6 MB en
crudo, ~1,9 MB comprimidos. Se cargan una sola vez — medido en el navegador, 78 ms de
descarga y parseo más 72 ms para construir el índice de búsqueda — y así el filtrado sobre
los 37.955 contratos es instantáneo sin backend.

## Fuentes

- Contratos: [dataset `jbjy-vk9h`](https://www.datos.gov.co/d/jbjy-vk9h) (SECOP II) y
  [dataset `f789-7hwg`](https://www.datos.gov.co/d/f789-7hwg) (SECOP I), en datos.gov.co
- Contorno de la isla y ubicación de barrios: © OpenStreetMap contributors (ODbL)
- Imagen satelital del editor: © Esri, Maxar, Earthstar Geographics
