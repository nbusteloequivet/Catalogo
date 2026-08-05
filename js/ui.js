/* =========================================================================
   CART.JS — Lógica del pedido (el "carrito").

   Este archivo hace DOS cosas cuando el cliente envía un presupuesto:
   1) Arma un mail y abre Gmail con todo cargado (como hasta ahora).
   2) Manda una copia estructurada de esos mismos datos a una planilla de
      Google ("Pedidos"), para ir armando de a poco una base de datos que
      después sirva para ver qué se vende más, controlar stock, etc.

   La parte 2 es siempre "best effort": si por lo que sea falla (Google
   caído, sin internet un instante, lo que sea), el mail se manda igual —
   nunca deben depender una de la otra. El registro en la base es un
   extra silencioso, no un requisito para que el pedido llegue.
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
  updateCartFabCount();
  renderCartModal();
}

/* ------------------------------------------------------------------------
   Envío de la cotización — sin backend propio, pero SIN depender de que
   la computadora tenga un programa de mail instalado (mailto: requiere
   eso, y hoy casi nadie lo tiene). En cambio, se abre directamente la
   ventana de redactar de Gmail (en el navegador, o la app si el sistema
   la abre sola — ver detalle más abajo), con destinatario, asunto y
   cuerpo ya completos. No hace falta copiar ni pegar nada.

   El asunto es SIEMPRE el mismo (CONFIG.ORDER_EMAIL_SUBJECT), así en tu
   casilla podés agrupar/filtrar todas las cotizaciones juntas. Aclaración
   honesta: como el cliente termina en una ventana de redacción real,
   técnicamente podría cambiar el asunto antes de tocar enviar — no hay
   forma de impedirlo del todo sin un servidor propio que mande el mail
   por vos —, pero por defecto le va a llegar siempre así.

   El código de producto (product.code) NO se muestra en ningún lado de la
   página, pero sí viaja en el mail y en el registro de la base de datos —
   es la única vía por la que llega a vos.
   ------------------------------------------------------------------------ */

// Valida el formulario y arma todos los datos del pedido en un solo
// objeto. Si falta algo, muestra el error y devuelve null. Tanto el
// envío del mail como el registro en la base de datos parten de acá, así
// los dos usan siempre exactamente los mismos datos.
function prepareOrder() {
  hideCartStatus();

  const items = Object.values(cart);
  const nombre = els.cartNombre.value.trim();
  const apellido = els.cartApellido.value.trim();
  const whatsapp = els.cartWhatsapp.value.trim();
  const email = els.cartEmail.value.trim();

  if (items.length === 0) {
    showCartStatus("Todavía no agregaste ningún producto al pedido.", "error");
    return null;
  }
  if (!nombre || !apellido) {
    showCartStatus("Completá tus datos antes de enviar.", "error");
    return null;
  }
  // WhatsApp y Email son opcionales — no bloquean el envío.

  // ID simple para poder agrupar en la planilla todas las filas que
  // pertenecen a este mismo pedido (un timestamp alcanza: es único y
  // además queda ordenable cronológicamente sin ningún esfuerzo extra).
  const orderId = String(Date.now());

  const message = buildOrderMessage({ nombre, apellido, whatsapp, email, items });

  return { orderId, nombre, apellido, whatsapp, email, items, message };
}

