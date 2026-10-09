"""Fixtures sintéticas exclusivas de pruebas; nunca se publican en el catálogo."""
import copy
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch

from scraper import Client, extract, main


def product():
    return {'productName': 'LOSARTAN 50 MG (TEST)', 'Principio activo': ['LOSARTAN'],
            'brand': 'TEST', 'Presentacionunidadmedida': ['CAJA X 30 TAB'],
            'Cantidadunidadesmedida': ['30.00'], 'Unidadmedida': ['TABLETA'],
            'link': 'https://www.larebajavirtual.com/test/p',
            'items': [{'itemId': 'test', 'sellers': [{'commertialOffer': {
                'IsAvailable': True, 'Price': 10000, 'ListPrice': 12000}}]}]}


class ExtractionTests(unittest.TestCase):
    def test_structured_pack_and_rounding(self):
        rows, error = extract(product(), '2026-10-08T12:00:00-05:00')
        self.assertIsNone(error)
        self.assertEqual(rows[0]['unidades'], 30)
        self.assertEqual(rows[0]['precio_unidad'], '333.33')
        self.assertEqual(rows[0]['concentracion'], '50 MG')

    def test_unsafe_or_ambiguous_products_are_excluded(self):
        changes = [
            {'Principio activo': ['LOSARTAN', 'HIDROCLOROTIAZIDA']},
            {'Principio activo': ['LOSARTAN/HIDROCLOROTIAZIDA']},
            {'productName': 'LOSARTAN HCT 50 MG'},
            {'productName': 'LOSARTAN 50 MG + 12.5 MG'},
            {'productName': 'LOSARTAN 50 MG/5 ML'},
            {'productName': 'LOSARTAN 50 MG XR'},
            {'productName': 'LOSARTAN 50 MG MASTICABLE'},
            {'productName': 'OTRO MEDICAMENTO 50 MG'},
            {'productName': 'LOSARTAN SIN CONCENTRACION'},
            {'Cantidadunidadesmedida': ['60']},
            {'Presentacionunidadmedida': ['CAJA']},
            {'Producto fraccionado': ['SI']},
            {'url': 'not-used', 'link': 'javascript:alert(1)'},
            {'link': 'https://otro-dominio.com/test/p'},
        ]
        for change in changes:
            with self.subTest(change=change):
                data = product(); data.update(change)
                rows, error = extract(data, '2026-10-08')
                self.assertEqual(rows, [])
                self.assertTrue(error)

    def test_unavailable_invalid_prices_and_kit(self):
        for key, value in [('IsAvailable', False), ('Price', 0), ('Price', -3), ('Price', 'NaN')]:
            data = product(); data['items'][0]['sellers'][0]['commertialOffer'][key] = value
            self.assertEqual(extract(data, '2026-10-08')[0], [])
        data = product(); data['items'][0]['isKit'] = True
        self.assertEqual(extract(data, '2026-10-08')[0], [])

    def test_multiple_variants_not_silently_priced(self):
        data = product(); data['items'].append(copy.deepcopy(data['items'][0]))
        self.assertEqual(extract(data, '2026-10-08')[0], [])

    def test_robots_disallow_stops_before_network(self):
        client = Client(0)
        self.assertGreaterEqual(client.delay, 1.5)
        client.robot = type('Robots', (), {'can_fetch': lambda *args: False})()
        with patch('urllib.request.urlopen') as request:
            with self.assertRaises(RuntimeError):
                client.get('https://www.larebajavirtual.com/blocked')
            request.assert_not_called()

    def test_failed_refresh_preserves_published_catalog(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'data').mkdir()
            published = root / 'data' / 'precios.csv'
            published.write_text('existing catalog', encoding='utf-8')
            with patch('scraper.ROOT', root), patch('sys.argv', ['scraper.py', '--publish']), \
                    patch.object(Client, 'check_robots', side_effect=RuntimeError('Test: bloqueo remoto')):
                self.assertEqual(main(), 1)
            self.assertEqual(published.read_text(encoding='utf-8'), 'existing catalog')


if __name__ == '__main__':
    unittest.main()
