"""Une la base de la clase y la consulta local sin inventar ni corregir precios."""
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
import unicodedata

ROOT = Path(__file__).resolve().parent
BASE_URL = 'https://raw.githubusercontent.com/celismx/recetapp-datos/main/data/precios.csv'
FIELDS = ['fecha', 'farmacia', 'principio_activo', 'concentracion', 'producto', 'marca',
          'presentacion', 'unidades', 'precio', 'precio_lista', 'precio_unidad', 'url']


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value.strip())
                   if not unicodedata.combining(c)).upper()


def read_csv(path):
    with path.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != FIELDS:
            raise ValueError(f'{path.name}: se esperaban las 12 columnas de la clase')
        rows = list(reader)
        if any(None in r or any(v is None for v in r.values()) for r in rows):
            raise ValueError(f'{path.name}: hay filas incompletas')
        return rows


def positive(value):
    try:
        number = Decimal(value)
        return number if number.is_finite() and number > 0 else None
    except (InvalidOperation, ValueError):
        return None


def merge_rows(base, today):
    # La regla de la clase aplica a La Rebaja por URL. Las variantes de otras
    # farmacias (misma URL, distinto empaque) conservan todas sus filas.
    if any(norm(r['farmacia']) != 'LA REBAJA' or not r['url'].strip() for r in today):
        raise ValueError('La consulta local debe tener URL y corresponder a La Rebaja')
    today_urls = {r['url'].strip() for r in today}
    kept = [r for r in base if not (norm(r['farmacia']) == 'LA REBAJA' and r['url'].strip() in today_urls)]
    replaced = len(base) - len(kept)
    rows = kept + today
    rows.sort(key=lambda r: (norm(r['principio_activo']), norm(r['concentracion']), norm(r['farmacia']), r['url'], r['presentacion']))
    return rows, replaced


def summarize(rows):
    valid_unit = [r for r in rows if positive(r['precio_unidad']) is not None]
    grouped = defaultdict(list)
    for row in valid_unit:
        if row['marca'].strip() and row['principio_activo'].strip() and row['concentracion'].strip():
            grouped[(norm(row['principio_activo']), norm(row['concentracion']))].append(row)
    ranked = []
    for (active, concentration), offers in grouped.items():
        # Busca los extremos que correspondan a marcas distintas.
        pairs = [(low, high) for low in offers for high in offers
                 if norm(low['marca']) != norm(high['marca'])
                 and positive(high['precio_unidad']) > positive(low['precio_unidad'])]
        if not pairs:
            continue
        low, high = max(pairs, key=lambda pair: positive(pair[1]['precio_unidad']) - positive(pair[0]['precio_unidad']))
        difference = positive(high['precio_unidad']) - positive(low['precio_unidad'])
        ranked.append({'principio_activo': active, 'concentracion': concentration,
                       'diferencia_cop': str(difference), 'menor': low, 'mayor': high})
    ranked.sort(key=lambda r: Decimal(r['diferencia_cop']), reverse=True)
    return {'filas': len(rows), 'filas_por_farmacia': dict(sorted(Counter(r['farmacia'] for r in rows).items())),
            'principios_activos': len({norm(r['principio_activo']) for r in rows if r['principio_activo'].strip()}),
            'filas_con_precio_unidad': len(valid_unit),
            'porcentaje_con_precio_unidad': round(100 * len(valid_unit) / len(rows), 2) if rows else 0,
            'filas_sin_precio_unidad': len(rows) - len(valid_unit),
            'urls_con_varias_filas': sum(n > 1 for n in Counter(r['url'] for r in rows).values()),
            'top_3_diferencias': ranked[:3]}


def write_csv(path, rows):
    temporary = path.with_suffix('.tmp')
    with temporary.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def merge_catalog(root=ROOT):
    base_path = root / 'data/base.csv'
    today_path = root / 'data/scrapeado-hoy.csv'
    base = read_csv(base_path)
    today = read_csv(today_path) if today_path.exists() else []
    if not base:
        raise ValueError('La base no tiene filas; se conserva el catálogo anterior')
    rows, replaced = merge_rows(base, today)
    report = summarize(rows)
    report.update({'base_url': BASE_URL, 'base_sha256': hashlib.sha256(base_path.read_bytes()).hexdigest(),
                   'filas_base': len(base), 'filas_consulta_local': len(today),
                   'filas_base_reemplazadas': replaced,
                   'filas_nuevas': sum(r['url'] not in {b['url'] for b in base if norm(b['farmacia']) == 'LA REBAJA'} for r in today),
                   'consulta_local_presente': today_path.exists(),
                   'generado_en': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                   'metodo_ranking': 'Mayor diferencia absoluta de precio_unidad entre marcas distintas dentro de principio_activo + concentracion. Describe los datos; no afirma equivalencia de formas farmacéuticas.'})
    target = root / 'data/precios.csv'
    if target.exists():
        archive = root / 'data/archive'
        archive.mkdir(exist_ok=True)
        (archive / ('before-merge-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%f') + '.csv')).write_bytes(target.read_bytes())
    write_csv(target, rows)
    (root / 'data/merge-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    (root / 'data/catalog-meta.json').write_text(json.dumps({
        'consultado_en': max(r['fecha'] for r in rows), 'farmacias': list(report['filas_por_farmacia']),
        'filas': len(rows), 'fuentes': [BASE_URL, 'data/scrapeado-hoy.csv'] if today else [BASE_URL],
        'alcance': 'Base del profesor más consulta local de La Rebaja. Sin verificación nueva de Locatel u Olímpica.'
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    print(json.dumps(merge_catalog(), ensure_ascii=True, indent=2))
