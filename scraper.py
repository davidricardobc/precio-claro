"""PrecioClaro: consulta manual del catálogo público VTEX, sin dependencias."""
import argparse
import csv
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = 'https://www.larebajavirtual.com'
AGENT = 'PrecioClaro/0.1 (educational price comparison; manual collection)'
TERMS = ['losartan', 'acetaminofen', 'ibuprofeno', 'atorvastatina', 'metformina',
         'omeprazol', 'loratadina', 'amlodipino', 'dolex', 'advil']
ACTIVES = set(TERMS[:-2])
FIELDS = ['fecha', 'farmacia', 'principio_activo', 'concentracion', 'producto',
          'marca', 'presentacion', 'unidades', 'precio', 'precio_lista',
          'precio_unidad', 'url', 'forma', 'liberacion', 'sku']
BOGOTA = timezone(timedelta(hours=-5))


def norm(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(value))
                   if not unicodedata.combining(c)).lower().strip()


def field(product, name):
    value = product.get(name, [])
    return ' '.join(str(v) for v in value) if isinstance(value, list) else str(value)


def number(value):
    try:
        result = Decimal(str(value))
        return result if result.is_finite() and result > 0 else None
    except (InvalidOperation, ValueError):
        return None


def money(value):
    return str(value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def extract(product, timestamp):
    """Conservador: una identidad química explícita y una presentación inequívoca."""
    name = str(product.get('productName', '')).strip()
    active_values = product.get('Principio activo', [])
    if not isinstance(active_values, list) or len(active_values) != 1:
        return [], 'principio activo ausente o múltiple'
    active = norm(active_values[0])
    if active not in ACTIVES:
        return [], 'principio activo fuera de alcance o combinación'
    # Se observaron metadatos erróneos en la fuente. No confiar solo en esa columna.
    # Las marcas sin sustancia en el nombre quedan pendientes de verificación humana.
    active_pattern = r'\b' + re.escape(active) + (r'e?\b' if active == 'omeprazol' else r'\b')
    if not re.search(active_pattern, norm(name)):
        return [], 'principio activo no corroborado en el nombre'
    if re.search(r'[+/]|\bhct\b|\bcompuesto\b', norm(name)):
        return [], 'combinación o concentración ambigua'
    presentation = field(product, 'Presentacionunidadmedida').strip()
    if field(product, 'Producto fraccionado').upper() == 'SI':
        return [], 'venta fraccionada fuera de alcance'
    text = norm(name + ' ' + presentation + ' ' + field(product, 'Unidadmedida'))
    if re.search(r'\b(ml|jarabe|suspension|gotas|solucion|inyectable|crema|gel|polvo|sobre)\b', text):
        return [], 'forma no incluida'
    strengths = re.findall(r'(?<![\d.,])(\d+(?:[.,]\d+)?)\s*(mg|mcg|g)\b', norm(name))
    if len(strengths) != 1:
        return [], 'concentración ausente o ambigua'
    amount, unit = strengths[0]
    dose = Decimal(amount.replace(',', '.'))
    if dose <= 0:
        return [], 'concentración inválida'
    if unit == 'g':
        dose *= 1000
        unit = 'mg'
    concentration = f'{dose.normalize():f} {unit.upper()}'
    if re.search(r'\b(cap|caps|capsula|capsulas)\b', text):
        form = 'capsula'
    elif re.search(r'\b(tab|tabs|tableta|tabletas|comprimido|comprimidos)\b', text):
        form = 'tableta'
    else:
        return [], 'forma farmacéutica no identificada'
    # Evitar agrupar formas especiales como si fueran tabletas/cápsulas comunes.
    if re.search(r'\b(masticable|efervescente|sublingual|bucodispersable|blanda|blandas|liqui|liquid)\b', text):
        return [], 'forma especial pendiente de normalización'
    if re.search(r'\b(xr|sr|cr|lp|retard)\b|liberacion (prolongada|modificada|retardada)', text):
        return [], 'liberación modificada fuera de alcance'
    if re.search(r'gastroresistente|enteric|liberacion retardada', text):
        return [], 'recubrimiento especial fuera de alcance'
    unit_counts = re.findall(r'\bx\s*(\d+)\s*(?:tab|caps?|tabletas?|capsulas?|comprimidos?)\b', norm(presentation))
    if len(unit_counts) != 1:
        return [], 'cantidad por empaque ausente o ambigua'
    units = int(unit_counts[0])
    structured_units = number(field(product, 'Cantidadunidadesmedida'))
    if units <= 0 or (structured_units is not None and structured_units != units):
        return [], 'cantidad por empaque inconsistente'
    items = product.get('items', [])
    if len(items) != 1:
        return [], 'variantes múltiples o SKU ausente'
    item = items[0]
    if item.get('isKit'):
        return [], 'kit fuera de alcance'
    if item.get('measurementUnit', 'un') != 'un' or item.get('unitMultiplier', 1) != 1:
        return [], 'multiplicador de venta no soportado'
    sellers = item.get('sellers', [])
    offer = sellers[0].get('commertialOffer', {}) if sellers else {}
    if offer.get('IsAvailable') is not True:
        return [], 'sin disponibilidad'
    price = number(offer.get('Price'))
    if price is None:
        return [], 'precio inválido'
    list_price = number(offer.get('ListPrice'))
    url = str(product.get('link', ''))
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ['www.larebajavirtual.com', 'larebajavirtual.com'] or not parsed.path.endswith('/p'):
        return [], 'enlace de producto inválido'
    return [dict(zip(FIELDS, [timestamp, 'La Rebaja', active, concentration, name,
        str(product.get('brand', '')), presentation, units, money(price),
        money(list_price) if list_price else '', money(price / units), url, form,
        'no especificada', str(item.get('itemId', ''))]))], None


class Client:
    def __init__(self, delay):
        self.delay = max(1.5, delay)
        self.last = 0.0
        self.robot = None

    def get(self, url):
        if self.robot is not None and not self.robot.can_fetch(AGENT, url):
            raise RuntimeError('robots.txt no permite esta consulta: ' + url)
        time.sleep(max(0, self.delay - (time.monotonic() - self.last)))
        self.last = time.monotonic()
        request = urllib.request.Request(url, headers={'User-Agent': AGENT, 'Accept': 'application/json,text/plain'})
        with urllib.request.urlopen(request, timeout=25) as response:
            if urllib.parse.urlparse(response.url).hostname != urllib.parse.urlparse(BASE).hostname:
                raise RuntimeError('Redirección a otro dominio; consulta detenida')
            return response.read().decode('utf-8-sig')

    def check_robots(self):
        text = self.get(BASE + '/robots.txt')
        if '<html' in text.lower() or not re.search(r'(?im)^\s*user-agent\s*:', text):
            raise RuntimeError('robots.txt no es válido; consulta detenida')
        self.robot = urllib.robotparser.RobotFileParser()
        self.robot.parse(text.splitlines())
        self.delay = max(self.delay, self.robot.crawl_delay(AGENT) or 0)
        return text


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    with temporary.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish', action='store_true', help='Actualizar CSV local de la web tras consulta completa')
    parser.add_argument('--terms', nargs='+', choices=TERMS, default=TERMS)
    parser.add_argument('--max-pages', type=int, default=4)
    args = parser.parse_args()
    if args.max_pages < 1:
        parser.error('--max-pages debe ser positivo')
    now = datetime.now(BOGOTA)
    stamp = now.isoformat(timespec='seconds')
    raw_dir = ROOT / 'data' / 'raw' / now.strftime('%Y%m%dT%H%M%S')
    raw_dir.mkdir(parents=True, exist_ok=True)
    report = {'consultado_en': stamp, 'fuente': BASE, 'user_agent': AGENT,
              'terminos': args.terms, 'consultas': [], 'descartes': [], 'errores': [], 'publicado': False}
    client = Client(1.5)
    rows, seen = [], set()
    try:
        (raw_dir / 'robots.txt').write_text(client.check_robots(), encoding='utf-8')
        for term in args.terms:
            for page in range(args.max_pages):
                params = urllib.parse.urlencode({'ft': term, '_from': page * 50, '_to': page * 50 + 49})
                url = BASE + '/api/catalog_system/pub/products/search?' + params
                text = client.get(url)
                products = json.loads(text)
                if not isinstance(products, list):
                    raise RuntimeError('La API no devolvió una lista de productos')
                (raw_dir / f'{term}-{page}.json').write_text(text, encoding='utf-8')
                report['consultas'].append({'termino': term, 'url': url, 'productos': len(products)})
                print(f'{term}: página {page + 1}, {len(products)} productos', flush=True)
                for product in products:
                    key = product.get('productId') or product.get('link')
                    if not key or key in seen:
                        continue
                    seen.add(key)
                    extracted, reason = extract(product, stamp)
                    rows.extend(extracted)
                    if reason:
                        report['descartes'].append({'producto': product.get('productName'), 'razon': reason})
                if len(products) < 50:
                    break
                if page == args.max_pages - 1:
                    raise RuntimeError(f'Paginación incompleta en {term}; no se publica un catálogo parcial')
    except (urllib.error.URLError, TimeoutError, OSError, ValueError, RuntimeError, KeyError, TypeError) as error:
        report['errores'].append(f'{type(error).__name__}: {error}')
        print('Consulta detenida:', error, file=sys.stderr)
    rows.sort(key=lambda r: (r['principio_activo'], r['concentracion'], r['forma'], Decimal(r['precio_unidad'])))
    write_csv(ROOT / 'data' / 'scrape-latest.csv', rows)
    report['filas_validas'] = len(rows)
    report['productos_unicos'] = len(seen)
    report['resumen_descartes'] = dict(Counter(d['razon'] for d in report['descartes']))
    if args.publish and rows and not report['errores']:
        target = ROOT / 'data' / 'precios.csv'
        if target.exists():
            archive = ROOT / 'data' / 'archive'
            archive.mkdir(exist_ok=True)
            (archive / f'prices-{now.strftime("%Y%m%dT%H%M%S")}.csv').write_bytes(target.read_bytes())
        write_csv(target, rows)
        report['publicado'] = True
        # Se actualiza solo junto a un catálogo válido; no oculta fallas posteriores.
        (ROOT / 'data' / 'catalog-meta.json').write_text(json.dumps({
            'consultado_en': stamp, 'farmacias': ['La Rebaja'], 'filas': len(rows),
            'alcance': 'Consulta manual; sin ubicación de entrega. No incluye transporte.',
            'fuente': BASE, 'terminos': args.terms}, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'data' / 'scrape-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'{len(rows)} ofertas válidas. CSV web actualizado: {report["publicado"]}')
    for row in rows:
        if row['principio_activo'] == 'losartan':
            print(f'  {row["producto"]} | {row["presentacion"]} | COP {row["precio"]} | COP {row["precio_unidad"]}/unidad')
    return 1 if report['errores'] or not rows else 0


if __name__ == '__main__':
    sys.exit(main())
