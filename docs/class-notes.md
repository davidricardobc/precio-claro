# Material de la clase y adaptación

Fecha: 8 de octubre de 2026. Fuente: tres capturas compartidas por David en la conversación. Esta nota registra el contenido recibido, no una transcripción completa del curso.

## Captura 1: del catálogo al enlace público

La clase propone farmacias colombianas → CSV → aplicación estática → GitHub Pages. Cita La Rebaja, Locatel y Olímpica. Menciona 563 productos en una base del profesor, que todavía no se ha recibido.

Adaptación: nombre propio **PrecioClaro**, identidad verde bosque y verde claro, lema «Cada unidad cuenta». Conservamos un comparador útil, no una página promocional. Publicar queda para después de la revisión de David.

## Captura 2: instrucciones del proyecto

Se pide Git, instrucciones en CLAUDE.md, HTML/CSS/JavaScript sin frameworks ni build, español colombiano, COP, diseño móvil, CSV leído en el navegador, precios con farmacia y fecha, comparación por unidad y aviso médico.

Implementado con AGENTS.md y CLAUDE.md iguales para continuar tanto con Claude como con Codex. Se evita afirmar equivalencia médica por compartir sustancia.

## Captura 3: scraper de La Rebaja

API pública: `https://www.larebajavirtual.com/api/catalog_system/pub/products/search`.

La clase pide biblioteca estándar Python, robots.txt, User-Agent propio, 1,5 segundos entre consultas, 10 términos, exclusión de combinaciones y líquidos y exportación de precios.

Diferencias observadas al ejecutar:

- El nombre no siempre incluye la cantidad. La presentación está en `Presentacionunidadmedida` y se contrasta con `Cantidadunidadesmedida`.
- Algunas búsquedas tienen más de 50 resultados. Se agregó paginación y deduplicación por producto.
- Hay metadatos que no permiten corroborar el principio activo con el nombre. Se guardan como descartes; no se arreglan por intuición.
- Las presentaciones fraccionadas, kits y múltiples SKU requieren un tratamiento distinto. Se excluyen de esta primera versión.
- Las respuestas públicas se conservan localmente para auditar de dónde salió cada dato.

## A medida que llegue más material

1. Revisar e importar la base del profesor con procedencia y fecha.
2. Conectar las otras farmacias según lo que cubra la clase.
3. Ampliar la normalización solo con evidencia suficiente.
4. Definir frecuencia y condiciones de actualización cuando se pida automatización.
5. Revisar la demo antes de autorizar una publicación.

## Captura 4: descargar, unir y explicar la base

Recibida e implementada el 8 de octubre. Se descargó `https://raw.githubusercontent.com/celismx/recetapp-datos/main/data/precios.csv` en `data/base.csv`, con 563 filas y 12 columnas. Se unió con nuestra consulta por URL de La Rebaja, con preferencia por la local. La salida conserva exactamente esas 12 columnas. El caso sin consulta local está implementado y probado.

Resultado: 565 filas, 25 principios activos, 98,23 % con precio por unidad. Ver `docs/data-summary.md` para el desglose por farmacia y las tres diferencias mayores entre marcas. El punto 1 de pendientes queda completado; las fuentes Locatel y Olímpica ya están importadas, pero sus scrapers propios siguen pendientes.

## Captura 5: el momento del ahorro

Se agregó «Misma sustancia, más barato» al seleccionar una tarjeta, con el mínimo por unidad para sustancia + concentración, diferencia porcentual, ahorro proporcional en pesos y enlace a farmacia. También informa cuando el producto ya tiene el precio mínimo o no hay unidades válidas.

Los ejemplos de la clase se comprobaron con datos reales: Cozaar 50 mg de Locatel → Genfar de La Rebaja, 96,65 %; Dolex Activgel de 10 cápsulas → Genfar de Locatel, 89,59 %. El segundo compara presentaciones distintas o no identificadas completamente. Esa limitación aparece antes de la cifra, sin sugerir una sustitución médica.

Se conserva el criterio más estricto de la lista principal. El nuevo panel es una comparación económica y además muestra el costo de empaques completos para que un ahorro proporcional no parezca un precio de compra.
