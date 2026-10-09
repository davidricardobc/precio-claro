# PrecioClaro

Comparador educativo de precios de medicamentos en Colombia, creado por David a partir de una clase. Prioridad: contenido y portafolio. Nombre de trabajo, sin verificación de marca.

- Web estática: HTML, CSS y JavaScript, sin frameworks ni compilación. Compatible con GitHub Pages mediante rutas relativas.
- Interfaz en español de Colombia; moneda COP. Diseño primero para celular.
- El navegador lee `data/precios.csv`. Nunca inventar ni editar precios a mano. Los datos sintéticos se limitan a pruebas aisladas.
- Cada oferta muestra farmacia, fecha de consulta, presentación, precio total, precio por unidad y enlace a la fuente.
- Comparar por principio activo, concentración, forma farmacéutica y liberación. No declarar equivalencia terapéutica ni recomendar sustituciones.
- Aviso visible: «PrecioClaro compara precios; no reemplaza la indicación de tu médico o farmacéutico».
- Scraper Python con biblioteca estándar. Consultar robots.txt, User-Agent propio y pausa mínima de 1,5 segundos. Detenerse ante bloqueos; no evadir controles.
- Descartar combinaciones, líquidos, datos ambiguos y ofertas sin disponibilidad. Guardar razones de descarte y respuestas públicas para auditoría local.
- Conservar datos vigentes si una actualización falla. Publicación del CSV explícita con `--publish` tras una ejecución completa.
- Mantener AGENTS.md y CLAUDE.md sincronizados.
- Commits locales autorizados tras validar. Push, deploy, DNS, pagos y publicación requieren aprobación explícita de David.
- No leer ni guardar secretos. No borrar archivos ajenos.

## Comandos

`python scraper.py` consulta y crea `data/scrape-latest.csv` sin cambiar el catálogo de la web.

`python scraper.py --publish` actualiza también `data/precios.csv` si todas las consultas terminaron y hay filas válidas.

`python -m unittest discover -s tests` prueba extracción y límites de comparación.

`node --test tests/catalog.test.mjs` prueba CSV, validación y agrupación.

`python serve.py` abre un servidor local en http://127.0.0.1:8765.
