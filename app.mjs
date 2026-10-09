import { parseCSV, validateRows, findGroups, normalize, matchesQuery, calculateSavings, safeProductURL } from './catalog.mjs';
const $ = id => document.getElementById(id);
const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
const titleCase = text => text.toLocaleLowerCase('es-CO').replace(/^\p{L}/u, c => c.toLocaleUpperCase('es-CO'));
const dateLabel = value => { const date = new Date(value.includes('T') ? value : value + 'T12:00:00-05:00'); return Number.isFinite(date.getTime()) ? dateFormat.format(date) : 'Fecha no disponible'; };
const pluralForm = row => row.forma === 'capsula' ? 'cápsulas' : 'tabletas';
const groupLabel = row => `${titleCase(row.principio_activo)} ${row.concentracion.toLowerCase()} · ${pluralForm(row)}${row.liberacion !== 'no especificada' ? ' · ' + row.liberacion : ''}`;
let catalog = [], groups = [], rejectedCount = 0, allRecords = [], otherRecords = [];

function element(tag, className, text) {
  const node = document.createElement(tag); if (className) node.className = className;
  if (text !== undefined) node.textContent = text; return node;
}
function message(title, description) {
  const box = element('div', 'feedback'); box.append(element('h3', '', title), element('p', '', description));
  $('feedback').replaceChildren(box); $('results').replaceChildren();
}
function offerCard(row, best, unclassified = false) {
  const card = element('article', 'offer' + (best ? ' best' : ''));
  if (best) card.append(element('span', 'best-label', '✓ MENOR PRECIO REGISTRADO POR UNIDAD'));
  const info = element('div', 'offer-info');
  info.append(element('p', 'offer-brand', row.marca || 'MARCA NO INFORMADA'), element('h3', '', titleCase(row.producto)),
    element('p', 'presentation', `${titleCase(row.presentacion)}${row.forma && Number(row.unidades) > 0 ? ` · ${row.unidades} ${pluralForm(row)}` : ''}`),
    element('p', 'pharmacy', row.farmacia), element('p', 'offer-date', `Consultado: ${dateLabel(row.fecha)}`));
  const price = element('div', 'price-column');
  const link = element('a', 'pharmacy-link', 'Ver en farmacia'); link.href = row.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `Ver ${row.producto} en ${row.farmacia}, abre otra pestaña`); link.append(element('span', '', '↗'));
  const hasUnitPrice = Number.isFinite(Number(row.precio_unidad)) && Number(row.precio_unidad) > 0;
  price.append(element('span', 'unit-price', hasUnitPrice ? cop.format(Number(row.precio_unidad)) : '—'), element('span', 'unit-label', hasUnitPrice ? `COP / ${row.forma === 'capsula' ? 'cápsula' : row.forma === 'tableta' ? 'tableta' : 'unidad reportada'}` : 'Sin precio por unidad'),
    element('p', 'pack-price', Number(row.precio) > 0 ? `${cop.format(Number(row.precio))} el empaque` : 'Sin precio verificable'));
  if (safeProductURL(row.url)) price.append(link);
  const compare = element('button', 'compare-button', unclassified ? 'Revisar comparación →' : 'Calcular ahorro →');
  compare.type = 'button'; compare.setAttribute('aria-label', `Comparar ahorro de ${row.producto} en ${row.farmacia}`);
  compare.setAttribute('aria-haspopup', 'dialog'); compare.addEventListener('click', () => showSavings(row));
  info.append(compare);
  card.append(info, price); return card;
}
function renderOtherRecords(selected) {
  const pharmacy = $('pharmacy').value;
  const rows = otherRecords.filter(row => matchesQuery(row, $('search').value) && (!pharmacy || row.farmacia === pharmacy)
    && (!selected || normalize(row.principio_activo) === normalize(selected.principio_activo)
      && normalize(row.concentracion) === normalize(selected.concentracion)));
  $('other-records').hidden = !rows.length;
  $('other-records').open = !selected && rows.length > 0;
  $('other-records-title').textContent = `Otras presentaciones y datos pendientes (${rows.length})`;
  $('other-results').replaceChildren(...rows.map(row => offerCard(row, false, true)));
  return rows.length;
}
function renderOffers() {
  $('feedback').replaceChildren();
  const selected = groups.find(g => g.key === $('group').value);
  if (!selected) {
    $('results-title').textContent = 'Sin coincidencias'; $('result-count').textContent = '0 ofertas';
    $('comparison-note').textContent = 'Prueba con el principio activo o con otra marca.';
    message('No encontramos ese medicamento', 'El catálogo aún es limitado. Prueba losartán, acetaminofén o borra tu búsqueda para explorar.');
    const otherCount = renderOtherRecords(null);
    if (otherCount) {
      $('results-title').textContent = 'Revisa la presentación';
      $('result-count').textContent = `${otherCount} ${otherCount === 1 ? 'ficha' : 'fichas'}`;
      $('comparison-note').textContent = 'Encontramos fichas que requieren revisar su presentación o completar datos.';
      $('feedback').replaceChildren();
    }
    return;
  }
  renderOtherRecords(selected.offers[0]);
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

function comparisonProduct(row, label) {
  const box = element('div', 'comparison-product');
  box.append(element('p', 'eyebrow', label), element('h3', '', titleCase(row.producto)),
    element('p', '', `${row.farmacia} · ${titleCase(row.presentacion)}`),
    element('strong', 'comparison-unit-price', `${cop.format(row.exactUnitPrice)} por unidad`),
    element('p', 'offer-date', `Precio del empaque: ${cop.format(row.precio)} · Consulta: ${dateLabel(row.fecha)}`));
  return box;
}
function showSavings(row) {
  const result = calculateSavings(row, allRecords);
  const content = $('savings-content'); content.replaceChildren();
  if (result.status === 'missing_units' || result.status === 'invalid_price') {
    const missing = result.status === 'missing_units';
    content.append(element('h3', '', missing ? 'No podemos comparar sin las unidades' : 'No podemos verificar esta comparación'),
      element('p', '', titleCase(row.producto)), element('p', '', missing
        ? 'Esta ficha no informa una cantidad válida de unidades por empaque. No calculamos un precio por unidad ni un ahorro por suposición.'
        : 'Faltan datos válidos o el precio por unidad no coincide con el precio y la cantidad del empaque.'));
  } else {
    const { current, cheapest } = result;
    const hero = element('div', 'savings-hero');
    if (result.status === 'already_cheapest') {
      hero.append(element('p', 'eyebrow', 'EL MENOR PRECIO REGISTRADO'), element('h3', '', 'Este producto ya tiene el menor precio por unidad'),
        element('p', '', 'Puede compartir el primer lugar con otras ofertas. No encontramos una opción de menor precio con la misma sustancia y concentración.'));
      content.append(hero, comparisonProduct(current, 'TU SELECCIÓN'));
      const source = element('a', 'savings-source', `Ver oferta en ${current.farmacia} ↗`);
      source.href = safeProductURL(current.url); source.target = '_blank'; source.rel = 'noopener noreferrer'; content.append(source);
    } else {
      hero.append(element('p', 'eyebrow', 'AHORRO POTENCIAL POR PRECIO'),
        element('div', 'savings-percent', `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(result.percent)} %`),
        element('p', '', `${cop.format(result.unitSaving)} menos por unidad · ${titleCase(current.principio_activo)} ${current.concentracion.toLowerCase()}`));
      content.append(hero);
      const cards = element('div', 'comparison-products');
      cards.append(comparisonProduct(current, 'PRODUCTO SELECCIONADO'), comparisonProduct(cheapest, 'MENOR PRECIO POR UNIDAD'));
      content.append(cards);
      const total = element('div', 'savings-total');
      total.append(element('h3', '', `Para la misma cantidad: ${result.quantity} unidades`),
        element('p', '', `${cop.format(current.precio)} → ${cop.format(result.equivalentCost)} de valor proporcional.`),
        element('strong', '', `${cop.format(result.quantitySaving)} de ahorro proporcional`));
      content.append(total);
      if (result.purchaseUnits !== result.quantity) {
        content.append(element('p', 'pack-explanation', `El empaque de la alternativa trae ${cheapest.unidades} unidades. Para cubrir ${result.quantity}, comprarías ${result.packsNeeded} ${result.packsNeeded === 1 ? 'empaque' : 'empaques'} por ${cop.format(result.purchaseCost)} (${result.purchaseUnits} unidades). El valor proporcional no es el precio de compra.`));
      } else {
        content.append(element('p', 'pack-explanation', `La misma cantidad se cubre con ${result.packsNeeded} ${result.packsNeeded === 1 ? 'empaque' : 'empaques'} de ${cheapest.unidades} unidades: ${cop.format(result.purchaseCost)}, antes de envío.`));
      }
      const source = element('a', 'savings-source', `Ver ${titleCase(cheapest.marca || cheapest.producto)} en ${cheapest.farmacia} ↗`);
      source.href = safeProductURL(cheapest.url); source.target = '_blank'; source.rel = 'noopener noreferrer'; content.append(source);
    }
    const scopeNotice = element('p', result.samePresentation ? 'comparison-scope' : 'presentation-warning', result.samePresentation
      ? 'Comparación económica entre registros con la misma sustancia y concentración. Coincide la forma descrita, pero esto no certifica equivalencia terapéutica. Confirma la presentación antes de cambiar.'
      : 'Atención: las presentaciones son distintas o no están completamente identificadas. El porcentaje compara precios por unidad, no demuestra que un medicamento pueda reemplazar al otro. Consulta con tu médico o farmacéutico.');
    if (result.samePresentation) content.append(scopeNotice); else content.prepend(scopeNotice);
    content.append(element('p', 'comparison-scope', 'Buscamos en todas las farmacias del catálogo, aunque hayas filtrado una. Precios de la fecha indicada, sin envío ni descuentos personalizados.'));
  }
  $('savings-dialog').showModal();
  $('close-savings').focus();
}
$('close-savings').addEventListener('click', () => $('savings-dialog').close());
$('savings-dialog').addEventListener('click', event => {
  if (event.target !== $('savings-dialog')) return;
  const rect = event.target.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
});
$('search-form').addEventListener('submit', event => { event.preventDefault(); search($('search').value); });
$('search').addEventListener('input', () => search($('search').value));
$('group').addEventListener('change', renderOffers);
$('pharmacy').addEventListener('change', renderOffers);
for (const button of document.querySelectorAll('[data-query]')) button.addEventListener('click', () => search(button.dataset.query));

async function loadCatalog() {
  try {
    const response = await fetch(new URL('data/precios.csv', import.meta.url), { cache: 'no-cache' });
    if (!response.ok) throw new Error(`No se pudo cargar el catálogo (HTTP ${response.status}).`);
    const sourceRows = parseCSV(await response.text()); allRecords = sourceRows;
    const { accepted, rejected } = validateRows(sourceRows); catalog = accepted; otherRecords = rejected; rejectedCount = rejected.length;
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
