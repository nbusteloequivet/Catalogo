/* =========================================================================
   MAIN.JS — Punto de arranque. Solo orquesta: cachea elementos, conecta
   los eventos definidos en los demás archivos, y dispara la primera carga
   del catálogo. No define lógica propia — si en el futuro hay que sumar
   un paso nuevo al arranque (por ejemplo, chequear si el cliente está
   "logueado" para mostrarle su lista de precios), este es el lugar.
   ========================================================================= */
document.addEventListener("DOMContentLoaded", () => {
  cacheElements();

  els.labName.textContent = CONFIG.LAB_NAME;
  els.labSub.textContent = CONFIG.LAB_SUBTITLE;
  els.logoImg.src = CONFIG.LOGO_PATH;

  setupSearch();
  setupModalClosers();
  setupCartModal();
  setupContactFab();
  setupCompanyContact();

  loadCatalog();
  setInterval(loadCatalog, CONFIG.AUTO_REFRESH_MS);
});
