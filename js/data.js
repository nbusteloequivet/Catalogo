/* =========================================================================
   DATA.JS — Capa de datos: de dónde salen los productos y cómo se limpian.

   HOY: lee un CSV publicado de Google Sheets con Papa Parse.
   MAÑANA: si migrás a una base de datos/API propia, esta es la única
   función que tendrías que reemplazar (loadCatalog). Mientras siga
   completando "allProducts" con un array de objetos con esta misma forma
   (name, categories, subcategories, price, currency, hasIVA, code, lab,
   description, imageUrl, availability), el resto de la página (ui.js,
   cart.js) no necesita cambiar nada. "categories" y "subcategories" son
   SIEMPRE arrays (aunque el producto tenga una sola categoría), porque un
   producto puede pertenecer a más de una a la vez.
   ========================================================================= */

function loadCatalog() {
  if (!CONFIG.SHEET_CSV_URL || CONFIG.SHEET_CSV_URL.includes("PEGAR_AQUI")) {
    showStatus("Todavía no configuraste CONFIG.SHEET_CSV_URL en js/config.js. Mostrando productos de ejemplo.", "info");
    allProducts = DEMO_PRODUCTS;
    finishLoad();
    return;
  }

  // "cache bust": evita que el navegador devuelva una copia vieja del CSV.
  const url = CONFIG.SHEET_CSV_URL + (CONFIG.SHEET_CSV_URL.includes("?") ? "&" : "?") + "_=" + Date.now();

  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      try {
        const products = results.data.map(normalizeRow).filter((p) => p.name !== "");
        if (products.length === 0) {
          showStatus("La planilla se pudo leer pero no encontramos filas con 'nombre' completo. Revisá los encabezados.", "info");
        } else {
          hideStatus();
        }
        allProducts = products;
      } catch (err) {
        console.error("Error procesando la planilla:", err);
        showStatus("Ocurrió un error interpretando los datos. Mostrando la última versión disponible.", "error");
        if (allProducts.length === 0) allProducts = DEMO_PRODUCTS;
      }
      finishLoad();
    },
    error: (err) => {
      console.error("Error descargando el CSV:", err);
      showStatus("No se pudo leer la planilla. Revisá CONFIG.SHEET_CSV_URL.", "error");
      if (allProducts.length === 0) allProducts = DEMO_PRODUCTS;
      finishLoad();
    },
  });
}

function finishLoad() {
  computeDuplicateNames();
  buildCategoryChips();
  buildLabChips();
  renderGrid();
}

