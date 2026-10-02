const SESSION_STORAGE_KEY = "equivetSession";

function loadSessionFromStorage() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("No se pudo leer la sesión guardada:", err);
    return null;
  }
}

function saveSessionToStorage(sessionData) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
  } catch (err) {
    console.warn("No se pudo guardar la sesión:", err);
  }
}

function clearSessionFromStorage() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn("No se pudo borrar la sesión:", err);
  }
}

async function accountApiCall(params) {
  const url = new URL(CONFIG.ORDERS_SHEET_WEBAPP_URL);
  url.searchParams.set("siteToken", CONFIG.SITE_TOKEN);
  Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));

  const response = await fetch(url.toString());
  return response.json();
}

function autocompletarDatosCliente() {
  if (!session) return;
  els.cartNombre.value = session.nombre || "";
  els.cartApellido.value = session.apellido || "";
  els.cartEmail.value = session.email || "";
}

async function submitLogin() {
  hideAccountStatus(els.loginStatus);

  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;

  if (!email || !password) {
    showAccountStatus(els.loginStatus, "Completá email y contraseña.", "error");
    return;
  }

  // Aviso inmediato de que ya está trabajando — Apps Script tarda un
  // par de segundos en responder (es normal de la plataforma, no algo
  // que se pueda acelerar desde acá), así que sin este cartel la espera
  // se siente como si el botón no hubiera hecho nada.
  els.loginSubmitBtn.disabled = true;
  const textoOriginalLogin = els.loginSubmitBtn.textContent;
  els.loginSubmitBtn.textContent = "Verificando…";
  try {
    const data = await accountApiCall({ action: "login", email, password });

    if (!data.ok) {
      showAccountStatus(els.loginStatus, mensajeErrorCuenta(data.error), "error");
      return;
    }

    session = { token: data.token, nombre: data.nombre, apellido: data.apellido, email: data.email };
    saveSessionToStorage(session);
    autocompletarDatosCliente();
    prefetchHistorial();
    els.loginEmail.value = "";
    els.loginPassword.value = "";
    updateAccountButton();
    closeModalEl(els.accountModal);
    scrollToTop();
  } catch (err) {
    console.error("Error al iniciar sesión:", err);
    showAccountStatus(els.loginStatus, "No pudimos conectar — probá de nuevo en un momento.", "error");
  } finally {
    els.loginSubmitBtn.disabled = false;
    els.loginSubmitBtn.textContent = textoOriginalLogin;
  }
}

async function submitRegistro() {
  hideAccountStatus(els.registroStatus);

  const nombre = els.registroNombre.value.trim();
  const apellido = els.registroApellido.value.trim();
  const email = els.registroEmail.value.trim();
  const password = els.registroPassword.value;

  if (!nombre || !apellido || !email || !password) {
    showAccountStatus(els.registroStatus, "Completá nombre, apellido, email y contraseña.", "error");
    return;
  }
  if (password.length < 8) {
    showAccountStatus(els.registroStatus, "La contraseña tiene que tener al menos 8 caracteres.", "error");
    return;
  }

  els.registroSubmitBtn.disabled = true;
  try {
    const data = await accountApiCall({ action: "registrar", nombre, apellido, email, password });

    if (!data.ok) {
      showAccountStatus(els.registroStatus, mensajeErrorCuenta(data.error), "error");
      return;
    }

    els.registroNombre.value = "";
    els.registroApellido.value = "";
    els.registroEmail.value = "";
    els.registroPassword.value = "";
    showAccountView("verificar");
  } catch (err) {
    console.error("Error al registrarse:", err);
    showAccountStatus(els.registroStatus, "No pudimos conectar — probá de nuevo en un momento.", "error");
  } finally {
    els.registroSubmitBtn.disabled = false;
  }
}

function logout() {
  session = null;
  clearSessionFromStorage();
  borrarHistorialCache();
  showAccountView("login");
  updateAccountButton();
}

/* ------------------------------------------------------------------------
   Contraseña olvidada
   ------------------------------------------------------------------------ */

// Token capturado desde la URL (?resetToken=...) cuando el cliente entra
// al sitio desde el link que le llegó por mail. Se guarda en memoria
// (no en localStorage) — solo hace falta para el envío del formulario de
// "nueva contraseña" de esta misma visita.
let resetToken = null;

function detectarResetTokenEnURL() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("resetToken");
  if (token) {
    resetToken = token;
    // Se limpia la URL después de leerla — así el token no queda dando
    // vueltas a la vista ni se reintenta solo si recargan la página.
    history.replaceState(null, "", window.location.pathname);
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------------
   Verificación de cuenta — el link del mail ahora apunta al sitio
   (?verifyToken=...) en vez de a la URL del Apps Script. Al detectarlo,
   se llama al servidor, que verifica Y de una devuelve un token de
   sesión (misma forma que el login) — así el cliente entra directo
   logueado, sin tener que loguearse a mano después de verificar.
   ------------------------------------------------------------------------ */
function detectarVerifyTokenEnURL() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("verifyToken");
  if (token) {
    history.replaceState(null, "", window.location.pathname);
    return token;
  }
  return null;
}

