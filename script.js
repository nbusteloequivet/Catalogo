/* =========================================================================
   CONFIGURACIÓN — Lo único que normalmente vas a tocar.
   ========================================================================= */
const CONFIG = {
  // URL del CSV publicado (Archivo > Compartir > Publicar en la Web > CSV)
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQC4BFXcTT1kYiQALcRtU2X4EkKqAbXc1tf0hfLzsaZbofK_AaDVn6X6Nj9Vlx-6ld484FGk1VHG1Y2/pub?gid=0&single=true&output=csv",

  // Nombre y bajada que se muestran arriba de todo, centrados
  LAB_NAME: "EquiVet",
  LAB_SUBTITLE: "Juntos por el bienestar animal",

  // Cada cuánto se vuelve a consultar la planilla sola, en milisegundos
  // (30000 = 30 segundos, 60000 = 1 minuto)
  AUTO_REFRESH_MS: 30000,

  // Ancho de imagen que se le pide a Drive (afecta la nitidez y el peso)
  IMAGE_WIDTH: 500,
};

/* Colores para distinguir categorías a simple vista (franja de la tarjeta
   y chip activo). Se usan en orden y se repiten en ciclo si hay más
   categorías que colores. Para agregar/cambiar un color, edita esta lista. */
const CATEGORY_COLORS = [
  "#b200ff", // violeta (color de marca)
  "#000000", // negro
  "#ff2ecb", // magenta
  "#00b3c6", // turquesa
  "#ff7a00", // naranja
  "#00a651", // verde
  "#ffcc00", // amarillo
  "#e63946", // rojo
  "#3a5cff", // azul
  "#8c52ff", // lila
];

/* Columnas que el programa busca en la planilla. Los nombres se comparan
   sin importar mayúsculas ni tildes (ver normalizeRow más abajo), así que
   "Categoría", "categoria" y "CATEGORIA" son todos válidos. */
const COLUMNS = {
  name: "nombre",
  category: "categoria",
  subcategory: "subcategoria",
  price: "precio",
  currency: "moneda",
  iva: "iva",
  code: "codigo",
  lab: "laboratorio",
  description: "descripcion",
  image: "imagen",
};

/* ------------------------------------------------------------------------
   Estado de la aplicación
   ------------------------------------------------------------------------ */
let allProducts = [];
let activeCategory = null;
let searchTerm = "";
let categoryColorMap = {};
let lastFocusedElement = null;

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  // Guardamos referencias a los elementos del DOM una sola vez
  els.grid = document.getElementById("catalog-grid");
  els.statusBanner = document.getElementById("status-banner");
  els.emptyState = document.getElementById("empty-state");
  els.searchInput = document.getElementById("search-input");
  els.categoryChips = document.getElementById("category-chips");
  els.labName = document.getElementById("lab-name");
  els.labSub = document.getElementById("lab-sub");
  els.modalOverlay = document.getElementById("product-modal");
  els.modalBody = document.getElementById("modal-body");
  els.modalClose = document.getElementById("modal-close");

  els.labName.textContent = CONFIG.LAB_NAME;
  els.labSub.textContent = CONFIG.LAB_SUBTITLE;

  // Búsqueda con debounce: espera a que la persona deje de tipear 200ms
  // antes de filtrar, para no recalcular en cada tecla innecesariamente.
  let searchDebounce;
  els.searchInput.addEventListener("input", (e) => {
    clearTimeout(searchDebounce);
    const value = e.target.value;
    searchDebounce = setTimeout(() => {
      searchTerm = value.trim().toLowerCase();
      renderGrid();
    }, 200);
  });

  // Cierre del modal: botón, click fuera de la tarjeta, o tecla Escape
  els.modalClose.addEventListener("click", closeModal);
  els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modalOverlay.hidden) closeModal();
  });

  loadCatalog();
  setInterval(loadCatalog, CONFIG.AUTO_REFRESH_MS);
});

/* ------------------------------------------------------------------------
   Carga de datos desde el CSV publicado
   ------------------------------------------------------------------------ */
