function safeInt(value) {
  const n = parseInt(value, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

function addToCart(product, key, qty) {
  cart[key] = { product, qty };
  updateCartIndicator(key);
}

function removeFromCart(key) {
  delete cart[key];
  updateCartIndicator(key);
  renderCartModal();
}

function updateCartIndicator(key) {
  const el = cartIndicatorEls[key];
  if (!el) return;
  const entry = cart[key];
  if (entry && entry.qty > 0) {
    el.hidden = false;
    el.textContent = `En tu presupuesto: ${entry.qty}`;
  } else {
    el.hidden = true;
    el.textContent = "";
  }
}

function clearCart() {
  cart = {};
  editingOrderId = null;
  els.cartTitle.textContent = "Mi presupuesto";
  els.sendOrderBtn.textContent = "Solicitar presupuesto";
  els.cartFab.textContent = "Nuevo presupuesto";
  els.cancelEditBtn.hidden = true;
  els.clearCartBtn.hidden = false;
  els.cartFactura.value = "";
  marcarFacturaConError(false);
  syncFacturaButtons();
  [els.cartNombre, els.cartApellido, els.cartWhatsapp, els.cartEmail].forEach((input) => input.classList.remove("field-error"));
  Object.keys(cartIndicatorEls).forEach(updateCartIndicator);
  renderCartModal();
}

function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function esWhatsappValido(whatsapp) {
  const digits = whatsapp.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function marcarCamposConError(camposConError) {
  [els.cartNombre, els.cartApellido, els.cartWhatsapp, els.cartEmail].forEach((input) => {
    input.classList.toggle("field-error", camposConError.includes(input));
  });
}

function prepareOrder() {
  hideCartStatus();

  const items = Object.values(cart);
  const nombre = els.cartNombre.value.trim();
  const apellido = els.cartApellido.value.trim();
  const entidad = els.cartEntidad.value.trim();
  const facturaValue = els.cartFactura.value; // "" (sin elegir todavía), "si" o "no"
  // Lo que se ve en el campo es el número con espacios (ver
  // setupWhatsappFormatter en ui.js) — lo que se guarda y se manda es
  // siempre el número de una sola pieza, sin espacios ni guiones.
  const whatsapp = els.cartWhatsapp.value.trim().replace(/[^\d+]/g, "");
  const email = els.cartEmail.value.trim();
  const mensaje = els.cartMensaje.value.trim();

  if (items.length === 0 && !mensaje) {
    showCartStatus("Agregá productos a tu presupuesto o contanos en \"Mensaje adicional\" qué necesitás.", "error");
    return null;
  }

  const camposFaltantes = [];
  if (!nombre) camposFaltantes.push(els.cartNombre);
  if (!apellido) camposFaltantes.push(els.cartApellido);
  if (!whatsapp) camposFaltantes.push(els.cartWhatsapp);
  if (!email) camposFaltantes.push(els.cartEmail);
  marcarCamposConError(camposFaltantes);

  const faltaFactura = facturaValue !== "si" && facturaValue !== "no";
  marcarFacturaConError(faltaFactura);

  if (camposFaltantes.length > 0 || faltaFactura) {
    showCartStatus("Completá tus datos antes de enviar.", "error");
    return null;
  }
  if (!esEmailValido(email)) {
    showCartStatus("El email no parece válido — revisalo antes de enviar.", "error");
    return null;
  }
  if (!esWhatsappValido(whatsapp)) {
    showCartStatus("El WhatsApp no parece válido — revisalo antes de enviar.", "error");
    return null;
  }

  const necesitaFactura = facturaValue === "si";
  const orderId = String(Date.now());

  const message = buildOrderMessage({ nombre, apellido, entidad, necesitaFactura, whatsapp, email, mensaje, items });

  return { orderId, nombre, apellido, entidad, necesitaFactura, whatsapp, email, mensaje, items, message };
}

function isAndroidDevice() {
  return /android/i.test(navigator.userAgent);
}
function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isMobileDevice() {
  return isAndroidDevice() || isIOSDevice();
}

const IOS_APP_OPEN_TIMEOUT_MS = 900;

function openGmailIOS(to, subject, body) {
  const toParam = encodeURIComponent(to);
  const subjectParam = encodeURIComponent(subject || "");
  const bodyParam = encodeURIComponent(body || "");
  const webUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${toParam}&su=${subjectParam}&body=${bodyParam}`;
  const appUrl = `googlegmail:///co?to=${toParam}&subject=${subjectParam}&body=${bodyParam}`;

  let appTookOver = false;

  function onVisibilityChange() {
    if (document.hidden) appTookOver = true;
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.location.href = appUrl;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!appTookOver) {
      window.location.href = webUrl;
    }
  }, IOS_APP_OPEN_TIMEOUT_MS);
}

function openGmailComposeUrl(to, subject, body) {
  const toParam = encodeURIComponent(to);
  const subjectParam = encodeURIComponent(subject || "");
  const bodyParam = encodeURIComponent(body || "");
  const webUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${toParam}&su=${subjectParam}&body=${bodyParam}`;

  if (isAndroidDevice()) {
    const intentUrl =
      `intent://send?to=${toParam}&subject=${subjectParam}&body=${bodyParam}` +
      `#Intent;scheme=mailto;package=com.google.android.gm;` +
      `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    window.location.href = intentUrl;
  } else if (isIOSDevice()) {
    openGmailIOS(to, subject, body);
  } else {
    window.open(webUrl, "_blank", "noopener,noreferrer");
  }
}

function openEmailContact(to, subject, body) {
  if (isMobileDevice()) {
    openGmailComposeUrl(to, subject, body);
  } else {
    const subjectParam = encodeURIComponent(subject || "");
    const bodyParam = encodeURIComponent(body || "");
    window.location.href = `mailto:${to}?subject=${subjectParam}&body=${bodyParam}`;
  }
}

function sendOrder() {
  const order = prepareOrder();
  if (order === null) return;

  const wasEditing = Boolean(editingOrderId);

  // Optimista: se muestra el resultado de éxito y se vacía el carrito DE
  // UNA, sin esperar la respuesta del servidor — es justamente lo que
  // pedía el cliente (que el cartel cambie al instante y la demora de
  // Apps Script no se note). Es seguro hacerlo así porque el envío usa
  // mode:"no-cors" (ver submitOrderToServer): el navegador YA no podía
  // leer si Apps Script lo guardó bien o no, así que esperar antes no
  // daba más garantía real — solo agregaba demora visible sin agregar
  // certeza. El envío de verdad sigue en curso por detrás; si llega a
  // fallar la conexión (el único caso que no-cors sí puede detectar:
  // estar sin internet en ese momento), recién ahí se avisa.
  showCartStatus(
    wasEditing
      ? "Solicitud editada y enviada — todavía sin compra confirmada."
      : "¡Listo! Enviamos tu solicitud de presupuesto — todavía sin compra confirmada. Te contactamos a la brevedad.",
    "success"
  );
  clearCart();

  submitOrderToServer(order).then((enviado) => {
    if (enviado) {
      // El historial del cliente ya cambió — se refresca la caché local
      // en segundo plano para que "Mi historial" ya esté al día la
      // próxima vez que lo abra.
      prefetchHistorial();
      return;
    }

    // Solo se llega hasta acá si de verdad no hubo conexión con el
    // servidor en ese momento — el caso normal, con mucha diferencia, es
    // que esto ni se note.
    if (wasEditing) {
      showCartStatus("No pudimos guardar la actualización — probá de nuevo en un momento.", "error");
      return;
    }
    openGmailComposeUrl(CONFIG.ORDER_EMAIL, CONFIG.ORDER_EMAIL_SUBJECT, order.message);
    showCartStatus("No pudimos enviarlo automáticamente — se abrió Gmail con tu solicitud cargada. Revisalo y tocá enviar desde ahí.", "error");
  });
}

function buildOrderMessage({ nombre, apellido, entidad, necesitaFactura, whatsapp, email, mensaje, items }) {
  const lines = [];
  lines.push(`Solicitud de presupuesto - ${CONFIG.LAB_NAME}`);
  lines.push("");
  lines.push(`Cliente: ${nombre}${apellido ? " " + apellido : ""}`);
  if (entidad) lines.push(`Entidad: ${entidad}`);
  lines.push(`WhatsApp: ${whatsapp}`);
  lines.push(`Email: ${email}`);
  lines.push(`Necesita factura A: ${necesitaFactura ? "Sí" : "No"}`);
  lines.push("");
  if (items.length > 0) {
    lines.push("Productos:");
    items.forEach(({ product, qty }) => {
      const codePrefix = product.code ? `${product.code} - ` : "";
      lines.push(`- ${codePrefix}${product.name} - Cantidad: ${qty}`);
    });
  } else {
    lines.push("Productos: no encontró lo que buscaba en el catálogo — ver \"Mensaje adicional\".");
  }
  if (mensaje) {
    lines.push("");
    lines.push("Mensaje adicional:");
    lines.push(mensaje);
  }
  return lines.join("\n");
}

async function submitOrderToServer(order) {
  if (!CONFIG.ORDERS_SHEET_WEBAPP_URL || CONFIG.ORDERS_SHEET_WEBAPP_URL.includes("PEGAR_AQUI")) {
    console.warn("CONFIG.ORDERS_SHEET_WEBAPP_URL no está configurada: no se pudo enviar el pedido.");
    return false;
  }

  const payload = {
    siteToken: CONFIG.SITE_TOKEN,
    honeypot: els.cartHoneypot ? els.cartHoneypot.value.trim() : "",
    orderId: order.orderId,
    nombre: order.nombre,
    apellido: order.apellido,
    entidad: order.entidad,
    necesitaFactura: order.necesitaFactura,
    whatsapp: order.whatsapp,
    email: order.email,
    mensaje: order.mensaje,
    items: order.items.map(({ product, qty }) => ({
      name: product.name,
      code: product.code,
      category: product.categories.join(", "),
      subcategory: product.subcategories.join(", "),
      lab: product.lab,
      qty,
    })),
  };

  if (editingOrderId && session) {
    payload.editOrderId = editingOrderId;
    payload.sessionToken = session.token;
  }

  try {
    await fetch(CONFIG.ORDERS_SHEET_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (err) {
    console.warn("No se pudo enviar el pedido (sin conexión o el Apps Script no respondió):", err);
    return false;
  }
}
