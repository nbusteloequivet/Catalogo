/* =========================================================================
   STATE.JS — Estado compartido en memoria de toda la aplicación.
   Es deliberadamente simple hoy (variables sueltas). El día que la página
   necesite hablar con una base de datos o una API propia, este es el
   archivo que se reemplazaría por un manejo de estado más robusto (o por
   datos que vengan directamente de la respuesta de esa API), sin tener
   que tocar ui.js ni cart.js.
   ========================================================================= */

// Todos los productos ya normalizados, tal como vienen de data.js
let allProducts = [];

// Filtros activos de la grilla
let activeCategory = null;
let activeLab = null;
let activeSubcategory = null;
let searchTerm = "";

// Color asignado a cada categoría (se arma en ui.js, buildCategoryChips)
let categoryColorMap = {};

// El carrito/pedido: { claveDelProducto: { product, qty } }
let cart = {};

// Referencias a los "En tu pedido: N" de cada tarjeta, para actualizarlos
// sin reconstruir toda la grilla cada vez que cambia el carrito.
let cartIndicatorEls = {};

// Cache de elementos del DOM (se completa una sola vez en main.js)
const els = {};

function cacheElements() {
  els.grid = document.getElementById("catalog-grid");
  els.statusBanner = document.getElementById("status-banner");
  els.emptyState = document.getElementById("empty-state");
  els.searchInput = document.getElementById("search-input");
  els.categoryChips = document.getElementById("category-chips");
  els.subcategoryChips = document.getElementById("subcategory-chips");
  els.labChips = document.getElementById("lab-chips");
  els.categoryToggle = document.getElementById("category-toggle");
  els.labToggle = document.getElementById("lab-toggle");
  els.labName = document.getElementById("lab-name");
  els.labSub = document.getElementById("lab-sub");
  els.logoImg = document.getElementById("brand-logo");

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
  els.cartStatus = document.getElementById("cart-status");
  els.clearCartBtn = document.getElementById("clear-cart-btn");

  els.sendGmailBtn = document.getElementById("send-gmail-btn");

  els.contactFab = document.getElementById("contact-fab");
  els.contactSection = document.getElementById("company-contact");

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
