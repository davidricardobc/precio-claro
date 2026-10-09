# Unión de datos de la clase

Fecha de los precios: 8 de octubre de 2026.

Fuente de la base: [CSV de la clase](https://raw.githubusercontent.com/celismx/recetapp-datos/main/data/precios.csv), descargado sin cambios como `data/base.csv`. SHA-256 y detalle reproducible en `data/merge-report.json`.

## Unión

- Base: 563 filas.
- Consulta local de La Rebaja: 39 filas. Se convirtió `scrape-latest.csv` a `scrapeado-hoy.csv` conservando las 12 columnas del profesor y sus valores.
- Reemplazos: 37 filas de la base con la misma URL de La Rebaja.
- URL nuevas: 2.
- Resultado: **563 − 37 + 39 = 565 filas** en `data/precios.csv`.
- Las variantes de Locatel y Olímpica con una URL compartida se conservan. Hay 7 URL con varias filas.
- Si falta `scrapeado-hoy.csv`, `python merge_data.py` usa solo la base. No hay relleno de precios o eliminación de filas por datos faltantes.

## Resumen del CSV unido

| Farmacia | Filas |
|---|---:|
| La Rebaja | 164 |
| Locatel | 189 |
| Olímpica | 212 |
| Total | 565 |

**25 principios activos distintos**, normalizando tildes y mayúsculas para el conteo. **555 filas con precio por unidad positivo**, equivalentes al **98,23 %**. Las **10 restantes** conservan el campo vacío.

## Tres grupos con mayor diferencia entre marcas

Ranking por diferencia absoluta en COP entre dos marcas distintas, agrupando solamente por `principio_activo + concentracion`, como pide la clase. Se toman los valores de `precio_unidad` tal como aparecen en el archivo. No es un ranking de ahorro terapéutico ni certifica que las presentaciones sean intercambiables.

| Grupo | Menor precio por unidad | Mayor precio por unidad | Diferencia por unidad |
|---|---:|---:|---:|
| Azitromicina 500 mg | $4.000,00 | $36.416,67 | **$32.416,67** |
| Sildenafil 100 mg | $12.500,00 | $36.400,00 | **$23.900,00** |
| Rosuvastatina 40 mg | $1.810,71 | $25.320,00 | **$23.509,29** |

Extremos identificados en el CSV:

- Azitromicina: Memphis en La Rebaja, caja de 3 tabletas, frente a Tromix de Lafrancol Farma en Olímpica, caja de 3 tabletas.
- Sildenafil: American Generics en Locatel, una tableta, frente a Viagra en La Rebaja, una tableta.
- Rosuvastatina: MK (etiqueta `Mkgenerico`) en Olímpica, caja de 28 tabletas, frente a Cardiomax de Lafrancol Farma en Olímpica, caja de 10 tabletas.

El informe JSON incluye los enlaces, presentación, precio del empaque, marca y fecha de cada extremo.

## Vista web

El archivo tiene 565 registros. La comparación admite **498** y deja **67** fuera de la vista por campos insuficientes, formas no soportadas, enlaces o aritmética inválidos. Esto incluye las 10 filas sin precio por unidad. Todas permanecen en el CSV.

La web separa además la forma farmacéutica y la liberación que pueda identificar en la descripción. No supone que un blíster sin forma declarada sea una tableta ni que la liberación no informada sea inmediata. El ranking de esta nota es el análisis solicitado del archivo completo y usa un criterio distinto al agrupamiento conservador de la interfaz.

Locatel y Olímpica provienen de la base del profesor. En esta actualización se descargó ese archivo y se unió con la consulta local existente; no se volvió a consultar cada ficha de esas farmacias.