function isAndroidDevice() {
  return /android/i.test(navigator.userAgent);
}
function isMobileDevice() {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function openGmailCompose() {
  const order = prepareOrder();
  if (order === null) return;

  const to = encodeURIComponent(CONFIG.ORDER_EMAIL);
  const subject = encodeURIComponent(CONFIG.ORDER_EMAIL_SUBJECT);
  const body = encodeURIComponent(order.message);

  // Link "de siempre": funciona bien en PC y en iPhone (ahí, si tiene la
  // app de Gmail, Safari la ofrece igual con el texto cargado).
  const webUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;

  if (isAndroidDevice()) {
    // En Android, un link común a mail.google.com muchas veces abre la
    // app de Gmail pero en la bandeja de entrada, sin el mail redactado.
    // Este "intent" le pide explícitamente a Android que use la app de
    // Gmail (package com.google.android.gm) para componer el mail, y si
    // no la tiene instalada, S.browser_fallback_url hace que caiga sola
    // al link de arriba en el navegador.
    const intentUrl =
      `intent://send?to=${to}&subject=${subject}&body=${body}` +
      `#Intent;scheme=mailto;package=com.google.android.gm;` +
      `S.browser_fallback_url=${encodeURIComponent(webUrl)};end`;
    window.location.href = intentUrl;
  } else if (isMobileDevice()) {
    // iPhone: una navegación directa es más confiable que abrir una
    // pestaña nueva para que el sistema ofrezca la app correctamente.
    window.location.href = webUrl;
  } else {
    // PC: pestaña nueva, así no se pierde el catálogo de fondo.
    window.open(webUrl, "_blank", "noopener,noreferrer");
  }

  showCartStatus("Se abrió Gmail con el pedido ya cargado. Revisalo y tocá enviar desde ahí.", "success");

  // Registro en la base de datos: siempre en paralelo, nunca bloquea ni
  // condiciona lo de arriba (ver logOrderToDatabase).
  logOrderToDatabase(order);
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
    // El código sí va en el mail, aunque nunca se muestre en pantalla.
    const codePart = product.code ? ` (${product.code})` : "";
    lines.push(`- ${product.name}${codePart} — Cantidad: ${qty}`);
  });
  return lines.join("\n");
}

/* ------------------------------------------------------------------------
   Registro en la base de datos (planilla "Pedidos")

   Manda los datos del pedido a un Google Apps Script (ver README para
   cómo configurarlo) que agrega una fila por cada producto pedido, todas
   compartiendo el mismo "orderId" para poder agruparlas después.

   Detalles técnicos, por si hay que tocar esto en el futuro:
   - fetch con mode:"no-cors": Apps Script no siempre devuelve los
     encabezados que un navegador necesita para "leer" la respuesta desde
     JavaScript. Como acá no necesitamos leer nada de vuelta (solo que la
     fila se guarde), no-cors evita ese problema — a cambio, nunca vamos a
     poder saber desde acá si realmente funcionó o no. Por diseño: si
     falla, no le mostramos ningún error al cliente (su pedido ya se
     mandó bien por mail, que es lo que realmente le importa).
   - Content-Type: text/plain (en vez de application/json): Apps Script no
     responde bien a la petición de verificación previa ("preflight") que
     hacen los navegadores antes de mandar JSON real entre dominios
     distintos. Mandándolo como texto plano se evita ese problema, y del
     otro lado (en el Apps Script) igual se interpreta como JSON.
   ------------------------------------------------------------------------ */
function logOrderToDatabase(order) {
  if (!CONFIG.ORDERS_SHEET_WEBAPP_URL || CONFIG.ORDERS_SHEET_WEBAPP_URL.includes("PEGAR_AQUI")) {
    // Todavía no se configuró la base de datos — se ignora en silencio,
    // no tiene sentido molestar al cliente por algo que es 100% nuestro.
    console.warn("CONFIG.ORDERS_SHEET_WEBAPP_URL no está configurada: el pedido no se registró en la planilla (el mail sí se mandó).");
    return;
  }

  const payload = {
    orderId: order.orderId,
    nombre: order.nombre,
    entidad: order.apellido, // "apellido" es en realidad el campo Entidad del formulario
    whatsapp: order.whatsapp,
    email: order.email,
    items: order.items.map(({ product, qty }) => ({
      name: product.name,
      code: product.code,
      category: product.category,
      subcategory: product.subcategory,
      lab: product.lab,
      qty,
    })),
  };

  try {
    fetch(CONFIG.ORDERS_SHEET_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.warn("No se pudo registrar el pedido en la planilla (el mail se mandó igual):", err);
    });
  } catch (err) {
    console.warn("No se pudo registrar el pedido en la planilla (el mail se mandó igual):", err);
  }
}
