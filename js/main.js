document.addEventListener("DOMContentLoaded", () => {
  cacheElements();

  els.labSub.textContent = CONFIG.LAB_SUBTITLE;
  els.logoImg.src = CONFIG.LOGO_PATH;
  els.loadingBanner.hidden = !CONFIG.SHOW_LOADING_BANNER;

  setupSearch();
  setupFilterToggles();
  setupHowToUseAnimation();
  setupModalClosers();
  setupCartModal();
  setupAutoGrowTextarea(els.cartMensaje);
  setupContactFab();
  setupCompanyContact();
  setupFacturaToggle();
  setupWhatsappFormatter(els.cartWhatsapp);

  session = loadSessionFromStorage();
  updateAccountButton();
  if (session) {
    autocompletarDatosCliente();
    prefetchHistorial();
  }
  setupAccountModal();
  setupHistorialModal();

  // Si llegó desde el link del mail de "contraseña olvidada"
  // (?resetToken=...), abre directo el modal de cuenta en la vista de
  // "elegir nueva contraseña" — ver detectarResetTokenEnURL en account.js.
  if (detectarResetTokenEnURL()) {
    showAccountView("reset");
    openModalEl(els.accountModal);
  }

  // Si llegó desde el link del mail de verificación de cuenta
  // (?verifyToken=...), verifica Y loguea de una — ver
  // verificarCuentaYLoguear en account.js.
  const verifyToken = detectarVerifyTokenEnURL();
  if (verifyToken) {
    verificarCuentaYLoguear(verifyToken);
  }

  loadCatalog();
  setInterval(loadCatalog, CONFIG.AUTO_REFRESH_MS);
});
