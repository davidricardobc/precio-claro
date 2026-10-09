# Verificación de PrecioClaro

Fecha: 8 de octubre de 2026. Entrega local inicial.

## Actualización: panel de ahorro

- **12 pruebas Node correctas** tras agregar los casos de Cozaar, Dolex Activgel, empate, menor precio, unidades ausentes, aritmética inválida, dosis distinta, enlace inválido y empaques completos. Los 12 tests Python de la entrega anterior no cambian; no se alteró el scraper.
- Cozaar 50 mg de Locatel: Genfar de La Rebaja a COP 470/unidad, **96,65 %** y **COP 406.700** por 30 unidades.
- Dolex Activgel 500 mg, 10 cápsulas, Locatel: Genfar de Locatel a COP 203/unidad, **89,59 %** y **COP 17.470** por 10 unidades. Advertencia de forma distinta o desconocida, antes del porcentaje.
- Navegador: ambos ejemplos, mínimo ya alcanzado con Genfar, y ausencia de unidades con «Oferta Advil Max 400mg Pague 16 Lleve 20». Sin errores JavaScript.
- Modal nativo: Escape cierra, devuelve el foco al botón de origen; el botón de cerrar es accesible. Enlace a fuente separado de la acción de la tarjeta.
- Vista de **390 × 844 píxeles CSS**, comprobada con `innerWidth/innerHeight`: sin desbordamiento horizontal. Encabezado y aviso médico permanecen fuera del área interna de desplazamiento.
- Capturas revisadas: `artifacts/savings-desktop.png` y `artifacts/savings-mobile.png`. El navegador de QA tenía zoom del 66,7 %; se ajustó el viewport de captura para verificar el ancho CSS real de 390 px.
- Datos CSV sin modificaciones. Comparación económica por sustancia y concentración; no se afirma equivalencia terapéutica.

## Actualización: base del profesor y tres farmacias

- 563 filas descargadas sin modificar en `data/base.csv`; 39 filas locales, 37 reemplazos por URL y 2 incorporaciones. Resultado: 565.
- Comprobación independiente de preservación de valores: el multiconjunto de filas finales coincide exactamente con base sin coincidencias de La Rebaja más consulta local. Las tres entradas/salidas comparten las 12 columnas del profesor.
- Resumen y ranking calculados con Decimal; segundo cálculo independiente confirmó las tres mayores diferencias.
- Pruebas actuales: **12 Python y 8 Node correctas**, incluyendo ausencia de archivo local, conservación de variantes, rechazo de esquema inválido y nueva consulta que mantiene las farmacias importadas.
- Navegador: 565 registros, 498 ofertas comparables, tres farmacias en el filtro. Losartán 50 mg: 18 ofertas, distribuidas en 4 de La Rebaja, 6 de Locatel y 8 de Olímpica. Vista de 390 px sin desbordamiento horizontal.
- Las 67 filas no comparables siguen disponibles en el CSV. No se rellenaron los 10 precios unitarios ausentes.
- Se conservan las limitaciones de equivalencia terapéutica y de inventario por ciudad. Los datos de Locatel y Olímpica fueron importados, sin volver a consultar sus fichas.

La evidencia siguiente corresponde a la primera entrega de una farmacia y se conserva como historial.

Recorrido: catálogo público de La Rebaja → scraper → CSV validado → búsqueda en el navegador → presentación del precio por unidad → enlace de origen.

## Evidencia

| Límite del flujo | Resultado |
|---|---|
| robots.txt → consulta | robots.txt respondió 200 y permitió la ruta pública; User-Agent propio y mínimo 1,5 segundos entre consultas |
| API → extracción | 15 páginas consultadas, 456 productos únicos; 39 filas admitidas y 417 descartadas con razón |
| Extracción → archivo | `data/precios.csv`, `scrape-latest.csv`, `scrape-report.json` y `catalog-meta.json` generados; respuestas originales en `data/raw/` |
| Archivo → navegador | HTTP 200, 39 filas válidas, cero descartes adicionales por el validador del navegador |
| Búsqueda → presentación | Losartán 50 mg: 4 ofertas; 100 mg: 2 ofertas; búsqueda inexistente: 0 ofertas con mensaje específico |
| Orden por unidad | Amlodipino 5 mg: empaque de 30 a COP 24.840 aparece antes del de 10 a COP 8.830, porque COP 828/unidad es menor que COP 883/unidad |
| Enlace → fuente | Una ficha real de losartán respondió HTTP 200; enlaces HTTPS abren otra pestaña con `noopener noreferrer` |
| Celular y escritorio | Anchos 360, 390, 768 y 1440: sin desbordamiento horizontal; aviso médico dentro del viewport |
| Ampliación | Simulación CSS al 200 % sin desbordamiento horizontal. No equivale a una auditoría completa con tecnologías de asistencia |
| Teclado | Tab desde la búsqueda alcanza el botón Buscar; foco visible |
| Error remoto | Un HTTP 503 simulado para el CSV muestra «No pudimos cargar los precios» y no muestra ofertas inventadas |
| JavaScript | Sin errores de ejecución en los recorridos probados; `node --check` correcto en ambos módulos |
| Archivos privados | Servidor devuelve 404 para `/.git/config`, `/data/raw/` y `/scraper.py`; solo expone la lista de archivos públicos |

## Pruebas automatizadas

- `python -m unittest discover -s tests -v`: **6 pruebas correctas**, incluyendo bloqueo por robots, cálculo con redondeo, rechazo de mezclas y preservación del catálogo ante una falla.
- `node --test tests/catalog.test.mjs`: **6 pruebas correctas**, incluyendo CSV con comillas y saltos de línea, datos inválidos, separación de grupos, comparación por unidad y el catálogo real.
- AGENTS.md y CLAUDE.md comparados: iguales.

Los datos de prueba sintéticos no se incorporan a `data/precios.csv`. La prueba de fallo de actualización usa un directorio temporal independiente.

## Evidencia visual local

`artifacts/desktop.png` y `artifacts/mobile.png`, fuera de Git. Se inspeccionaron ambas capturas. El aviso fijo puede aparecer en medio de una captura de página completa porque corresponde al borde inferior del viewport, no al final del documento.

## Límites y pendientes

- Una farmacia conectada. La comparación entre cadenas queda pendiente de recibir o conectar sus datos.
- La consistencia automática no sustituye verificación farmacéutica. Las fichas ambiguas se excluyen y se conservan para revisar.
- No se probaron compra, domicilios o disponibilidad por ciudad: no forman parte de esta demo.
- El adaptador opcional WebMCP está protegido por detección de disponibilidad. El navegador de pruebas no expuso `document.modelContext`; no se verificó en un navegador compatible. La búsqueda normal sí se verificó.
- No se realizó una auditoría completa de accesibilidad.
- Sin pruebas de hosting porque no se ha autorizado ni realizado ninguna publicación.