// Para "PORTA OBJETOS X" vs "porta objetos x  " -> mismo nombre a los
// fines de esta comparación (sin importar mayúsculas ni espacios de más).
function normalizeNameForCompare(name) {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Arma el set de nombres que se repiten en más de un producto (son casos
// legítimos: mismo producto, pero de 2 laboratorios distintos — quedan 2
// tarjetas a propósito). Se usa en ui.js para mostrar el laboratorio SOLO
// en esas tarjetas puntuales, ya que ahí es lo único que las diferencia a
// simple vista.
function computeDuplicateNames() {
  const counts = {};
  allProducts.forEach((p) => {
    const key = normalizeNameForCompare(p.name);
    counts[key] = (counts[key] || 0) + 1;
  });
  duplicateProductNames = new Set(
    Object.keys(counts).filter((key) => counts[key] > 1)
  );
}

/* ------------------------------------------------------------------------
   Normalización de filas de la planilla
   ------------------------------------------------------------------------ */
function normalizeHeader(text) {
  return (text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function normalizeRow(rawRow) {
  const row = {};
  for (const key in rawRow) {
    row[normalizeHeader(key)] = (rawRow[key] ?? "").toString().trim();
  }

  const categories = parseMultiValue(row[COLUMNS.category]);

  return {
    name: row[COLUMNS.name] || "",
    // Un producto puede pertenecer a más de una categoría/subcategoría:
    // en la planilla se escriben separadas por coma en la misma celda
    // (ej. "Descartables, Protección"), UNA SOLA fila por producto —
    // así se evita la carga duplicada (mismo código, 2 filas) que antes
    // generaba 2 tarjetas idénticas en el catálogo. Ver categories.js/ui.js
    // para cómo se filtra y se muestra cuando hay más de una.
    categories: categories.length ? categories : ["General"],
    subcategories: parseMultiValue(row[COLUMNS.subcategory]),
    price: parsePrice(row[COLUMNS.price]),       // se lee, no se muestra al cliente
    currency: row[COLUMNS.currency] || "",        // se lee, no se muestra al cliente
    hasIVA: isIVA(row[COLUMNS.iva]),              // se lee, no se muestra al cliente
    code: row[COLUMNS.code] || "",                // se lee; solo viaja en el mail
    lab: row[COLUMNS.lab] || "",
    description: row[COLUMNS.description] || "",
    imageUrl: toDirectDriveUrl(row[COLUMNS.image]),
    availability: normalizeAvailability(row[COLUMNS.availability]),
  };
}

// "Descartables, Protección" -> ["Descartables", "Protección"]. También
// funciona con un solo valor sin coma ("Descartables" -> ["Descartables"]),
// así que una celda con una sola categoría sigue andando exactamente igual
// que antes.
function parseMultiValue(raw) {
  if (!raw) return [];
  return raw.split(",").map((v) => v.trim()).filter(Boolean);
}

function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function isIVA(raw) {
  if (!raw) return false;
  return /^\+?\s*iva$/i.test(raw.trim());
}

// "disponibilidad": si el texto incluye "pedido" se muestra "A pedido";
// cualquier otro valor (o vacío) se toma como "En stock".
function normalizeAvailability(raw) {
  const v = (raw || "").toLowerCase();
  return v.includes("pedido") ? "A pedido" : "En stock";
}

function extractDriveId(url) {
  if (!url) return null;
  let m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  return null;
}

function toDirectDriveUrl(url) {
  if (!url) return null;
  const id = extractDriveId(url);
  if (!id) return url;
  return `https://lh3.googleusercontent.com/d/${id}=w${CONFIG.IMAGE_WIDTH}`;
}

// Clave única por producto: preferimos el código (aunque no se muestre en
// pantalla, sigue siendo el identificador más confiable); si no tiene,
// usamos nombre+categorías.
function productKey(p) {
  return p.code ? `code:${p.code}` : `nc:${p.name}|${p.categories.join("|")}`;
}

/* ------------------------------------------------------------------------
   Datos de ejemplo — solo se muestran si no configuraste la planilla o
   falla la lectura.
   ------------------------------------------------------------------------ */
const DEMO_PRODUCTS = [
  { name: "Reactivo Buffer Fosfato PBS 1X", categories: ["Reactivos"], subcategories: ["Buffers"], price: 8500, currency: "ARS", hasIVA: true, code: "RF-1042", lab: "BioLab SA", description: "Solución tamponadora estéril, pH 7.4, uso general en cultivo celular.", imageUrl: null, availability: "En stock" },
  { name: "Tubos Falcon 15 ml", categories: ["Descartables"], subcategories: ["Tubos"], price: 3200, currency: "ARS", hasIVA: false, code: "DS-2210", lab: "PlastiCiencia", description: "Tubos cónicos estériles con tapa a rosca, graduados.", imageUrl: null, availability: "En stock" },
  { name: "Kit Extracción de ADN", categories: ["Kits"], subcategories: ["Genómica"], price: 45200, currency: "USD", hasIVA: true, code: "KT-0091", lab: "GenTech", description: "Kit de columna para extracción de ADN genómico de muestras de tejido.", imageUrl: null, availability: "A pedido" },
  // Ejemplo de producto en 2 categorías a la vez (para probar el filtro sin necesidad de la planilla real).
  { name: "Guantes de Nitrilo Talle M", categories: ["Descartables", "Protección"], subcategories: [], price: 6100, currency: "ARS", hasIVA: false, code: "DS-3305", lab: "SafeHand", description: "Guantes sin polvo, resistentes a solventes.", imageUrl: null, availability: "En stock" },
];
