const CONFIG = {
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQC4BFXcTT1kYiQALcRtU2X4EkKqAbXc1tf0hfLzsaZbofK_AaDVn6X6Nj9Vlx-6ld484FGk1VHG1Y2/pub?gid=0&single=true&output=csv",

  // Nombre y bajada que se muestran en el encabezado
  LAB_NAME: "EquiVet",
  LAB_SUBTITLE: "SLOGAN",

  // Cada cuánto se vuelve a consultar la planilla automáticamente (ms)
  AUTO_REFRESH_MS: 30000,

  // Ancho de imagen solicitado a Drive (afecta performance de carga)
  IMAGE_WIDTH: 500,
};

// Paleta cíclica para la franja superior de cada tarjeta, según categoría
const STRIP_COLORS = ["#2F6F5E", "#46617A", "#BE5F2C", "#7C8F5C"];

/* ------------------------------------------------------------------------
   Estado
   ------------------------------------------------------------------------ */
let allProducts = [];
let activeCategory = null;
let searchTerm = "";
let categoryColorMap = {};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  els.grid = document.getElementById("catalog-grid");
  els.statusBanner = document.getElementById("status-banner");
  els.emptyState = document.getElementById("empty-state");
  els.lastUpdated = document.getElementById("last-updated");
  els.productCount = document.getElementById("product-count");
  els.refreshBtn = document.getElementById("refresh-btn");
  els.searchInput = document.getElementById("search-input");
  els.categoryChips = document.getElementById("category-chips");
  els.labName = document.getElementById("lab-name");
  els.labSub = document.getElementById("lab-sub");

  els.labName.textContent = CONFIG.LAB_NAME;
  els.labSub.textContent = CONFIG.LAB_SUBTITLE;

  els.refreshBtn.addEventListener("click", () => loadCatalog(true));
  els.searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderGrid();
  });

  loadCatalog(false);
  setInterval(() => loadCatalog(true), CONFIG.AUTO_REFRESH_MS);
});

/* ------------------------------------------------------------------------
   Carga de datos desde el CSV publicado
   ------------------------------------------------------------------------ */
function loadCatalog(isManualOrAuto) {
  if (!CONFIG.SHEET_CSV_URL || CONFIG.SHEET_CSV_URL.includes("PEGAR_AQUI")) {
    showStatus(
      "Todavía no configuraste la URL de la planilla. Abrí script.js y completá SHEET_CSV_URL (ver README.md). Mientras tanto, te mostramos productos de ejemplo.",
      "info"
    );
    allProducts = DEMO_PRODUCTS;
    finishLoad();
    return;
  }

  if (isManualOrAuto) els.refreshBtn.classList.add("spinning");

  // "cache bust" para que el navegador no devuelva una copia vieja del CSV
  const url = CONFIG.SHEET_CSV_URL + (CONFIG.SHEET_CSV_URL.includes("?") ? "&" : "?") + "_=" + Date.now();

  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      const rows = results.data.filter((r) => (r.Nombre || r.nombre || "").trim() !== "");
      if (rows.length === 0) {
        showStatus("La planilla se pudo leer pero no tiene filas de productos válidas. Revisá que la primera fila tenga los encabezados de columna correctos.", "info");
      } else {
        hideStatus();
      }
      allProducts = rows.map(normalizeRow);
      finishLoad();
    },
    error: (err) => {
      console.error(err);
      showStatus(
        "No se pudo leer la planilla (¿la URL de SHEET_CSV_URL es correcta y está publicada como CSV?). Mostrando productos de ejemplo mientras tanto.",
        "error"
      );
      allProducts = DEMO_PRODUCTS;
      finishLoad();
    },
  });
}

function finishLoad() {
  buildCategoryChips();
  renderGrid();
  els.lastUpdated.textContent = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  els.refreshBtn.classList.remove("spinning");
}

/* ------------------------------------------------------------------------
   Normalización de filas — acepta encabezados en español, con o sin tilde
   ------------------------------------------------------------------------ */
function getField(row, ...keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") return String(row[k]).trim();
  }
  return "";
}

function normalizeRow(row) {
  const name = getField(row, "Nombre", "nombre", "Producto");
  const category = getField(row, "Categoria", "Categoría", "categoria") || "General";
  const priceRaw = getField(row, "Precio", "precio");
  const description = getField(row, "Descripcion", "Descripción", "descripcion");
  const ref = getField(row, "REF", "Ref", "Codigo", "Código", "SKU");
  const presentation = getField(row, "Presentacion", "Presentación", "presentacion");
  const stockRaw = getField(row, "Stock", "Disponibilidad", "stock").toLowerCase();
  const imageRaw = getField(row, "Imagen", "ImagenURL", "Imagen URL", "Foto", "Link Imagen");

  return {
    name,
    category,
    price: parsePrice(priceRaw),
    priceRaw,
    description,
    ref,
    presentation,
    inStock: !(stockRaw.includes("sin stock") || stockRaw.includes("agotado") || stockRaw === "no"),
    imageUrl: toDirectDriveUrl(imageRaw),
  };
}

function parsePrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function formatPrice(n) {
  if (n === null || n === undefined) return "Consultar";
  return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* ------------------------------------------------------------------------
   Conversión de links de Google Drive a URL de imagen directa
   Acepta:
     https://drive.google.com/file/d/FILE_ID/view?usp=sharing
     https://drive.google.com/open?id=FILE_ID
     https://drive.google.com/uc?id=FILE_ID
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
  if (!id) return url; // ya es una URL directa a otra imagen (no Drive)
  return `https://lh3.googleusercontent.com/d/${id}=w${CONFIG.IMAGE_WIDTH}`;
}

/* ------------------------------------------------------------------------
   Render
   ------------------------------------------------------------------------ */
function buildCategoryChips() {
  const categories = [...new Set(allProducts.map((p) => p.category))].sort();
  categoryColorMap = {};
  categories.forEach((c, i) => (categoryColorMap[c] = STRIP_COLORS[i % STRIP_COLORS.length]));

  els.categoryChips.innerHTML = "";
  const allChip = makeChip("Todas", null);
  els.categoryChips.appendChild(allChip);
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

function renderGrid() {
  const filtered = allProducts.filter((p) => {
    if (activeCategory && p.category !== activeCategory) return false;
    if (searchTerm) {
      const haystack = `${p.name} ${p.category} ${p.ref} ${p.description}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  els.productCount.textContent = allProducts.length;
  els.grid.innerHTML = "";

  if (filtered.length === 0) {
    els.emptyState.hidden = false;
    return;
  }
  els.emptyState.hidden = true;

  filtered.forEach((p) => els.grid.appendChild(buildCard(p)));
}

function buildCard(p) {
  const card = document.createElement("article");
  card.className = "product-card";

  const strip = document.createElement("div");
  strip.className = "card-strip";
  strip.style.background = categoryColorMap[p.category] || "#2F6F5E";
  card.appendChild(strip);

  if (p.ref) {
    const refTag = document.createElement("span");
    refTag.className = "card-ref";
    refTag.textContent = p.ref;
    card.appendChild(refTag);
  }

  const media = document.createElement("div");
  media.className = "card-media";
  if (p.imageUrl) {
    const img = document.createElement("img");
    img.src = p.imageUrl;
    img.alt = p.name;
    img.loading = "lazy";
    img.onerror = () => {
      media.innerHTML = '<div class="no-image">Imagen no disponible</div>';
    };
    media.appendChild(img);
  } else {
    media.innerHTML = '<div class="no-image">Sin imagen</div>';
  }
  card.appendChild(media);

  const body = document.createElement("div");
  body.className = "card-body";

  body.innerHTML = `
    <span class="card-category">${escapeHtml(p.category)}</span>
    <h3 class="card-title">${escapeHtml(p.name)}</h3>
    ${p.description ? `<p class="card-desc">${escapeHtml(p.description)}</p>` : ""}
    <div class="spec-rows">
      ${p.presentation ? `<div class="spec-row"><span class="k">Presentación</span><span class="v">${escapeHtml(p.presentation)}</span></div>` : ""}
    </div>
    <div class="card-footer">
      <span class="card-price">${formatPrice(p.price)}</span>
      <span class="stock-tag ${p.inStock ? "in" : "out"}">${p.inStock ? "En stock" : "Sin stock"}</span>
    </div>
  `;
  card.appendChild(body);

  return card;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ------------------------------------------------------------------------
   Banner de estado
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
   Datos de ejemplo — se muestran solo si todavía no configuraste la planilla
   ------------------------------------------------------------------------ */
const DEMO_PRODUCTS = [
  { name: "Reactivo Buffer Fosfato PBS 1X", category: "Reactivos", price: 8500, description: "Solución tamponadora estéril, pH 7.4, uso general en cultivo celular.", ref: "RF-1042", presentation: "Botella x 500 ml", inStock: true, imageUrl: null },
  { name: "Tubos Falcon 15 ml", category: "Descartables", price: 3200, description: "Tubos cónicos estériles con tapa a rosca, graduados.", ref: "DS-2210", presentation: "Pack x 50 u.", inStock: true, imageUrl: null },
  { name: "Kit Extracción de ADN", category: "Kits", price: 45200, description: "Kit de columna para extracción de ADN genómico de muestras de tejido.", ref: "KT-0091", presentation: "Caja x 50 extracciones", inStock: false, imageUrl: null },
  { name: "Guantes de Nitrilo Talle M", category: "Descartables", price: 6100, description: "Guantes sin polvo, resistentes a solventes.", ref: "DS-3305", presentation: "Caja x 100 u.", inStock: true, imageUrl: null },
];
