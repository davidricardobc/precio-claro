import csv
import tempfile
import unittest
import json
from unittest.mock import patch
from pathlib import Path
from merge_data import FIELDS, merge_catalog, merge_rows, summarize, write_csv
from scraper import Client, main
from test_scraper import product


def record(url='https://example.org/a', pharmacy='La Rebaja', price='100', brand='A'):
    row = dict.fromkeys(FIELDS, '')
    row.update(fecha='2026-10-08', farmacia=pharmacy, principio_activo='TEST',
               concentracion='50 MG', producto='Test 50 mg', marca=brand,
               presentacion='Caja x 10 tabletas', unidades='10', precio=str(float(price) * 10),
               precio_unidad=price, url=url)
    return row


class MergeTests(unittest.TestCase):
    def test_local_replaces_same_url_without_removing_other_pharmacies(self):
        base = [record(), record(pharmacy='Locatel')]
        current = record(price='120')
        rows, replaced = merge_rows(base, [current])
        self.assertEqual(replaced, 1)
        self.assertEqual(len(rows), 2)
        self.assertIn(current, rows)
        self.assertIn(base[1], rows)

    def test_base_variants_remain_intact(self):
        first = record(pharmacy='Locatel')
        second = {**first, 'presentacion': 'Caja x 20 tabletas', 'unidades': '20'}
        rows, replaced = merge_rows([first, second], [])
        self.assertEqual(len(rows), 2)
        self.assertEqual(replaced, 0)

    def test_missing_local_file_uses_only_base_with_exact_columns(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'data').mkdir()
            write_csv(root / 'data/base.csv', [record()])
            result = merge_catalog(root)
            self.assertFalse(result['consulta_local_presente'])
            with (root / 'data/precios.csv').open(encoding='utf-8') as f:
                reader = csv.DictReader(f)
                self.assertEqual(reader.fieldnames, FIELDS)
                self.assertEqual(list(reader), [record()])

    def test_summary_missing_values_and_distinct_brands(self):
        rows = [record(price='100', brand='A'), record(price='900', brand='A'),
                record(price='200', brand='B'), {**record(), 'precio_unidad': ''}]
        report = summarize(rows)
        self.assertEqual(report['porcentaje_con_precio_unidad'], 75)
        self.assertEqual(report['top_3_diferencias'][0]['diferencia_cop'], '700')

    def test_bad_schema_preserves_existing_catalog(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'data').mkdir()
            write_csv(root / 'data/base.csv', [record()])
            target = root / 'data/precios.csv'; target.write_text('previous', encoding='utf-8')
            (root / 'data/scrapeado-hoy.csv').write_text('wrong,columns\n1,2', encoding='utf-8')
            with self.assertRaises(ValueError): merge_catalog(root)
            self.assertEqual(target.read_text(encoding='utf-8'), 'previous')

    def test_scraper_publish_preserves_imported_pharmacies(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'data').mkdir()
            imported = record(pharmacy='Locatel')
            write_csv(root / 'data/base.csv', [imported])
            with patch('scraper.ROOT', root), patch('sys.argv', ['scraper.py', '--publish', '--terms', 'losartan']), \
                    patch.object(Client, 'check_robots', return_value='User-agent: *\nAllow: /'), \
                    patch.object(Client, 'get', return_value=json.dumps([product()])):
                self.assertEqual(main(), 0)
            with (root / 'data/precios.csv').open(encoding='utf-8') as f:
                rows = list(csv.DictReader(f))
            self.assertEqual(len(rows), 2)
            self.assertIn(imported, rows)


if __name__ == '__main__':
    unittest.main()
