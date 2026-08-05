/* =========================================================================
   DATA.JS — Capa de datos: de dónde salen los productos y cómo se limpian.

   HOY: lee un CSV publicado de Google Sheets con Papa Parse.
   MAÑANA: si migrás a una base de datos/API propia, esta es la única
   función que tendrías que reemplazar (loadCatalog). Mientras siga
   completando "allProducts" con un array de objetos con esta misma forma
   (name, category, subcategory, price, currency, hasIVA, code, lab,
   description, imageUrl, availability), el resto de la página (ui.js,
   cart.js) no necesita cambiar nada.
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
  buildCategoryChips();
  buildLabChips();
  renderGrid();
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

  return {
    name: row[COLUMNS.name] || "",
    category: row[COLUMNS.category] || "General",
    subcategory: row[COLUMNS.subcategory] || "",
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
// usamos nombre+categoría.
function productKey(p) {
  return p.code ? `code:${p.code}` : `nc:${p.name}|${p.category}`;
}

/* ------------------------------------------------------------------------
   Datos de ejemplo — solo se muestran si no configuraste la planilla o
   falla la lectura.
   ------------------------------------------------------------------------ */
const DEMO_PRODUCTS = [
  { name: "Reactivo Buffer Fosfato PBS 1X", category: "Reactivos", subcategory: "Buffers", price: 8500, currency: "ARS", hasIVA: true, code: "RF-1042", lab: "BioLab SA", description: "Solución tamponadora estéril, pH 7.4, uso general en cultivo celular.", imageUrl: null, availability: "En stock" },
  { name: "Tubos Falcon 15 ml", category: "Descartables", subcategory: "Tubos", price: 3200, currency: "ARS", hasIVA: false, code: "DS-2210", lab: "PlastiCiencia", description: "Tubos cónicos estériles con tapa a rosca, graduados.", imageUrl: null, availability: "En stock" },
  { name: "Kit Extracción de ADN", category: "Kits", subcategory: "Genómica", price: 45200, currency: "USD", hasIVA: true, code: "KT-0091", lab: "GenTech", description: "Kit de columna para extracción de ADN genómico de muestras de tejido.", imageUrl: null, availability: "A pedido" },
  { name: "Guantes de Nitrilo Talle M", category: "Descartables", subcategory: "Protección", price: 6100, currency: "ARS", hasIVA: false, code: "DS-3305", lab: "SafeHand", description: "Guantes sin polvo, resistentes a solventes.", imageUrl: null, availability: "En stock" },
];