async function verificarCuentaYLoguear(token) {
  try {
    const data = await accountApiCall({ action: "verificarCuenta", token });
    if (!data.ok) {
      showAccountView("login");
      openModalEl(els.accountModal);
      showAccountStatus(els.loginStatus, "No pudimos verificar tu cuenta — el enlace puede haber vencido o ya haberse usado.", "error");
      return;
    }
    session = { token: data.token, nombre: data.nombre, apellido: data.apellido, email: data.email };
    saveSessionToStorage(session);
    autocompletarDatosCliente();
    prefetchHistorial();
    updateAccountButton();
    scrollToTop();
  } catch (err) {
    console.error("Error al verificar la cuenta:", err);
  }
}

async function submitForgotPassword() {
  hideAccountStatus(els.forgotStatus);

  const email = els.forgotEmail.value.trim();
  if (!email) {
    showAccountStatus(els.forgotStatus, "Completá tu email.", "error");
    return;
  }

  els.forgotSubmitBtn.disabled = true;
  try {
    await accountApiCall({ action: "solicitarRecuperacion", email });
    els.forgotEmail.value = "";
    showAccountStatus(els.forgotStatus, "Si ese email está registrado, te llegó un enlace para restablecer tu contraseña.", "success");
  } catch (err) {
    console.error("Error al pedir recuperación de contraseña:", err);
    showAccountStatus(els.forgotStatus, "No pudimos conectar — probá de nuevo en un momento.", "error");
  } finally {
    els.forgotSubmitBtn.disabled = false;
  }
}

async function submitResetPassword() {
  hideAccountStatus(els.resetStatus);

  const newPassword = els.resetPassword.value;
  if (newPassword.length < 8) {
    showAccountStatus(els.resetStatus, "La contraseña tiene que tener al menos 8 caracteres.", "error");
    return;
  }
  if (!resetToken) {
    showAccountStatus(els.resetStatus, "El enlace no es válido — pedí uno nuevo desde \"¿Olvidaste tu contraseña?\".", "error");
    return;
  }

  // Mismo aviso inmediato que en el login (ver submitLogin) — acá
  // además hay que escribir en la planilla (cambiar la contraseña) antes
  // de poder loguear, así que la espera es un poco más larga todavía;
  // sin este cartel el botón se siente trabado.
  els.resetSubmitBtn.disabled = true;
  const textoOriginalReset = els.resetSubmitBtn.textContent;
  els.resetSubmitBtn.textContent = "Guardando…";
  try {
    const data = await accountApiCall({ action: "restablecerPassword", resetToken, newPassword });

    if (!data.ok) {
      const mensaje = data.error === "token_vencido"
        ? "El enlace venció — pedí uno nuevo desde \"¿Olvidaste tu contraseña?\"."
        : "El enlace no es válido — pedí uno nuevo desde \"¿Olvidaste tu contraseña?\".";
      showAccountStatus(els.resetStatus, mensaje, "error");
      return;
    }

    // El servidor ya creó la sesión junto con el cambio de contraseña
    // (mismo mecanismo que verificarCuentaYLoguear) — se entra logueado
    // de una, sin pedirle al cliente que vuelva a escribir la contraseña
    // que recién acaba de elegir.
    resetToken = null;
    els.resetPassword.value = "";
    session = { token: data.token, nombre: data.nombre, apellido: data.apellido, email: data.email };
    saveSessionToStorage(session);
    autocompletarDatosCliente();
    prefetchHistorial();
    updateAccountButton();
    closeModalEl(els.accountModal);
    scrollToTop();
  } catch (err) {
    console.error("Error al restablecer la contraseña:", err);
    showAccountStatus(els.resetStatus, "No pudimos conectar — probá de nuevo en un momento.", "error");
  } finally {
    els.resetSubmitBtn.disabled = false;
    els.resetSubmitBtn.textContent = textoOriginalReset;
  }
}

function mensajeErrorCuenta(codigo) {
  const mensajes = {
    email_invalido: "El email no parece válido.",
    password_muy_corta: "La contraseña tiene que tener al menos 8 caracteres.",
    email_ya_registrado: "Ya existe una cuenta verificada con ese email.",
    credenciales_invalidas: "Email o contraseña incorrectos.",
    cuenta_no_verificada: "Todavía no verificaste tu cuenta — revisá tu mail.",
  };
  return mensajes[codigo] || "Ocurrió un error — probá de nuevo.";
}
