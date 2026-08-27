# WiSii

> *WiSii* — «we see» en creole isleño: **nosotros vemos**.

Veeduría ciudadana de la contratación de la **Gobernación del Departamento Archipiélago
de San Andrés, Providencia y Santa Catalina** (NIT 892400038), a partir de los datos
abiertos de `datos.gov.co`. Cubre **37.955 contratos entre marzo de 2015 y agosto de 2026**,
uniendo los dos sistemas de contratación pública del país.

Dos rutas: una **portada** (`/`) que explica el proyecto, muestra lo firmado en el último
mes y lleva al explorador; y el **explorador** (`/contratos`) con tres vistas: listado con
búsqueda integral (la que abre por defecto), mapa de calor (`?v=mapa`) y un editor para
corregir la ubicación de los barrios.

Los filtros son gobierno, estado, tipo, modalidad, rango de fechas y valor mínimo, en una
sola línea. La barra es la misma en el listado y en el mapa, y las dos vistas miran el mismo
subconjunto: el mapa se agrega en el navegador a partir de los contratos filtrados, no del
agregado del build. Solo el listado lleva buscador de texto — en el mapa una búsqueda
escrita acotaría el resultado sin que se vea por qué.

Cuidado con una consecuencia del dato: **cualquier período anterior a mediados de 2020
deja el mapa vacío**, porque esos contratos son de SECOP I y ese sistema no publica el
domicilio del contratista. El mapa lo dice explícitamente en vez de mostrarse en blanco, y
el panel declara siempre cuántos de los contratos filtrados quedaron fuera.

La portada se prerenderiza en el build leyendo `public/data/*.json` desde el sistema de
archivos, así que sale con 623 B de JavaScript y no descarga los 10 MB de contratos: eso
solo lo hace `/contratos`. Los datos del último mes viven en `public/data/recientes.json`
y la ventana se mide desde la última firma publicada, no desde hoy, para que nunca quede
vacía si el SECOP se retrasa.

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
| De ellos, ubicados en un barrio | 15.617 (48.8%) |
| Sin domicilio útil (`NO DEFINIDO`) | 10.760 |
| Domicilio presente pero no reconocido | 5.598 |
| Cobertura sobre el total de 37.955 | 41.1% |
| Barrios con coordenada de OpenStreetMap | 41 de 65 |
| Barrios con coordenada aproximada (±300 m) | 24 de 65 |

Sirve para leer **concentración relativa** entre zonas. No sirve para medir montos por zona
ni para localizar direcciones.

Dos campos más que conviene no malinterpretar:

- **`valor_pagado` se omite deliberadamente.** Solo 30 de 37.955 contratos lo
  reportan. Graficarlo sugeriría una ejecución cercana a cero que el dato no respalda.
- **Los registros sin fecha de firma quedan fuera.** En SECOP II son 2.265 y están todos en
  estados previos a la firma (Borrador, Cancelado, enviado Proveedor, En aprobación), con
  valores corruptos: hay borradores por encima de $1.000 billones COP, mil veces el PIB del
  país. Exigir fecha de firma elimina los dos problemas a la vez.

## Filtro por período de gobierno

El selector **Gobierno** fija las fechas al período constitucional de cada gobernación.
En Colombia los gobernadores se eligen por cuatro años (Constitución, art. 303, modificado
por el Acto Legislativo 2 de 2002), se posesionan el 1 de enero del año siguiente a la
elección y terminan el 31 de diciembre del cuarto año; para 2024-2027 lo confirma la
Ley 2200 de 2022. Las elecciones regionales son el último domingo de octubre.

| Período | Elección | Titular electo | |
|---|---|---|---|
| 2012 – 2015 | 30 oct 2011 | Aury Socorro Guerrero Bowie | primera gobernadora por voto popular |
| 2016 – 2019 | 25 oct 2015 | Ronald Housni Jaller | suspendido el 23 abr 2018; encargada Sandra Victoria Howard Taylor |
| 2020 – 2023 | 27 oct 2019 | Everth Julio Hawkins Sjogreen | suspendido sep 2020, libre el 22 abr 2021; encargado Alen Jay Stephens |
| 2024 – 2027 | 29 oct 2023 | Nicolás Iván Gallardo Vásquez | elección anulada por doble militancia; encargada Vilma Jay López; Girley Natacha Ordóñez Bowie elegida en la atípica del 5 jul 2026 |

