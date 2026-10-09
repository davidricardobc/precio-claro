import { parseCSV, validateRows, findGroups, normalize } from './catalog.mjs';
const $ = id => document.getElementById(id);
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
const titleCase = text => text.toLocaleLowerCase('es-CO').replace(/^\p{L}/u, c => c.toLocaleUpperCase('es-CO'));
const dateLabel = value => dateFormat.format(new Date(value.includes('T') ? value : value + 'T12:00:00-05:00'));
const pluralForm = row => row.forma === 'capsula' ? 'cápsulas' : 'tabletas';
const groupLabel = row => `${titleCase(row.principio_activo)} ${row.concentracion.toLowerCase()} · ${pluralForm(row)}${row.liberacion !== 'no especificada' ? ' · ' + row.liberacion : ''}`;
let catalog = [], groups = [], rejectedCount = 0;

function element(tag, className, text) {
  const node = document.createElement(tag); if (className) node.className = className;
  if (text !== undefined) node.textContent = text; return node;
}
function message(title, description) {
  const box = element('div', 'feedback'); box.append(element('h3', '', title), element('p', '', description));
  $('feedback').replaceChildren(box); $('results').replaceChildren();
}
function offerCard(row, best) {
  const card = element('article', 'offer' + (best ? ' best' : ''));
  if (best) card.append(element('span', 'best-label', '✓ MENOR PRECIO REGISTRADO POR UNIDAD'));
  const info = element('div', 'offer-info');
  info.append(element('p', 'offer-brand', row.marca || 'MARCA NO INFORMADA'), element('h3', '', titleCase(row.producto)),
    element('p', 'presentation', `${titleCase(row.presentacion)} · ${row.unidades} ${pluralForm(row)}`),
    element('p', 'pharmacy', row.farmacia), element('p', 'offer-date', `Consultado: ${dateLabel(row.fecha)}`));
  const price = element('div', 'price-column');
  const link = element('a', 'pharmacy-link', 'Ver en farmacia'); link.href = row.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `Ver ${row.producto} en ${row.farmacia}, abre otra pestaña`); link.append(element('span', '', '↗'));
  price.append(element('span', 'unit-price', cop.format(row.precio_unidad)), element('span', 'unit-label', `COP / ${row.forma === 'capsula' ? 'cápsula' : 'tableta'}`),
    element('p', 'pack-price', `${cop.format(row.precio)} el empaque`), link);
  card.append(info, price); return card;
}
function renderOffers() {
  $('feedback').replaceChildren();
  const selected = groups.find(g => g.key === $('group').value);
  if (!selected) {
    $('results-title').textContent = 'Sin coincidencias'; $('result-count').textContent = '0 ofertas';
    $('comparison-note').textContent = 'Prueba con el principio activo o con otra marca.';
    message('No encontramos ese medicamento', 'El catálogo aún es limitado. Prueba losartán, acetaminofén o borra tu búsqueda para explorar.');
    return;
  }
  const pharmacy = $('pharmacy').value;
  const offers = selected.offers.filter(r => !pharmacy || r.farmacia === pharmacy);
  $('results-title').textContent = groupLabel(selected.offers[0]);
  $('result-count').textContent = `${offers.length} ${offers.length === 1 ? 'oferta' : 'ofertas'}`;
  $('comparison-note').textContent = `De menor a mayor precio por unidad. Liberación: ${selected.offers[0].liberacion}. Confirma la presentación con tu farmacéutico.`;
  if (!offers.length) { message('Sin ofertas en esta farmacia', 'Selecciona todas las farmacias para volver a ver los resultados.'); return; }
  const minimum = offers[0].precio / offers[0].unidades;
  $('results').replaceChildren(...offers.map(row => offerCard(row, offers.length > 1 && Math.abs(row.precio / row.unidades - minimum) < .000001)));
  if (rejectedCount) $('feedback').append(element('p', 'comparison-note', `${rejectedCount} registros del catálogo quedan fuera de la comparación: datos incompletos, inconsistentes o presentaciones fuera del alcance. Se conservan en el CSV.`));
}
function search(query) {
  $('search').value = query;
  groups = findGroups(catalog, query);
  $('group').replaceChildren(...groups.map(group => {
    const option = element('option', '', groupLabel(group.offers[0])); option.value = group.key; return option;
  }));
  $('group').disabled = !groups.length;
  for (const button of document.querySelectorAll('[data-query]')) button.setAttribute('aria-pressed', String(normalize(button.dataset.query) === normalize(query)));
  renderOffers();
}
$('search-form').addEventListener('submit', event => { event.preventDefault(); search($('search').value); });
$('search').addEventListener('input', () => search($('search').value));
$('group').addEventListener('change', renderOffers);
$('pharmacy').addEventListener('change', renderOffers);
for (const button of document.querySelectorAll('[data-query]')) button.addEventListener('click', () => search(button.dataset.query));

