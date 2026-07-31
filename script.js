/* =========================================================================
   CONFIGURACIÓN — Lo único que normalmente vas a tocar.
   ========================================================================= */
const CONFIG = {
  // URL del CSV publicado (Archivo > Compartir > Publicar en la Web > CSV)
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQC4BFXcTT1kYiQALcRtU2X4EkKqAbXc1tf0hfLzsaZbofK_AaDVn6X6Nj9Vlx-6ld484FGk1VHG1Y2/pub?gid=0&single=true&output=csv",

  // Nombre y bajada que se muestran arriba de todo, centrados
  LAB_NAME: "EquiVet",
  LAB_SUBTITLE: "SLOGAN",

  // Cada cuánto se vuelve a consultar la planilla sola, en milisegundos
  AUTO_REFRESH_MS: 30000,

  // Ancho de imagen que se le pide a Drive
  IMAGE_WIDTH: 500,

  // ---- Datos de destino del pedido: A DÓNDE TE LLEGA A VOS ----
  // El email tuyo (o del laboratorio) donde querés recibir los pedidos.
  ORDER_EMAIL: "nbustelo.equivet@gmail.com",

  // Asunto FIJO para todos los mails de cotización que salen desde la página.
  // Se usa siempre el mismo texto (sin nombre del cliente ni nada variable)
  // para que después en tu casilla de mail puedas filtrarlos/agruparlos
  // todos en una misma carpeta por asunto.
  ORDER_EMAIL_SUBJECT: "Pedido de cotización - EquiVet",

  // ---- Datos de contacto de la empresa (sección "Contacto" al pie del catálogo) ----
  // Link de Instagram al que se redirige al hacer click.
  COMPANY_INSTAGRAM_URL: "https://instagram.com/tu_usuario",
  COMPANY_INSTAGRAM_HANDLE: "@tu_usuario",

  // WhatsApp de la empresa para que el cliente abra el chat directo (esto es
  // distinto del WhatsApp que el cliente carga como su propio dato de contacto).
  // Mismo formato que antes: internacional, sin "+" y sin espacios.
  COMPANY_WHATSAPP_NUMBER: "5491140780872",
  COMPANY_WHATSAPP_DISPLAY: "+54 9 11 4078-0872",

  // Email de la empresa. Se usa para el link "mailto" de la sección de contacto
  // (podés repetir ORDER_EMAIL o poner otro distinto).
  COMPANY_EMAIL: "nbustelo.equivet@gmail.com",

  // Horarios laborales, en texto libre.
  COMPANY_HOURS: "Lunes a viernes de 9 a 18 hs",

  // Dirección física de la empresa. Se usa tanto para mostrarla en texto
  // como para armar el mapa y el link a Google Maps.
  COMPANY_ADDRESS: "Av. Ejemplo 1234, Buenos Aires, Argentina",
};

/* Colores para distinguir categorías a simple vista. */
const CATEGORY_COLORS = [
  "#b200ff", "#000000", "#ff2ecb", "#00b3c6", "#ff7a00",
  "#00a651", "#ffcc00", "#e63946", "#3a5cff", "#8c52ff",
];

/* Columnas que el programa busca en la planilla (sin importar mayúsculas
   ni tildes). El precio, moneda e IVA se siguen leyendo por si los usás en
   el futuro, pero a propósito NO se muestran en la página: el cliente solo
   ve "En stock" / "A pedido" (columna "disponibilidad"). */
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
  availability: "disponibilidad",
};

/* ------------------------------------------------------------------------
   Estado de la aplicación
   ------------------------------------------------------------------------ */
let allProducts = [];
let activeCategory = null;
let searchTerm = "";
let categoryColorMap = {};

// El carrito es un objeto: { claveDelProducto: { product, qty } }
let cart = {};
// Referencias a los "En tu pedido: N" de cada tarjeta, para actualizarlos
// sin tener que reconstruir toda la grilla cada vez que cambia el carrito.
let cartIndicatorEls = {};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  els.labName.textContent = CONFIG.LAB_NAME;
  els.labSub.textContent = CONFIG.LAB_SUBTITLE;

  setupSearch();
  setupModalClosers();
  setupCartModal();
  setupCompanyContact();

  loadCatalog();
  setInterval(loadCatalog, CONFIG.AUTO_REFRESH_MS);
});