**El filtro usa las fechas legales del período, no la permanencia real de cada persona.**
En este departamento casi ningún gobernador completó su mandato, así que los contratos de
un período no corresponden todos al mismo gobernante. La interfaz lista los titulares con
su rol (elegido o encargado) y lo advierte al seleccionar un período interrumpido. Editar
una fecha a mano desmarca el gobierno, porque el rango deja de corresponder a un período.

Los períodos viven en [`lib/gobiernos.ts`](lib/gobiernos.ts).

## Las tres islas en el mapa

El departamento incluye Providencia y Santa Catalina, a unos 90 km al nor-noreste de San
Andrés. A escala real, mostrarlas juntas dejaría a San Andrés diminuta, así que el mapa de
calor **conserva la forma y el tamaño verdaderos de cada isla pero dibuja el grupo de
Providencia al lado de San Andrés**: lo único falseado es la distancia, y el mapa lo
declara. El desplazamiento se calcula en `scripts/fetch_geo.py`, se guarda en
`data/islas.geojson` y `build_data.py` lo aplica a los barrios de esa isla, de modo que
caen sobre su polígono.

El editor de barrios trabaja siempre con **coordenadas reales** sobre imagen satelital, y
tiene un conmutador San Andrés / Providencia que vuela a la isla correspondiente y filtra
la lista. `data/gazetteer.json` guarda las coordenadas reales; el desplazamiento existe
solo en el mapa de calor.

Al incorporar Providencia aparecieron 1.393 contratos en 10 barrios que antes
quedaban sin ubicar, y se corrigieron tres asignaciones equivocadas: **La Montaña**
(The Mountain), **San Felipe** (San Felipe Lazy Hill) y **Pueblo Viejo** (Old Town) son
localidades de Providencia, no de San Andrés — yo las había colocado a mano en San Andrés
con coordenadas inventadas. OpenStreetMap las ubica en Providencia, así que ahora usan sus
coordenadas verificables. Si el conocimiento local dice otra cosa, se corrigen en el editor.

## Enlaces compartibles

Todo el estado del explorador vive en la URL, así que una búsqueda se comparte tal cual:
quien abre el enlace recibe los mismos filtros, el mismo orden y la misma vista.

```
/contratos?v=contratos&q=turismo&gob=2020-2023&estado=Cerrado&orden=valor-desc
/contratos?c=CO1.PCCNTR.1637513
```

- **Compartir búsqueda** (barra de resultados) copia el enlace con todos los filtros
  activos. Los valores por defecto no se escriben, así una búsqueda sin filtros deja la
  URL limpia.
- Un parámetro que ya no existe (por ejemplo `fuente=` o `barrio=`, retirados como
  filtros) se ignora sin romper el resto del enlace.
- **Compartir** (ficha de un contrato) copia un enlace que reabre ese contrato. Un enlace
  con `c=` y sin `v=` abre directamente el listado, no el mapa.
- Si el `c=` no existe en los datos publicados —por ejemplo si el SECOP retiró el
  registro— la página lo dice en vez de quedarse en blanco.
- La URL se actualiza con `replace()`, no con `push()`, para que escribir en el buscador
  no llene el historial del navegador.
- Si el navegador bloquea el portapapeles, el botón muestra el enlace en un campo
  seleccionado para copiarlo a mano.

La codificación vive en [`lib/urlEstado.ts`](lib/urlEstado.ts).

## El listado

Caja de alto fijo (800 px) con scroll propio; las filas conservan su alto natural
(~113 px), que deja aire suficiente para leer el objeto del contrato en dos líneas junto
a sus etiquetas. Entran unas 7 filas por pantalla de caja. La paginación va en pasos de
10, 20, 50 y 100, con 20 por defecto; al cambiar de página o de filtro el scroll interno
vuelve al tope.

## Filtros facetados

Los contadores de cada selector se calculan sobre los contratos que pasan **todos los demás
filtros**, no sobre el total. Al elegir el gobierno 2020-2023, «Contratación directa» pasa
de 31.531 a 17.586 y «San Luis» de 1.962 a 1.130: el número que ves es el que vas a obtener
si aplicás ese filtro. El valor ya seleccionado se conserva en la lista aunque quede en
cero, para que el desplegable no aparezca vacío.