function loadCatalog() {
  if (!CONFIG.SHEET_CSV_URL || CONFIG.SHEET_CSV_URL.includes("PEGAR_AQUI")) {
    showStatus(
      "Todavía no configuraste la URL de la planilla. Completá CONFIG.SHEET_CSV_URL arriba de todo en script.js. Mientras tanto, te mostramos productos de ejemplo.",
      "info"
    );
    allProducts = DEMO_PRODUCTS;
    finishLoad();
    return;
  }

  // "cache bust": le agregamos un parámetro único a la URL para que el
  // navegador no nos devuelva una copia vieja guardada en caché.
  const url = CONFIG.SHEET_CSV_URL + (CONFIG.SHEET_CSV_URL.includes("?") ? "&" : "?") + "_=" + Date.now();

  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      try {
        const products = results.data.map(normalizeRow).filter((p) => p.name !== "");
        if (products.length === 0) {
          showStatus(
            "La planilla se pudo leer pero no encontramos ninguna fila con la columna 'nombre' completa. Revisá los encabezados de la primera fila.",
            "info"
          );
        } else {
          hideStatus();
        }
        allProducts = products;
      } catch (err) {
        // Si algo inesperado rompe el procesamiento, no dejamos la página
        // en blanco: mostramos el aviso y seguimos con lo último que
        // teníamos cargado (o la demo si es la primera carga).
        console.error("Error procesando la planilla:", err);
        showStatus("Ocurrió un error interpretando los datos de la planilla. Mostrando la última versión disponible.", "error");
        if (allProducts.length === 0) allProducts = DEMO_PRODUCTS;
      }
      finishLoad();
    },
    error: (err) => {
      console.error("Error descargando el CSV:", err);
      showStatus(
        "No se pudo leer la planilla. Revisá que CONFIG.SHEET_CSV_URL sea correcta y que siga publicada como CSV.",
        "error"
      );
      if (allProducts.length === 0) allProducts = DEMO_PRODUCTS;
      finishLoad();
    },
  });
}

function finishLoad() {
  buildCategoryChips();
  renderGrid();
}

/* ------------------------------------------------------------------------
   Normalización de filas de la planilla
   ------------------------------------------------------------------------ */