function cacheElements() {
  els.grid = document.getElementById("catalog-grid");
  els.statusBanner = document.getElementById("status-banner");
  els.emptyState = document.getElementById("empty-state");
  els.searchInput = document.getElementById("search-input");
  els.categoryChips = document.getElementById("category-chips");
  els.labName = document.getElementById("lab-name");
  els.labSub = document.getElementById("lab-sub");

  els.productModal = document.getElementById("product-modal");
  els.modalBody = document.getElementById("modal-body");

  els.cartFab = document.getElementById("cart-fab");
  els.cartCount = document.getElementById("cart-count");
  els.cartModal = document.getElementById("cart-modal");
  els.cartItemsEl = document.getElementById("cart-items");
  els.cartEmptyEl = document.getElementById("cart-empty");
  els.cartNombre = document.getElementById("cart-nombre");
  els.cartApellido = document.getElementById("cart-apellido");
  els.cartWhatsapp = document.getElementById("cart-whatsapp");
  els.cartEmail = document.getElementById("cart-email");
  els.cartStatus = document.getElementById("cart-status");
  els.clearCartBtn = document.getElementById("clear-cart-btn");
  els.sendEmailBtn = document.getElementById("send-email-btn");

  els.contactInstagram = document.getElementById("contact-instagram");
  els.contactInstagramValue = document.getElementById("contact-instagram-value");
  els.contactWhatsapp = document.getElementById("contact-whatsapp");
  els.contactWhatsappValue = document.getElementById("contact-whatsapp-value");
  els.contactGmail = document.getElementById("contact-gmail");
  els.contactGmailValue = document.getElementById("contact-gmail-value");
  els.contactHoursValue = document.getElementById("contact-hours-value");
  els.contactAddressValue = document.getElementById("contact-address-value");
  els.contactMapLink = document.getElementById("contact-map-link");
  els.contactMapIframe = document.getElementById("contact-map-iframe");
}

/* ------------------------------------------------------------------------
   Carga de datos desde el CSV publicado
   ------------------------------------------------------------------------ */
function loadCatalog() {
  if (!CONFIG.SHEET_CSV_URL || CONFIG.SHEET_CSV_URL.includes("PEGAR_AQUI")) {
    showStatus("Todavía no configuraste CONFIG.SHEET_CSV_URL en script.js. Mostrando productos de ejemplo.", "info");
    allProducts = DEMO_PRODUCTS;
    finishLoad();
    return;
  }

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
    price: parsePrice(row[COLUMNS.price]),       // se lee pero no se muestra
    currency: row[COLUMNS.currency] || "",        // se lee pero no se muestra
    hasIVA: isIVA(row[COLUMNS.iva]),              // se lee pero no se muestra
    code: row[COLUMNS.code] || "",
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

// La columna "disponibilidad" solo distingue dos estados para el cliente:
// si el texto incluye la palabra "pedido" (ej. "A pedido") se muestra así;
// cualquier otro valor, o la celda vacía, se toma como "En stock".
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

// Clave única por producto: preferimos el código; si no tiene, usamos
// nombre+categoría para evitar mezclar productos distintos sin código.
function productKey(p) {
  return p.code ? `code:${p.code}` : `nc:${p.name}|${p.category}`;
}

/* ------------------------------------------------------------------------
   Búsqueda
   ------------------------------------------------------------------------ */
function setupSearch() {
  let debounceTimer;
  els.searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    const value = e.target.value;
    debounceTimer = setTimeout(() => {
      searchTerm = value.trim().toLowerCase();
      renderGrid();
    }, 200);
  });
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
  cartIndicatorEls = {};

  if (filtered.length === 0) {
    els.emptyState.hidden = false;
    return;
  }
  els.emptyState.hidden = true;

  const fragment = document.createDocumentFragment();
  filtered.forEach((p) => fragment.appendChild(buildCard(p)));
  els.grid.appendChild(fragment);
}

function availabilityTagHtml(p) {
  const cls = p.availability === "En stock" ? "in" : "out";
  return `<span class="avail-tag ${cls}">${escapeHtml(p.availability)}</span>`;
}

