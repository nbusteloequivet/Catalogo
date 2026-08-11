/* =========================================================================
   MAIN.JS — Punto de arranque. Solo orquesta: cachea elementos, conecta
   los eventos definidos en los demás archivos, y dispara la primera carga
   del catálogo. No define lógica propia — si en el futuro hay que sumar
   un paso nuevo al arranque (por ejemplo, chequear si el cliente está
   "logueado" para mostrarle su lista de precios), este es el lugar.
   ========================================================================= */
document.addEventListener("DOMContentLoaded", () => {
  cacheElements();

  // El <h1> ya no se sincroniza con CONFIG.LAB_NAME: se dejó un texto fijo
  // y más descriptivo en index.html a propósito, para SEO (no se ve en
  // pantalla, pero sí lo leen los buscadores). El slogan sí sigue siendo
  // configurable acá porque ese sí se ve.
  els.labSub.textContent = CONFIG.LAB_SUBTITLE;
  els.logoImg.src = CONFIG.LOGO_PATH;
  els.loadingBanner.hidden = !CONFIG.SHOW_LOADING_BANNER;

  setupSearch();
  setupFilterToggles();
  setupModalClosers();
  setupCartModal();
  setupContactFab();
  setupCompanyContact();

  loadCatalog();
  setInterval(loadCatalog, CONFIG.AUTO_REFRESH_MS);
});
