# PrecioClaro

**Cada unidad cuenta.** Comparador educativo de precios de medicamentos en Colombia. Proyecto propio de David, desarrollado desde el material de una clase y preparado como demo de contenido. Nombre de trabajo, sin búsqueda de disponibilidad de marca.

## Abrir

En Windows, ejecutar `start.cmd` y abrir **http://127.0.0.1:8765**. Requiere Python 3.10 o posterior. También sirve `python serve.py` desde esta carpeta.

No abrir `index.html` por doble clic: el navegador necesita HTTP para leer el CSV. La web no requiere backend de aplicación, cuentas, claves API ni compilación. Las tipografías se descargan de Google Fonts y tienen alternativas del sistema.

## Primera entrega, 8 de octubre de 2026

- Marca PrecioClaro, diseño adaptable a celular y escritorio.
- Búsqueda por principio activo o marca, tolerante a tildes y mayúsculas.
- Grupos separados por principio activo, concentración, forma y liberación declarada.
- Orden por precio por unidad, con precio completo del empaque visible.
- Fuente, fecha de consulta y enlace a farmacia por oferta.
- Aviso médico persistente, estados sin resultados y error de catálogo.
- Scraper estándar Python, paginación, robots.txt, identificación y pausa mínima de 1,5 segundos.
- **39 ofertas válidas de La Rebaja**, tras revisar **456 productos únicos** obtenidos en **15 consultas** para 10 términos.
- No hay datos de Locatel u Olímpica todavía. Tampoco se ha recibido el CSV de 563 productos mencionado por la clase. No se inventaron registros para reemplazarlo.
- Todo local. Sin repositorio remoto, despliegue, compras ni programación automática.

## Datos y actualización

```powershell
python scraper.py
python scraper.py --publish
```

El primer comando prepara `data/scrape-latest.csv` y `data/scrape-report.json`. El segundo también actualiza el catálogo **local** de la web en `data/precios.csv`, solo si terminó la consulta completa y hay registros válidos. `--publish` no hace push ni despliegue.

Las respuestas originales y robots.txt se guardan en `data/raw/<fecha-hora>/`; las versiones anteriores del catálogo, en `data/archive/`. Ambas carpetas quedan fuera de Git. Ante errores de red, bloqueos o paginación incompleta, se conserva el CSV publicado anterior. El informe de ejecución registra la falla.

El scraper consulta losartán, acetaminofén, ibuprofeno, atorvastatina, metformina, omeprazol, loratadina, amlodipino, Dolex y Advil. Las búsquedas por marca pueden no producir ofertas admitidas: no se infiere una sustancia por marca.

Columnas del CSV:

`fecha,farmacia,principio_activo,concentracion,producto,marca,presentacion,unidades,precio,precio_lista,precio_unidad,url,forma,liberacion,sku`

Los precios originales son los del campo `Price` de VTEX, en pesos, no centavos. `precio_unidad` se calcula automáticamente con redondeo a dos decimales. No editar precios a mano. Si llega el CSV del profesor, se revisará su esquema, procedencia y fecha antes de importarlo.

## Límites de la comparación

- Consulta manual del catálogo público, sin ciudad de entrega ni sesión de comprador. No incorpora domicilio, descuentos personalizados o comprobación de inventario en tiempo real.
- El mínimo mostrado corresponde únicamente al grupo y las farmacias visibles. No afirma ser el menor precio de Colombia.
- El catálogo presenta inconsistencias. Se exige que la sustancia declarada también aparezca en el nombre; las marcas sin esa corroboración se dejan fuera para revisión. Esto reduce cobertura deliberadamente.
- Se excluyen mezclas, líquidos, venta fraccionada, kits, variantes ambiguas, liberación modificada explícita, formas especiales y ofertas sin disponibilidad.
- La ausencia de información sobre liberación se muestra como **no especificada**, nunca como inmediata. La agrupación es descriptiva y no certifica equivalencia terapéutica.
- Los datos públicos pueden contener otros errores. Hay que confirmar presentación, precio final y disponibilidad en la farmacia.

## Verificar

```powershell
python -m unittest discover -s tests -v
node --test tests/catalog.test.mjs
node --check app.mjs
node --check catalog.mjs
```

Node 18 o posterior solo se usa para pruebas, no para ejecutar la web. Los fixtures sintéticos viven únicamente en `tests/`.

Detalles de pruebas y pendientes: `docs/verification.md`. Material recibido: `docs/class-notes.md`. Tomas sugeridas para la demo: `docs/video-notes.md`.

## Publicar más adelante

Preparado para alojamiento estático con rutas relativas. Archivos públicos necesarios: `index.html`, `styles.css`, `app.mjs`, `catalog.mjs`, `data/precios.csv` y opcionalmente `data/catalog-meta.json`. El servidor local expone solo estos archivos.

GitHub Pages es el destino de referencia de la clase. Todavía no se configuró un remoto ni una publicación. Antes de cualquier push o despliegue, presentar pruebas, impacto y recuperación, y esperar el sí explícito de David.
