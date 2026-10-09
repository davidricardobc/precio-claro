export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export const GROUP_FIELDS = ['principio_activo', 'concentracion', 'forma', 'liberacion'];
export const REQUIRED_FIELDS = ['fecha', 'farmacia', 'principio_activo', 'concentracion', 'producto', 'marca', 'presentacion', 'unidades', 'precio', 'precio_lista', 'precio_unidad', 'url'];

export function describeRow(source) {
  const text = normalize(`${source.producto} ${source.presentacion}`);
  let form = source.forma;
  if (!form) {
    const capsule = /\b(cap|caps|capsula|capsulas)\b/.test(text);
    const tablet = /\b(tab|tabs|tableta|tabletas|comprimido|comprimidos)\b/.test(text);
    form = capsule && !tablet ? 'capsula' : tablet && !capsule ? 'tableta' : '';
  }
  const special = /\b(ml|jarabe|suspension|gotas|solucion|inyectable|crema|gel|emulgel|polvo|sobres?|masticables?|efervescentes?|sublingual|bucodispersable|blandas?|liquid[ao]s?|liqui|activgel)\b/.test(text);
  let release = source.liberacion || 'no especificada';
  if (/\b(xr|sr|cr|lp|retard)\b|liberacion (prolongada|modificada|retardada)/.test(text)) release = 'modificada';
  if (/gastroresistente|enteric/.test(text)) release = 'recubrimiento especial';
  return { ...source, forma: special ? '' : form, liberacion: release };
}

export function parseCSV(text) {
  const matrix = []; let row = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error('Comillas inválidas en el CSV.');
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        if (row.some(v => v !== '')) matrix.push(row);
        row = [];
      }
    } else {
      if (closed) throw new Error('Contenido inesperado después de comillas.');
      cell += c;
    }
  }
  if (quoted) throw new Error('El CSV tiene comillas sin cerrar.');
  if (cell || row.length) { row.push(cell); matrix.push(row); }
  if (!matrix.length) throw new Error('El catálogo está vacío.');
  const headers = matrix.shift().map(s => s.trim());
  if (new Set(headers).size !== headers.length || REQUIRED_FIELDS.some(k => !headers.includes(k))) throw new Error('Faltan columnas o hay encabezados duplicados.');
  return matrix.map(values => {
    if (values.length !== headers.length) throw new Error('Una fila tiene columnas incompletas.');
    return Object.fromEntries(headers.map((key, i) => [key, values[i].trim()]));
  });
}

export function validateRows(rows) {
  const accepted = [], rejected = []; const seen = new Set();
  for (const source of rows) {
    const row = describeRow(source);
    const price = Number(row.precio), units = Number(row.unidades), unitPrice = Number(row.precio_unidad);
    let url; try { url = new URL(row.url); } catch { /* rejected below */ }
    const valid = Number.isFinite(price) && price > 0 && Number.isInteger(units) && units > 0
      && Number.isFinite(unitPrice) && unitPrice > 0 && Math.abs(price / units - unitPrice) <= .011
      && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(row.fecha) && Number.isFinite(Date.parse(row.fecha))
      && Date.parse(row.fecha) <= Date.now() + 24 * 60 * 60 * 1000
      && row.producto && row.farmacia && row.presentacion
      && GROUP_FIELDS.every(key => row[key]) && ['tableta', 'capsula'].includes(normalize(row.forma))
      && url?.protocol === 'https:' && !url.username && !url.password
      && !/[+\/]/.test(row.principio_activo) && /^\d+(?:\.\d+)? (?:MG|MCG)$/.test(row.concentracion);
    if (!valid) { rejected.push(row); continue; }
    const identity = `${row.farmacia}|${row.url}|${row.sku || ''}|${row.unidades}|${normalize(row.presentacion)}|${groupKey(row)}`;
    if (seen.has(identity)) { rejected.push(row); continue; }
    seen.add(identity);
    accepted.push({ ...row, precio: price, unidades: units, precio_unidad: unitPrice, precio_lista: Number(row.precio_lista) || null });
  }
  return { accepted, rejected };
}

export function groupKey(row) { return GROUP_FIELDS.map(key => normalize(row[key])).join('|'); }
export function findGroups(rows, query = '') {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  const matches = new Set(rows.filter(row => {
    const text = normalize([row.producto, row.marca, row.principio_activo, row.concentracion].join(' '));
    return words.every(word => text.includes(word));
  }).map(groupKey));
  const groups = new Map();
  for (const row of rows) {
    const key = groupKey(row);
    if (!matches.has(key)) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([key, offers]) => ({ key, offers: offers.sort((a, b) => a.precio / a.unidades - b.precio / b.unidades || a.precio - b.precio) }))
    .sort((a, b) => a.key.localeCompare(b.key, 'es', { numeric: true }));
}