async function loadCatalog() {
  try {
    const response = await fetch(new URL('data/precios.csv', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`No se pudo cargar el catálogo (HTTP ${response.status}).`);
    const sourceRows = parseCSV(await response.text());
    const { accepted, rejected } = validateRows(sourceRows); catalog = accepted; rejectedCount = rejected.length;
    if (!catalog.length) throw new Error('Todavía no hay ofertas verificables en el catálogo.');
    const pharmacies = [...new Set(catalog.map(r => r.farmacia))].sort();
    $('pharmacy').replaceChildren(new Option('Todas las disponibles', ''), ...pharmacies.map(p => new Option(p, p)));
    $('pharmacy').disabled = false;
    $('catalog-summary').textContent = `${sourceRows.length} registros · ${catalog.length} ofertas comparables · ${pharmacies.length} ${pharmacies.length === 1 ? 'farmacia' : 'farmacias'}`;
    const dates = catalog.map(r => Date.parse(r.fecha));
    const latest = Math.max(...dates), oldest = Math.min(...dates);
    const age = Math.floor((Date.now() - oldest) / 86400000);
    $('updated').textContent = `Última consulta: ${dateLabel(new Date(latest).toISOString())}${age >= 7 ? ' · Hay precios de hace más de 7 días' : ''}`;
    $('scope-copy').textContent = pharmacies.length === 1 ? `Por ahora consultamos ${pharmacies[0]}. Comparamos sus presentaciones y marcas; aún no precios entre cadenas.` : 'Base de la clase para las tres farmacias, con consulta local de La Rebaja. Los precios pueden variar según tu ciudad y el envío.';
    search($('search').value);
    registerSearchTool();
  } catch (error) {
    $('results-title').textContent = 'Catálogo no disponible'; $('result-count').textContent = '0 ofertas';
    $('catalog-summary').textContent = 'No se pudieron verificar los precios';
    $('comparison-note').textContent = 'Nunca rellenamos precios con datos inventados.';
    message('No pudimos cargar los precios', location.protocol === 'file:' ? 'Abre start.cmd para iniciar la web local. El navegador necesita un servidor para leer el CSV.' : `${error.message} Intenta recargar la página.`);
  } finally { $('results-area').setAttribute('aria-busy', 'false'); }
}
function registerSearchTool() {
  if (!document.modelContext?.registerTool) return;
  const lifecycle = new AbortController();
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  try {
    Promise.resolve(document.modelContext.registerTool({ name: 'search_medicine_prices', title: 'Buscar precios de medicamentos',
      description: 'Actualiza la búsqueda visible y devuelve grupos de precios descriptivos. No establece equivalencia terapéutica.',
      inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 120 } }, required: ['query'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input.query !== 'string' || input.query.length > 120 || Object.keys(input).some(k => k !== 'query')) throw new Error('La consulta debe ser un texto de hasta 120 caracteres.');
        search(input.query);
        return { groups: groups.map(g => ({ description: groupLabel(g.offers[0]), offers: g.offers.length })), displayedGroup: $('group').value };
      }
    }, { signal: lifecycle.signal })).catch(() => {});
  } catch { /* API experimental, búsqueda normal disponible. */ }
}
loadCatalog();