// Quita tildes y pasa a minúscula: "Categoría" y "categoria" quedan iguales.
function normalizeHeader(text) {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeRow(rawRow) {
  // Papa Parse nos da un objeto por fila con las claves tal cual están
  // escritas en la planilla. Acá lo pasamos a un objeto con claves
  // "limpias" (sin tildes, en minúscula) para no depender de cómo
  // exactamente se escribió el encabezado.
  const row = {};
  for (const key in rawRow) {
    row[normalizeHeader(key)] = (rawRow[key] ?? "").toString().trim();
  }

  return {
    name: row[COLUMNS.name] || "",
    category: row[COLUMNS.category] || "General",
    subcategory: row[COLUMNS.subcategory] || "",
    price: parsePrice(row[COLUMNS.price]),
    currency: row[COLUMNS.currency] || "",
    hasIVA: isIVA(row[COLUMNS.iva]),
    code: row[COLUMNS.code] || "",
    lab: row[COLUMNS.lab] || "",
    description: row[COLUMNS.description] || "",
    imageUrl: toDirectDriveUrl(row[COLUMNS.image]),
  };
}

// Acepta "10", "10.500", "10.500,50" o "$10.500". Devuelve un número o null.
function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Formatea el precio igual que antes: "$ 8.500"
function formatPrice(n) {
  if (n === null || n === undefined) return "Consultar";
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// La columna IVA solo dispara el cartel "+IVA" si dice, literalmente,
// "+iva" o "iva" (sin importar mayúsculas/espacios). Cualquier otro
// valor (vacío, "no", etc.) no muestra nada.
function isIVA(raw) {
  if (!raw) return false;
  return /^\+?\s*iva$/i.test(raw.trim());
}

/* ------------------------------------------------------------------------
   Conversión de links de Google Drive a URL de imagen directa.
   Acepta los formatos típicos que da el botón "Compartir" de Drive.
   ------------------------------------------------------------------------ */
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
  if (!id) return url; // no era un link de Drive: se usa tal cual
  return `https://lh3.googleusercontent.com/d/${id}=w${CONFIG.IMAGE_WIDTH}`;
}

/* ------------------------------------------------------------------------
   Chips de categoría
   ------------------------------------------------------------------------ */
function buildCategoryChips() {
  const categories = [...new Set(allProducts.map((p) => p.category))].sort();
  categoryColorMap = {};
  categories.forEach((c, i) => (categoryColorMap[c] = CATEGORY_COLORS[i % CATEGORY_COLORS.length]));

  els.categoryChips.innerHTML = "";
  els.categoryChips.appendChild(makeChip("Todas", null));
  categories.forEach((c) => els.categoryChips.appendChild(makeChip(c, c)));
}

function makeChip(label, value) {
  const chip = document.createElement("button");
  chip.className = "chip" + (activeCategory === value ? " active" : "");
  chip.textContent = label;
  chip.type = "button";
  chip.addEventListener("click", () => {
    activeCategory = value;
    buildCategoryChips();
    renderGrid();
  });
  return chip;
}

/* ------------------------------------------------------------------------
   Grilla de productos
   ------------------------------------------------------------------------ */
function renderGrid() {
  const filtered = allProducts.filter((p) => {
    if (activeCategory && p.category !== activeCategory) return false;
    if (searchTerm) {
      const haystack = `${p.name} ${p.category} ${p.subcategory} ${p.code} ${p.lab}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  els.grid.innerHTML = "";

  if (filtered.length === 0) {
    els.emptyState.hidden = false;
    return;
  }
  els.emptyState.hidden = true;

  // DocumentFragment: arma todas las tarjetas en memoria y las inserta de
  // una sola vez, en lugar de tocar el DOM producto por producto.
  const fragment = document.createDocumentFragment();
  filtered.forEach((p) => fragment.appendChild(buildCard(p)));
  els.grid.appendChild(fragment);
}

// Arma el texto "$ 8.500 ARS +IVA" (moneda e IVA son opcionales)
function priceLineHtml(p) {
  const currency = p.currency ? ` <span class="card-currency">${escapeHtml(p.currency)}</span>` : "";
  const iva = p.hasIVA ? ` <span class="iva-tag">+IVA</span>` : "";
  return `<span class="card-price">${formatPrice(p.price)}</span>${currency}${iva}`;
}

function buildCard(p) {
  const card = document.createElement("article");
  card.className = "product-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Ver detalle de ${p.name}`);

  const strip = document.createElement("div");
  strip.className = "card-strip";
  strip.style.background = categoryColorMap[p.category] || CATEGORY_COLORS[0];
  card.appendChild(strip);

  if (p.code) {
    const codeTag = document.createElement("span");
    codeTag.className = "card-code";
    codeTag.textContent = p.code;
    card.appendChild(codeTag);
  }

  const media = document.createElement("div");
  media.className = "card-media";
  media.appendChild(buildImageEl(p, false));
  card.appendChild(media);

  const body = document.createElement("div");
  body.className = "card-body";
  body.innerHTML = `
    <h3 class="card-title">${escapeHtml(p.name)}</h3>
    <span class="card-category">${escapeHtml(p.category)}</span>
    ${p.subcategory ? `<span class="card-subcategory">${escapeHtml(p.subcategory)}</span>` : ""}
    <div class="card-footer">${priceLineHtml(p)}</div>
  `;
  card.appendChild(body);

  // La tarjeta entera (incluida la imagen) abre el detalle, por click o
  // por teclado (Enter / espacio) para que sea accesible.
  card.addEventListener("click", () => openModal(p));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openModal(p);
    }
  });

  return card;
}