function buildCard(p) {
  const key = productKey(p);

  const card = document.createElement("article");
  card.className = "product-card";

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
  media.addEventListener("click", () => openProductModal(p));
  card.appendChild(media);

  const body = document.createElement("div");
  body.className = "card-body";
  body.innerHTML = `
    <h3 class="card-title">${escapeHtml(p.name)}</h3>
    <span class="card-category">${escapeHtml(p.category)}</span>
    ${p.subcategory ? `<span class="card-subcategory">${escapeHtml(p.subcategory)}</span>` : ""}
    <div class="card-footer">${availabilityTagHtml(p)}</div>
  `;
  body.querySelector(".card-title").addEventListener("click", () => openProductModal(p));

  const cartRow = buildCartRow(p, key);
  body.appendChild(cartRow.wrapper);
  card.appendChild(body);

  cartIndicatorEls[key] = cartRow.indicatorEl;
  updateCartIndicator(key);

  return card;
}

// Controles de cantidad + botón "Agregar" (reutilizados en tarjeta y modal)
function buildCartRow(p, key) {
  const wrapper = document.createElement("div");
  wrapper.className = "card-cart-row";

  const qtyControl = document.createElement("div");
  qtyControl.className = "qty-control";

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.className = "qty-btn";
  minusBtn.textContent = "−";
  minusBtn.setAttribute("aria-label", "Restar uno");

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.className = "qty-input";
  qtyInput.min = "0";
  qtyInput.value = "1";
  qtyInput.setAttribute("aria-label", `Cantidad de ${p.name}`);

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.className = "qty-btn";
  plusBtn.textContent = "+";
  plusBtn.setAttribute("aria-label", "Sumar uno");

  const stopBubble = (fn) => (e) => { e.stopPropagation(); fn(e); };

  minusBtn.addEventListener("click", stopBubble(() => {
    qtyInput.value = Math.max(0, safeInt(qtyInput.value) - 1);
  }));
  plusBtn.addEventListener("click", stopBubble(() => {
    qtyInput.value = safeInt(qtyInput.value) + 1;
  }));
  qtyInput.addEventListener("click", (e) => e.stopPropagation());

  qtyControl.append(minusBtn, qtyInput, plusBtn);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-btn";
  addBtn.textContent = "Agregar";
  addBtn.addEventListener("click", stopBubble(() => {
    const qty = safeInt(qtyInput.value);
    if (qty <= 0) {
      removeFromCart(key);
    } else {
      addToCart(p, key, qty);
    }
  }));

  wrapper.append(qtyControl, addBtn);

  const indicatorEl = document.createElement("div");
  indicatorEl.className = "cart-indicator";
  indicatorEl.hidden = true;

  const outer = document.createElement("div");
  outer.appendChild(wrapper);
  outer.appendChild(indicatorEl);

  return { wrapper: outer, indicatorEl };
}

