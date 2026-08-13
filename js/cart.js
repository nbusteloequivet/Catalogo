/* =========================================================================
   CART.JS — Lógica del pedido (el "carrito").

   Al enviar un presupuesto, el pedido se manda directo al Apps Script
   (submitOrderToServer): ese script hace las DOS cosas del lado de
   Google — guarda la fila en la planilla "Pedidos" Y manda el mail de
   notificación (MailApp) — sin que el cliente tenga que abrir ni tocar
   nada más.

   Plan B, solo si esa llamada llega a fallar de verdad (sin internet, el
   Apps Script caído): recién ahí se cae al método de siempre, abrir
   Gmail con todo cargado para que el cliente lo mande él mismo. Por eso
   ese código (openGmailComposeUrl y compañía) sigue estando acá, aunque
   ya no sea el camino principal.
   ========================================================================= */

function safeInt(value) {
  const n = parseInt(value, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

function addToCart(product, key, qty) {
  cart[key] = { product, qty };
  updateCartIndicator(key);
  updateCartFabCount();
}

function removeFromCart(key) {
  delete cart[key];
  updateCartIndicator(key);
  updateCartFabCount();
  resetAddButton(key);
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

function clearCart() {
  cart = {};
  Object.keys(cartIndicatorEls).forEach(updateCartIndicator);
  Object.keys(addButtonEls).forEach(resetAddButton);
  updateCartFabCount();
  renderCartModal();
}

/* ------------------------------------------------------------------------
   Plan B — abrir Gmail con todo cargado, SIN depender de que la
   computadora tenga un programa de mail instalado (mailto: requiere eso,
   y hoy casi nadie lo tiene). Esto ya NO es el camino principal (ver
   sendOrder más abajo): solo se usa si submitOrderToServer llega
   a fallar de verdad.

   El asunto es SIEMPRE el mismo (CONFIG.ORDER_EMAIL_SUBJECT), así en tu
   casilla podés agrupar/filtrar todas las cotizaciones juntas.

   El código de producto (product.code) NO se muestra en ningún lado de la
   página, pero sí viaja en el mail y en el registro de la base de datos —
   es la única vía por la que llega a vos.
   ------------------------------------------------------------------------ */

// Valida el formulario y arma todos los datos del pedido en un solo
// objeto. Si falta algo, muestra el error y devuelve null. Tanto el
// envío del mail como el registro en la base de datos parten de acá, así
// los dos usan siempre exactamente los mismos datos.
// Mismo criterio EXACTO que usa Código.gs para el email (ver
// esEmailValido_ allá) — a propósito la misma regla en los dos lados: si
// algún día se relaja o se ajusta una, hay que ajustar la otra igual,
// para que nunca pase que la página deje mandar algo que el script del
// otro lado va a terminar rechazando en silencio.
function esEmailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// WhatsApp: a propósito NO exigimos un formato estricto (con o sin "+54",
// con o sin espacios/guiones, clientes de otros países) — solo un mínimo
// de dígitos reales, para atajar el caso de alguien tipeando cualquier
// cosa por error, sin arriesgarnos a rechazar un número real por ser
// "raro".
function esWhatsappValido(whatsapp) {
  const digits = whatsapp.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function prepareOrder() {
  hideCartStatus();

  const items = Object.values(cart);
  const nombre = els.cartNombre.value.trim();
  const apellido = els.cartApellido.value.trim();
  const whatsapp = els.cartWhatsapp.value.trim();
  const email = els.cartEmail.value.trim();
  const mensaje = els.cartMensaje.value.trim();

  if (items.length === 0 && !mensaje) {
    // Mientras el catálogo todavía no tiene cargados todos los productos
    // (cartel rojo en el header), el cliente puede no encontrar nada para
    // agregar — en ese caso el pedido igual es válido SI describió lo que
    // necesita en "Mensaje adicional". Lo único que de verdad bloquea el
    // envío es no tener ni productos agregados ni ese mensaje: ahí no
    // sabríamos qué está pidiendo.
    showCartStatus("Agregá productos al pedido o contanos en \"Mensaje adicional\" qué necesitás.", "error");
    return null;
  }
  if (!nombre || !whatsapp || !email) {
    showCartStatus("Completá tus datos antes de enviar.", "error");
    return null;
  }
  // Formato de email: se valida ACÁ, antes de intentar mandar nada.
  // Código.gs también lo valida del otro lado, pero como el envío usa
  // "no-cors" no hay forma de leer si lo rechazó — si dejáramos pasar un
  // email con mala forma, el pedido se perdería en silencio y la página
  // igual le mostraría "enviado" al cliente. Cortarlo acá evita eso.
  if (!esEmailValido(email)) {
    showCartStatus("El email no parece válido — revisalo antes de enviar.", "error");
    return null;
  }
  if (!esWhatsappValido(whatsapp)) {
    showCartStatus("El WhatsApp no parece válido — revisalo antes de enviar.", "error");
    return null;
  }
  // Entidad es opcional — no bloquea el envío.

  // ID simple para poder agrupar en la planilla todas las filas que
  // pertenecen a este mismo pedido (un timestamp alcanza: es único y
  // además queda ordenable cronológicamente sin ningún esfuerzo extra).
  const orderId = String(Date.now());

  const message = buildOrderMessage({ nombre, apellido, whatsapp, email, mensaje, items });

  return { orderId, nombre, apellido, whatsapp, email, mensaje, items, message };
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

// Cuánto esperamos, en iPhone, a ver si la app de Gmail tomó el control
// de la pantalla antes de asumir que no está instalada y caer a la web.
const IOS_APP_OPEN_TIMEOUT_MS = 900;

// En iPhone/iPad no alcanza con navegar a la versión web de Gmail (eso
// es justamente lo que abría "Gmail en el buscador" en vez de la app).
// "googlegmail:///co?..." es el esquema propio que usa la app de Gmail
// para abrir directo una pantalla de redacción ya completa. Si la app no
// está instalada, este link no hace nada (no tira error, simplemente no
// pasa nada) — por eso programamos una caída a la versión web recién
// después de esperar un instante y confirmar que seguimos en la página.
function openGmailIOS(to, subject, body) {
  const toParam = encodeURIComponent(to);
  const subjectParam = encodeURIComponent(subject || "");
  const bodyParam = encodeURIComponent(body || "");
  const webUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${toParam}&su=${subjectParam}&body=${bodyParam}`;
  const appUrl = `googlegmail:///co?to=${toParam}&subject=${subjectParam}&body=${bodyParam}`;

  let appTookOver = false;

  // Si la app SÍ abrió, Safari pasa a segundo plano y esto se dispara —
  // ahí cancelamos la caída a la web para no mandar también ahí cuando
  // el cliente vuelva a Safari después de mandar el mail desde la app.
  function onVisibilityChange() {
    if (document.hidden) appTookOver = true;
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.location.href = appUrl;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!appTookOver) {
      // Pasado el tiempo de espera seguimos en la página: la app de
      // Gmail no está instalada. Recién acá caemos a la versión web.
      window.location.href = webUrl;
    }
  }, IOS_APP_OPEN_TIMEOUT_MS);
}

// Abre la redacción de Gmail con destinatario/asunto/cuerpo ya cargados,
// SIEMPRE en Gmail específicamente (app en el celular, Gmail web en la
// compu). La usa el botón "Enviar pedido" del presupuesto, y también
// el botón de Contacto en el celular (ver openEmailContact más abajo).
function openGmailComposeUrl(to, subject, body) {
  const toParam = encodeURIComponent(to);
  const subjectParam = encodeURIComponent(subject || "");
  const bodyParam = encodeURIComponent(body || "");
  const webUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${toParam}&su=${subjectParam}&body=${bodyParam}`;

  if (isAndroidDevice()) {
    // En Android, un link común a mail.google.com muchas veces abre la
    // app de Gmail pero en la bandeja de entrada, sin el mail redactado.
    // Este "intent" le pide explícitamente a Android que use la app de
    // Gmail (package com.google.android.gm) para componer el mail, y si
    // no la tiene instalada, S.browser_fallback_url hace que caiga sola
    // al link de arriba en el navegador.
    const intentUrl =
      `intent://send?to=${toParam}&subject=${subjectParam}&body=${bodyParam}` +
      `#Intent;scheme=mailto;package=com.google.android.gm;` +
      `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    window.location.href = intentUrl;
  } else if (isIOSDevice()) {
    openGmailIOS(to, subject, body);
  } else {
    // PC: pestaña nueva, así no se pierde el catálogo/la página de fondo.
    window.open(webUrl, "_blank", "noopener,noreferrer");
  }
}

// Botón "Email" de la sección Contacto (index.html lo muestra como
// "Email", no como "Gmail" — a propósito no fuerza Gmail en la compu).
// En el celular sí abre puntualmente la app de Gmail (mismo mecanismo de
// arriba). En la computadora usa un "mailto:" común: el sistema operativo
// decide qué programa de mail abrir (Gmail si está asociado, Outlook,
// Mail de Windows/Mac, lo que el cliente tenga configurado).
function openEmailContact(to, subject, body) {
  if (isMobileDevice()) {
    openGmailComposeUrl(to, subject, body);
  } else {
    const subjectParam = encodeURIComponent(subject || "");
    const bodyParam = encodeURIComponent(body || "");
    window.location.href = `mailto:${to}?subject=${subjectParam}&body=${bodyParam}`;
  }
}

// Manejador del botón "Enviar pedido". Se llama "sendOrder" a propósito,
// no "openGmailCompose": el envío directo (submitOrderToServer) es el
// camino principal ahora, abrir Gmail quedó como plan B — ver el bloque
// de arriba.
async function sendOrder() {
  const order = prepareOrder();
  if (order === null) return;

  els.sendOrderBtn.disabled = true;
  showCartStatus("Enviando tu pedido…", "success");

  const enviado = await submitOrderToServer(order);

  els.sendOrderBtn.disabled = false;

  if (enviado) {
    showCartStatus("¡Listo! Tu pedido fue enviado.", "success");
    return;
  }

  // Plan B: solo llegamos acá si el envío directo falló de verdad (sin
  // internet, el Apps Script caído). Ahí sí, como respaldo, abrimos
  // Gmail con todo cargado para que el cliente lo mande él mismo.
  openGmailComposeUrl(CONFIG.ORDER_EMAIL, CONFIG.ORDER_EMAIL_SUBJECT, order.message);
  showCartStatus("No pudimos enviarlo automáticamente — se abrió Gmail con tu pedido cargado. Revisalo y tocá enviar desde ahí.", "error");
}

function buildOrderMessage({ nombre, apellido, whatsapp, email, mensaje, items }) {
  const lines = [];
  lines.push(`Pedido - ${CONFIG.LAB_NAME}`);
  lines.push("");
  lines.push(`Cliente: ${nombre}`);
  if (apellido) lines.push(`Entidad: ${apellido}`);
  lines.push(`WhatsApp: ${whatsapp}`);
  lines.push(`Email: ${email}`);
  lines.push("");
  if (items.length > 0) {
    lines.push("Productos:");
    items.forEach(({ product, qty }) => {
      // El código sí va en el mail, aunque nunca se muestre en pantalla.
      const codePart = product.code ? ` (${product.code})` : "";
      lines.push(`- ${product.name}${codePart} — Cantidad: ${qty}`);
    });
  } else {
    // No agregó nada del catálogo (probablemente no encontró lo que
    // buscaba, mientras todavía se está cargando) — todo lo que pidió
    // está en el mensaje adicional, que abajo se imprime siempre.
    lines.push("Productos: no encontró lo que buscaba en el catálogo — ver \"Mensaje adicional\".");
  }
  if (mensaje) {
    lines.push("");
    lines.push("Mensaje adicional:");
    lines.push(mensaje);
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------------
   Envío directo al Apps Script — guarda el pedido en la planilla
   "Pedidos" Y manda el mail de notificación, las dos cosas del lado de
   Google (ver Código.gs). Acá solo armamos el payload y lo mandamos.

   Detalles técnicos, por si hay que tocar esto en el futuro:
   - fetch con mode:"no-cors": Apps Script no siempre devuelve los
     encabezados que un navegador necesita para "leer" la respuesta desde
     JavaScript. Como consecuencia, NO podemos leer desde acá si el mail
     se mandó o si se guardó bien la fila — solo sabemos si la llamada en
     sí se pudo hacer (hubo internet, el Apps Script respondió algo). Por
     eso el Apps Script valida y sanea todo del otro lado: no podemos
     confiar en lo que ve el cliente para decidir qué es seguro guardar.
   - Content-Type: text/plain (en vez de application/json): Apps Script no
     responde bien a la petición de verificación previa ("preflight") que
     hacen los navegadores antes de mandar JSON real entre dominios
     distintos. Mandándolo como texto plano se evita ese problema, y del
     otro lado (en el Apps Script) igual se interpreta como JSON.
   - siteToken / honeypot: dos capas de protección contra abuso — ver el
     comentario al principio de Código.gs para el detalle de cada una.

   Devuelve true si la llamada se pudo hacer (asumimos que el pedido
   llegó bien), o false si el fetch en sí falló (sin internet, el
   Apps Script inaccesible) — solo en ese caso sendOrder() cae al
   plan B de abrir Gmail.
   ------------------------------------------------------------------------ */
async function submitOrderToServer(order) {
  if (!CONFIG.ORDERS_SHEET_WEBAPP_URL || CONFIG.ORDERS_SHEET_WEBAPP_URL.includes("PEGAR_AQUI")) {
    console.warn("CONFIG.ORDERS_SHEET_WEBAPP_URL no está configurada: no se pudo enviar el pedido.");
    return false;
  }

  const payload = {
    siteToken: CONFIG.SITE_TOKEN,
    // Campo trampa: en un cliente real esto SIEMPRE llega vacío (el
    // input está oculto de la vista). Si un bot lo completó, viaja con
    // contenido y el Apps Script descarta el pedido sin procesarlo.
    honeypot: els.cartHoneypot ? els.cartHoneypot.value.trim() : "",
    orderId: order.orderId,
    nombre: order.nombre,
    entidad: order.apellido, // "apellido" es en realidad el campo Entidad del formulario
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
