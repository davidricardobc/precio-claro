import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV, validateRows, findGroups, REQUIRED_FIELDS } from '../catalog.mjs';

// Importes sintéticos solo para probar orden por unidad frente al precio de caja.
const row = { fecha: '2026-10-08', farmacia: 'Prueba', principio_activo: 'losartan',
  concentracion: '50 MG', producto: 'Losartán 50 MG', marca: 'Prueba', presentacion: 'Caja x 10 tab',
  unidades: '10', precio: '10000', precio_lista: '', precio_unidad: '1000',
  url: 'https://example.org/product-a', forma: 'tableta', liberacion: 'no especificada' };
const csv = values => values.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',');

test('CSV conserva comas, comillas, BOM, CRLF y saltos dentro de celdas', () => {
  const source = { ...row, producto: 'Producto, "prueba"\nsegunda línea' };
  const result = parseCSV('\uFEFF' + REQUIRED_FIELDS.join(',') + '\r\n' + csv(REQUIRED_FIELDS.map(k => source[k])) + '\r\n');
  assert.equal(result[0].producto, source.producto);
});
test('rechaza CSV truncado o con columnas ausentes', () => {
  assert.throws(() => parseCSV('foo,bar\n1,2'));
  assert.throws(() => parseCSV(REQUIRED_FIELDS.join(',') + '\n"no cerrado'));
  assert.throws(() => parseCSV(REQUIRED_FIELDS.join(',') + '\n1,2'));
});
test('rechaza unidades inválidas, precios inconsistentes y enlaces ejecutables', () => {
  for (const change of [{ unidades: '0' }, { unidades: '1.5' }, { precio: '-1' }, { precio_unidad: '5' }, { url: 'javascript:alert(1)' }, { fecha: 'desconocida' }, { concentracion: '50/12 MG' }]) {
    assert.equal(validateRows([{ ...row, ...change }]).accepted.length, 0);
  }
});
test('agrupa separando dosis, formas y liberaciones; ordena por unidad', () => {
  const data = validateRows([row, { ...row, unidades: '30', precio: '15000', precio_unidad: '500', url: 'https://example.org/b' },
    { ...row, concentracion: '100 MG', url: 'https://example.org/c' },
    { ...row, forma: 'capsula', url: 'https://example.org/d' },
    { ...row, liberacion: 'prolongada', url: 'https://example.org/e' }]).accepted;
  const groups = findGroups(data, 'LOSARTÁN');
  assert.equal(groups.length, 4);
  const pair = groups.find(g => g.offers.length === 2);
  assert.equal(pair.offers[0].precio, 15000);
  assert.equal(pair.offers[0].precio_unidad, 500);
  assert.equal(findGroups(data, 'inexistente').length, 0);
});
test('buscar marca mantiene otras marcas del mismo grupo descriptivo', () => {
  const data = validateRows([row, { ...row, marca: 'Alternativa', url: 'https://example.org/b' }]).accepted;
  assert.equal(findGroups(data, 'Alternativa')[0].offers.length, 2);
});
test('el catálogo real pasa validación completa sin duplicados', () => {
  const rows = parseCSV(readFileSync(new URL('../data/precios.csv', import.meta.url), 'utf8'));
  const { accepted, rejected } = validateRows(rows);
  assert.equal(rejected.length, 0);
  assert.ok(accepted.length > 0);
  assert.ok(accepted.every(r => r.farmacia === 'La Rebaja'));
});
