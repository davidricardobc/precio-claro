import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCSV, validateRows, findGroups, calculateSavings, REQUIRED_FIELDS } from '../catalog.mjs';

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
test('el catálogo unido conserva datos de tres farmacias y separa filas no comparables', () => {
  const rows = parseCSV(readFileSync(new URL('../data/precios.csv', import.meta.url), 'utf8'));
  const { accepted, rejected } = validateRows(rows);
  assert.equal(accepted.length + rejected.length, rows.length);
  assert.ok(accepted.length > 0);
  assert.equal(new Set(accepted.map(r => r.farmacia)).size, 3);
  assert.ok(rejected.some(r => !r.precio_unidad));
});

test('CSV de 12 columnas infiere forma y conserva variantes con la misma URL', () => {
  const plain = Object.fromEntries(REQUIRED_FIELDS.map(key => [key, row[key]]));
  const { accepted } = validateRows([plain, { ...plain, unidades: '20', precio: '18000', precio_unidad: '900', presentacion: 'Caja x 20 tabletas' }]);
  assert.equal(accepted.length, 2);
  assert.equal(accepted[0].forma, 'tableta');
});

test('no mezcla tabletas comunes con masticables, líquidos o liberación modificada', () => {
  const plain = Object.fromEntries(REQUIRED_FIELDS.map(key => [key, row[key]]));
  assert.equal(validateRows([{ ...plain, producto: 'Tabletas masticables' }]).accepted.length, 0);
  assert.equal(validateRows([{ ...plain, producto: 'Solución 50 mg/5 ml' }]).accepted.length, 0);
  const extended = { ...plain, producto: 'Losartan 50 mg XR', url: 'https://example.org/xr' };
  assert.equal(findGroups(validateRows([plain, extended]).accepted).length, 2);
});

test('Cozaar 50 mg: Genfar La Rebaja, 96,65 % y 406700 pesos por 30 unidades', () => {
  const rows = parseCSV(readFileSync(new URL('../data/precios.csv', import.meta.url), 'utf8'));
  const selected = rows.find(r => r.producto === 'Cozaar 50Mg X 30 Comprimidos');
  const result = calculateSavings(selected, rows);
  assert.equal(result.status, 'saving');
  assert.equal(result.cheapest.farmacia, 'La Rebaja');
  assert.equal(result.cheapest.marca, 'GENFAR');
  assert.equal(result.percent.toFixed(2), '96.65');
  assert.equal(result.quantitySaving, 406700);
  assert.equal(result.purchaseCost, 14100);
  assert.equal(result.samePresentation, true);
});

test('Dolex Activgel: 89,59 % frente a Genfar, con diferencia de presentación explícita', () => {
  const rows = parseCSV(readFileSync(new URL('../data/precios.csv', import.meta.url), 'utf8'));
  const selected = rows.find(r => r.producto === 'Dolex Activgel 500mg X 10 Capsulas Liquidas');
  const result = calculateSavings(selected, rows);
  assert.equal(result.cheapest.marca, 'Genfar');
  assert.equal(result.cheapest.farmacia, 'Locatel');
  assert.equal(result.percent.toFixed(2), '89.59');
  assert.equal(result.quantitySaving, 17470);
  assert.equal(result.samePresentation, false);
});

test('ahorro: menor precio, empate, unidades ausentes y aritmética inválida', () => {
  assert.equal(calculateSavings(row, [row]).status, 'already_cheapest');
  assert.equal(calculateSavings(row, [{ ...row, url: 'https://example.org/tie' }]).status, 'already_cheapest');
  assert.equal(calculateSavings({ ...row, unidades: '' }, [row]).status, 'missing_units');
  assert.equal(calculateSavings({ ...row, precio_unidad: '3' }, [row]).status, 'invalid_price');
});

test('ahorro: misma dosis, fuentes válidas y compra en empaques completos', () => {
  const alternative = { ...row, precio: '20000', unidades: '100', precio_unidad: '200', url: 'https://example.org/pack' };
  const wrongDose = { ...alternative, concentracion: '100 MG', precio: '1000', precio_unidad: '10' };
  const unsafeLink = { ...alternative, precio: '1000', precio_unidad: '10', url: 'javascript:alert(1)' };
  const result = calculateSavings(row, [alternative, wrongDose, unsafeLink]);
  assert.equal(result.cheapest.url, alternative.url);
  assert.equal(result.equivalentCost, 2000);
  assert.equal(result.quantitySaving, 8000);
  assert.equal(result.purchaseCost, 20000);
  assert.equal(result.purchaseUnits, 100);
});