function safeInt(value) {
  const n = parseInt(value, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

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
   Modal de detalle de producto
   ------------------------------------------------------------------------ */
function openProductModal(p) {
  const key = productKey(p);
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
    <div class="modal-avail-row">${availabilityTagHtml(p)}</div>
    ${p.lab ? `<div class="modal-row"><span class="k">Laboratorio</span><span>${escapeHtml(p.lab)}</span></div>` : ""}
    ${p.description ? `<p class="modal-desc">${escapeHtml(p.description)}</p>` : ""}
  `;

  const cartRow = buildCartRow(p, key);
  cartRow.wrapper.querySelector(".card-cart-row").classList.add("modal-cart-row");
  info.appendChild(cartRow.wrapper);

  els.modalBody.appendChild(media);
  els.modalBody.appendChild(info);

  // El indicador de este modal también se registra para poder actualizarlo,
  // sobrescribiendo temporalmente al de la tarjeta (se reconstruye cuando
  // se cierra el modal, ver closeAllModals).
  cartIndicatorEls[key] = cartRow.indicatorEl;
  updateCartIndicator(key);

  openModalEl(els.productModal);
}

/* ------------------------------------------------------------------------
   Apertura / cierre genérico de modales
   ------------------------------------------------------------------------ */
function openModalEl(modalEl) {
  modalEl.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModalEl(modalEl) {
  modalEl.hidden = true;
  if (els.productModal.hidden && els.cartModal.hidden) {
    document.body.style.overflow = "";
  }
  // Al cerrar, reconstruimos la grilla para que los indicadores de cantidad
  // vuelvan a apuntar a los elementos de las tarjetas (y no a los del modal).
  if (modalEl === els.productModal) renderGrid();
}

function setupModalClosers() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModalEl(document.getElementById(btn.dataset.closeModal)));
  });
  [els.productModal, els.cartModal].forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModalEl(overlay);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!els.cartModal.hidden) closeModalEl(els.cartModal);
    else if (!els.productModal.hidden) closeModalEl(els.productModal);
  });
}

/* ------------------------------------------------------------------------
   Contacto de la empresa (Instagram, WhatsApp, email, horarios y mapa)
   ------------------------------------------------------------------------ */
function setupCompanyContact() {
  // Instagram: abre la cuenta directamente.
  els.contactInstagram.href = CONFIG.COMPANY_INSTAGRAM_URL;
  els.contactInstagramValue.textContent = CONFIG.COMPANY_INSTAGRAM_HANDLE;

  // WhatsApp: abre el chat con la empresa (wa.me sin texto precargado).
  els.contactWhatsapp.href = `https://wa.me/${CONFIG.COMPANY_WHATSAPP_NUMBER}`;
  els.contactWhatsappValue.textContent = CONFIG.COMPANY_WHATSAPP_DISPLAY;

  // Gmail: abre gmail.com con un mail nuevo, destinatario y asunto ya cargados.
  els.contactGmail.href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(CONFIG.COMPANY_EMAIL)}&su=${encodeURIComponent(CONFIG.COMPANY_EMAIL)}`;
  els.contactGmailValue.textContent = CONFIG.COMPANY_EMAIL;

  // Horarios: texto libre tal cual se configuró.
  els.contactHoursValue.textContent = CONFIG.COMPANY_HOURS;

  // Ubicación: dirección en texto + mapa embebido, todo apuntando a la
  // misma dirección de CONFIG.COMPANY_ADDRESS. Al tocar el mapa se abre
  // Google Maps en una pestaña nueva con esa ubicación.
  els.contactAddressValue.textContent = CONFIG.COMPANY_ADDRESS;
  const encodedAddress = encodeURIComponent(CONFIG.COMPANY_ADDRESS);
  els.contactMapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
  els.contactMapIframe.src = `https://www.google.com/maps?q=${encodedAddress}&output=embed`;
}

/* ------------------------------------------------------------------------
   Carrito
   ------------------------------------------------------------------------ */
function addToCart(product, key, qty) {
  cart[key] = { product, qty };
  updateCartIndicator(key);
  updateCartFabCount();
}

function removeFromCart(key) {
  delete cart[key];
  updateCartIndicator(key);
  updateCartFabCount();
  renderCartModal();
}

function updateCartIndicator(key) {
  const el = cartIndicatorEls[key];
  if (!el) return;
  const entry = cart[key];
  if (entry && entry.qty > 0) {
    el.hidden = false;
    el.textContent = `En tu pedido: ${entry.qty}`;
  } else {
    el.hidden = true;
    el.textContent = "";
  }
}

function updateCartFabCount() {
  const distinctItems = Object.keys(cart).length;
  els.cartCount.hidden = distinctItems === 0;
  els.cartCount.textContent = String(distinctItems);
}

function setupCartModal() {
  els.cartFab.addEventListener("click", () => {
    renderCartModal();
    openModalEl(els.cartModal);
  });

  els.clearCartBtn.addEventListener("click", () => {
    cart = {};
    Object.keys(cartIndicatorEls).forEach(updateCartIndicator);
    updateCartFabCount();
    renderCartModal();
    showCartStatus("Vaciaste tu pedido.", "success");
  });

  els.sendEmailBtn.addEventListener("click", sendOrder);
}

function renderCartModal() {
  const items = Object.entries(cart);
  els.cartItemsEl.innerHTML = "";
  els.cartEmptyEl.hidden = items.length > 0;

  items.forEach(([key, entry]) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(entry.product.name)}</div>
        <div class="cart-item-meta">${escapeHtml(entry.product.code || entry.product.category)}</div>
      </div>
    `;

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.className = "cart-item-qty";
    qtyInput.value = String(entry.qty);
    qtyInput.setAttribute("aria-label", `Cantidad de ${entry.product.name}`);
    qtyInput.addEventListener("change", () => {
      const qty = safeInt(qtyInput.value);
      if (qty <= 0) {
        removeFromCart(key);
      } else {
        entry.qty = qty;
        updateCartIndicator(key);
      }
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "cart-item-remove";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", `Quitar ${entry.product.name}`);
    removeBtn.addEventListener("click", () => removeFromCart(key));

    row.appendChild(qtyInput);
    row.appendChild(removeBtn);
    els.cartItemsEl.appendChild(row);
  });
}

function showCartStatus(msg, type) {
  els.cartStatus.hidden = false;
  els.cartStatus.textContent = msg;
  els.cartStatus.className = "cart-status " + type;
}
function hideCartStatus() {
  els.cartStatus.hidden = true;
}

/* ------------------------------------------------------------------------
   Envío del pedido por Email — sin backend: se arma el mensaje y se abre
   el cliente de correo ya con el texto cargado. La persona que hace el
   pedido tiene que confirmar el envío desde ahí; nosotros no mandamos
   nada automáticamente por su cuenta.

   El asunto es SIEMPRE el mismo (CONFIG.ORDER_EMAIL_SUBJECT) para todos
   los pedidos, así en la casilla de mail se pueden agrupar/filtrar todos
   juntos en una misma carpeta por asunto.
   ------------------------------------------------------------------------ */
function sendOrder() {
  hideCartStatus();

  const items = Object.values(cart);
  const nombre = els.cartNombre.value.trim();
  const apellido = els.cartApellido.value.trim();
  const whatsapp = els.cartWhatsapp.value.trim();
  const email = els.cartEmail.value.trim();

  if (items.length === 0) {
    showCartStatus("Todavía no agregaste ningún producto al pedido.", "error");
    return;
  }
  if (!nombre || !apellido) {
    showCartStatus("Completá nombre y apellido/entidad antes de enviar.", "error");
    return;
  }
  if (!whatsapp && !email) {
    showCartStatus("Dejanos un WhatsApp o un Email de contacto.", "error");
    return;
  }

  const message = buildOrderMessage({ nombre, apellido, whatsapp, email, items });

  const subject = encodeURIComponent(CONFIG.ORDER_EMAIL_SUBJECT);
  const body = encodeURIComponent(message);
  window.location.href = `mailto:${CONFIG.ORDER_EMAIL}?subject=${subject}&body=${body}`;

  showCartStatus("Se abrió tu cliente de correo con el pedido cargado. Confirmá el envío desde ahí y después podés vaciar el pedido.", "success");
}

function buildOrderMessage({ nombre, apellido, whatsapp, email, items }) {
  const lines = [];
  lines.push(`Pedido - ${CONFIG.LAB_NAME}`);
  lines.push("");
  lines.push(`Cliente: ${nombre} ${apellido}`);
  if (whatsapp) lines.push(`WhatsApp: ${whatsapp}`);
  if (email) lines.push(`Email: ${email}`);
  lines.push("");
  lines.push("Productos:");
  items.forEach(({ product, qty }) => {
    const codePart = product.code ? ` (${product.code})` : "";
    lines.push(`- ${product.name}${codePart} — Cantidad: ${qty}`);
  });
  return lines.join("\n");
}

/* ------------------------------------------------------------------------
   Banner de estado del catálogo
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
   Datos de ejemplo — solo se muestran si no configuraste la planilla o
   falla la lectura.
   ------------------------------------------------------------------------ */
const DEMO_PRODUCTS = [
  { name: "Reactivo Buffer Fosfato PBS 1X", category: "Reactivos", subcategory: "Buffers", price: 8500, currency: "ARS", hasIVA: true, code: "RF-1042", lab: "BioLab SA", description: "Solución tamponadora estéril, pH 7.4, uso general en cultivo celular.", imageUrl: null, availability: "En stock" },
  { name: "Tubos Falcon 15 ml", category: "Descartables", subcategory: "Tubos", price: 3200, currency: "ARS", hasIVA: false, code: "DS-2210", lab: "PlastiCiencia", description: "Tubos cónicos estériles con tapa a rosca, graduados.", imageUrl: null, availability: "En stock" },
  { name: "Kit Extracción de ADN", category: "Kits", subcategory: "Genómica", price: 45200, currency: "USD", hasIVA: true, code: "KT-0091", lab: "GenTech", description: "Kit de columna para extracción de ADN genómico de muestras de tejido.", imageUrl: null, availability: "A pedido" },
  { name: "Guantes de Nitrilo Talle M", category: "Descartables", subcategory: "Protección", price: 6100, currency: "ARS", hasIVA: false, code: "DS-3305", lab: "SafeHand", description: "Guantes sin polvo, resistentes a solventes.", imageUrl: null, availability: "En stock" },
];