// Crea el <img> (o el cartel "sin imagen") para tarjeta o modal
function buildImageEl(p, large) {
  if (!p.imageUrl) {
    const placeholder = document.createElement("div");
    placeholder.className = "no-image";
    placeholder.textContent = "Sin imagen";
    return placeholder;
  }
  const img = document.createElement("img");
  img.src = p.imageUrl;
  img.alt = p.name;
  img.loading = large ? "eager" : "lazy";
  img.onerror = () => {
    img.replaceWith(Object.assign(document.createElement("div"), {
      className: "no-image",
      textContent: "Imagen no disponible",
    }));
  };
  return img;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* ------------------------------------------------------------------------
   Modal de detalle (punto 7.2 del pedido)
   ------------------------------------------------------------------------ */
function openModal(p) {
  lastFocusedElement = document.activeElement;

  els.modalBody.innerHTML = "";

  const media = document.createElement("div");
  media.className = "modal-media";
  media.appendChild(buildImageEl(p, true));

  const info = document.createElement("div");
  info.className = "modal-info";
  info.innerHTML = `
    <h2 id="modal-title">${escapeHtml(p.name)}</h2>
    <span class="modal-category">${escapeHtml(p.category)}</span>
    ${p.subcategory ? `<span class="modal-subcategory">${escapeHtml(p.subcategory)}</span>` : ""}
    <div class="modal-price-row">${priceLineHtmlModal(p)}</div>
    ${p.lab ? `<div class="modal-row"><span class="k">Laboratorio</span><span>${escapeHtml(p.lab)}</span></div>` : ""}
    ${p.description ? `<p class="modal-desc">${escapeHtml(p.description)}</p>` : ""}
  `;

  els.modalBody.appendChild(media);
  els.modalBody.appendChild(info);

  els.modalOverlay.hidden = false;
  document.body.style.overflow = "hidden"; // evita el scroll de fondo
  els.modalClose.focus();
}

function priceLineHtmlModal(p) {
  const currency = p.currency ? ` <span class="card-currency">${escapeHtml(p.currency)}</span>` : "";
  const iva = p.hasIVA ? ` <span class="iva-tag">+IVA</span>` : "";
  return `<span class="modal-price">${formatPrice(p.price)}</span>${currency}${iva}`;
}

function closeModal() {
  els.modalOverlay.hidden = true;
  document.body.style.overflow = "";
  if (lastFocusedElement) lastFocusedElement.focus();
}

/* ------------------------------------------------------------------------
   Banner de estado (avisos y errores de carga)
   ------------------------------------------------------------------------ */
function showStatus(msg, type) {
  els.statusBanner.hidden = false;
  els.statusBanner.textContent = msg;
  els.statusBanner.className = "status-banner" + (type === "info" ? " info" : "");
}
function hideStatus() {
  els.statusBanner.hidden = true;
}

/* ------------------------------------------------------------------------
   Datos de ejemplo — solo se muestran si todavía no configuraste
   CONFIG.SHEET_CSV_URL, o si falla la lectura de la planilla.
   ------------------------------------------------------------------------ */
const DEMO_PRODUCTS = [
  { name: "Reactivo Buffer Fosfato PBS 1X", category: "Reactivos", subcategory: "Buffers", price: 8500, currency: "ARS", hasIVA: true, code: "RF-1042", lab: "BioLab SA", description: "Solución tamponadora estéril, pH 7.4, uso general en cultivo celular.", imageUrl: null },
  { name: "Tubos Falcon 15 ml", category: "Descartables", subcategory: "Tubos", price: 3200, currency: "ARS", hasIVA: false, code: "DS-2210", lab: "PlastiCiencia", description: "Tubos cónicos estériles con tapa a rosca, graduados.", imageUrl: null },
  { name: "Kit Extracción de ADN", category: "Kits", subcategory: "Genómica", price: 45200, currency: "USD", hasIVA: true, code: "KT-0091", lab: "GenTech", description: "Kit de columna para extracción de ADN genómico de muestras de tejido.", imageUrl: null },
  { name: "Guantes de Nitrilo Talle M", category: "Descartables", subcategory: "Protección", price: 6100, currency: "ARS", hasIVA: false, code: "DS-3305", lab: "SafeHand", description: "Guantes sin polvo, resistentes a solventes.", imageUrl: null },
];
