/* =========================================================================
   STATE.JS — Estado compartido en memoria de toda la aplicación.
   ========================================================================= */

let allProducts = [];

let activeCategories = new Set();
let activeLabs = new Set();
let activeSubcategory = null;
let searchTerm = "";

let categoryColorMap = {};

let duplicateProductNames = new Set();

let cart = {};

let cartIndicatorEls = {};

let session = null;

let editingOrderId = null;

const els = {};

function cacheElements() {
  els.grid = document.getElementById("catalog-grid");
  els.statusBanner = document.getElementById("status-banner");
  els.emptyState = document.getElementById("empty-state");
  els.searchInput = document.getElementById("search-input");

  els.categoryChipsWrap = document.getElementById("category-chips-wrap");
  els.categoryChips = document.getElementById("category-chips");
  els.subcategoryChipsWrap = document.getElementById("subcategory-chips-wrap");
  els.subcategoryChips = document.getElementById("subcategory-chips");
  els.labChipsWrap = document.getElementById("lab-chips-wrap");
  els.labChips = document.getElementById("lab-chips");

  els.categoryToggle = document.getElementById("category-toggle");
  els.labToggle = document.getElementById("lab-toggle");
  els.labName = document.getElementById("lab-name");
  els.labSub = document.getElementById("lab-sub");
  els.logoImg = document.getElementById("brand-logo");
  els.loadingBanner = document.getElementById("loading-products-banner");

  els.howToUseToggle = document.getElementById("how-to-use-toggle");
  els.howToUsePanelWrap = document.getElementById("how-to-use-panel-wrap");
  els.notice24hWhatsapp = document.getElementById("notice-24h-whatsapp");

  els.productModal = document.getElementById("product-modal");
  els.modalBody = document.getElementById("modal-body");

  els.cartFab = document.getElementById("cart-fab");
  els.cartModal = document.getElementById("cart-modal");
  els.cartTitle = document.getElementById("cart-title");
  els.cartItemsEl = document.getElementById("cart-items");
  els.cartEmptyEl = document.getElementById("cart-empty");
  els.addProductBtn = document.getElementById("add-product-btn");
  els.cartNombre = document.getElementById("cart-nombre");
  els.cartApellido = document.getElementById("cart-apellido");
  els.cartEntidad = document.getElementById("cart-entidad");
  els.cartFactura = document.getElementById("cart-factura");
  els.facturaSiBtn = document.getElementById("factura-si-btn");
  els.facturaNoBtn = document.getElementById("factura-no-btn");
  els.facturaToggle = document.querySelector(".factura-toggle");
  els.cartWhatsapp = document.getElementById("cart-whatsapp");
  els.cartEmail = document.getElementById("cart-email");
  els.cartMensaje = document.getElementById("cart-mensaje");
  els.cartHoneypot = document.getElementById("cart-honeypot");
  els.cartStatus = document.getElementById("cart-status");
  els.clearCartBtn = document.getElementById("clear-cart-btn");

  els.sendOrderBtn = document.getElementById("send-order-btn");
  els.cancelEditBtn = document.getElementById("cancel-edit-btn");

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

  els.accountFab = document.getElementById("account-fab");
  els.accountModal = document.getElementById("account-modal");
  els.accountTitle = document.getElementById("account-title");

  els.accountViewLogin = document.getElementById("account-view-login");
  els.accountViewRegistro = document.getElementById("account-view-registro");
  els.accountViewForgot = document.getElementById("account-view-forgot");
  els.accountViewReset = document.getElementById("account-view-reset");
  els.accountViewVerificar = document.getElementById("account-view-verificar");
  els.accountViewLogged = document.getElementById("account-view-logged");

  els.loginEmail = document.getElementById("login-email");
  els.loginPassword = document.getElementById("login-password");
  els.loginStatus = document.getElementById("login-status");
  els.loginSubmitBtn = document.getElementById("login-submit-btn");
  els.showRegistroBtn = document.getElementById("show-registro-btn");
  els.showForgotBtn = document.getElementById("show-forgot-btn");

  els.registroNombre = document.getElementById("registro-nombre");
  els.registroApellido = document.getElementById("registro-apellido");
  els.registroEmail = document.getElementById("registro-email");
  els.registroPassword = document.getElementById("registro-password");
  els.registroStatus = document.getElementById("registro-status");
  els.registroSubmitBtn = document.getElementById("registro-submit-btn");
  els.showLoginBtn = document.getElementById("show-login-btn");

  els.forgotEmail = document.getElementById("forgot-email");
  els.forgotStatus = document.getElementById("forgot-status");
  els.forgotSubmitBtn = document.getElementById("forgot-submit-btn");
  els.showLoginFromForgotBtn = document.getElementById("show-login-from-forgot-btn");

  els.resetPassword = document.getElementById("reset-password");
  els.resetStatus = document.getElementById("reset-status");
  els.resetSubmitBtn = document.getElementById("reset-submit-btn");

  els.accountGreetingName = document.getElementById("account-greeting-name");
  els.accountLogoutBtn = document.getElementById("account-logout-btn");

  els.historialFab = document.getElementById("historial-fab");
  els.historialModal = document.getElementById("historial-modal");
  els.historialList = document.getElementById("historial-list");
  els.historialEmpty = document.getElementById("historial-empty");
  els.historialViewList = document.getElementById("historial-view-list");
  els.historialViewDetail = document.getElementById("historial-view-detail");
  els.historialViewGuest = document.getElementById("historial-view-guest");
  els.historialGuestLoginBtn = document.getElementById("historial-guest-login-btn");
  els.historialBackBtn = document.getElementById("historial-back-btn");
  els.historialDetailBody = document.getElementById("historial-detail-body");
  els.historialEditBtn = document.getElementById("historial-edit-btn");
  els.historialEditStatus = document.getElementById("historial-edit-status");
}