## Paleta y tema

Tokens CSS definidos completos en `:root` (claro) y redefinidos en `@media (prefers-color-scheme: dark)`
y en `:root[data-theme="dark"]`, de modo que el conmutador funciona en ambos sentidos y
respeta la preferencia del sistema cuando no hay elección explícita. Un script inline en
`app/layout.tsx` aplica el tema antes del primer pintado para evitar el parpadeo.

| | Claro | Oscuro |
|---|---|---|
| Fondo | `#f1faff` | `#0d1821` |
| Texto | `#111a1b` | `#f1faff` |
| Acento | `#344966` | `#b4cded` |
| Acción | `#ff7154` | `#ff7154` |

Los demás colores de la paleta (`#f0f4ef` hueso, `#bfcc94` salvia) se usan en superficies
elevadas, en la silueta de las islas y en la rampa del mapa de calor, que va de azul claro
a salvia y de ahí a coral.

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
en los datos, solo 2 aparecían indexados. (Providencia, en cambio, está bien mapeada: sus
18 localidades salieron de OSM con coordenada verificable.) Por eso 24 de las 65 ubicaciones
son aproximadas y necesitan conocimiento local.

La pestaña **Editor de barrios** existe para eso:

- Mapa satelital (Esri) o callejero (OSM) para reconocer el terreno.
- La lista está ordenada por número de contratos, así se arregla primero lo que más pesa.
  Los chips marcan el origen: `OSM`, `aprox` o `editado`.
- El conmutador **San Andrés / Providencia** cambia de isla; la lista y los marcadores
  siguen a la isla activa, y los barrios nuevos se crean en ella.
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
(nombre → lat/lon/origen/isla) y `alias` (texto normalizado → barrio).

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
scripts/fetch_geo.py       contornos de las 3 islas desde Overpass, cosidos y simplificados
scripts/geocode_barrios.py geocodificación inicial contra OSM/Nominatim
scripts/build_data.py      une ambas fuentes + gazetteer -> public/data/*.json
data/gazetteer.json        barrios (con isla) y alias — editable a mano o desde el editor
lib/gobiernos.ts           períodos constitucionales de la Gobernación
app/page.tsx               portada (prerenderizada en el build)
app/contratos/page.tsx     explorador: mapa, listado y editor
lib/legal.ts               responsable, fuentes y marco normativo del pie de página
components/, lib/          resto de la aplicación Next.js
```

Los JSON que consume el navegador van codificados con diccionarios (el objeto del contrato
solo se representa una vez y los prefijos constantes de id se guardan aparte): 10,6 MB en
crudo, ~1,9 MB comprimidos. Se cargan una sola vez — medido en el navegador, 78 ms de
descarga y parseo más 72 ms para construir el índice de búsqueda — y así el filtrado sobre
los 37.955 contratos es instantáneo sin backend.

## Fuentes y marco legal

- Contratos: [dataset `jbjy-vk9h`](https://www.datos.gov.co/d/jbjy-vk9h) (SECOP II) y
  [dataset `f789-7hwg`](https://www.datos.gov.co/d/f789-7hwg) (SECOP I), en datos.gov.co.
  El SECOP lo administra Colombia Compra Eficiente.
- Contornos de las islas y ubicación de barrios: © colaboradores de OpenStreetMap (ODbL)
- Imagen satelital del editor: © Esri, Maxar, Earthstar Geographics

La reutilización de estos datos está amparada por la **Ley 1712 de 2014** (Transparencia y
Acceso a la Información Pública Nacional), que define los datos abiertos como información
pública reutilizable de forma libre y sin restricciones, y por los
[términos de uso de datos.gov.co](https://herramientas.datos.gov.co/terminos), que autorizan
expresamente redistribuir, compilar, extraer, copiar, difundir, modificar y adaptar lo
publicado en el portal. Complementan el marco el Decreto 1081 de 2015 y la Resolución 3564
de 2015 del MinTIC.

Este es un sitio **independiente**, sin vínculo ni respaldo de la Gobernación del
Archipiélago, de Colombia Compra Eficiente ni de ninguna entidad pública. Presenta los datos
tal como los publica el Estado; para efectos oficiales hay que consultar el SECOP.
La identidad del proyecto (marca, responsable, contacto) se configura en
[`lib/legal.ts`](lib/legal.ts).
