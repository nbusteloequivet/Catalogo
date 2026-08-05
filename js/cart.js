/* =========================================================================
   CART.JS — Lógica del pedido (el "carrito").

   Hoy este archivo arma un mail con el pedido y abre el cliente de correo
   del usuario. Es, a propósito, el lugar donde en el futuro engancharía
   una integración más avanzada: por ejemplo, en vez de (o además de) abrir
   el mail, hacer un fetch() a una API propia que valide stock real,
   aplique la lista de precios del cliente que está pidiendo, y guarde el
   pedido en una base de datos para después analizar productos más
   pedidos, faltantes, etc. El resto de la página (ui.js) no tendría que
   cambiar: seguiría llamando a estas mismas funciones.
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
   Envío de la cotización — sin backend, pero SIN depender de que la
   computadora tenga un programa de mail instalado (mailto: requiere eso,
   y hoy casi nadie lo tiene). En cambio, se abre directamente la ventana
   de redactar de Gmail en el navegador (o la app, si el sistema la abre
   sola — ver detalle en el chat), con el destinatario, asunto y cuerpo ya
   completos — el cliente solo tiene que tocar "Enviar" ahí. No hace falta
   copiar ni pegar nada.

   Si el cliente no está logueado en Gmail, este mismo link lo manda solo
   a la pantalla de login de Google, y apenas se loguea, Google lo trae de
   vuelta a la redacción con todo cargado — es un comportamiento propio de
   Google, no algo que este código tenga que resolver.

   El asunto es SIEMPRE el mismo (CONFIG.ORDER_EMAIL_SUBJECT), así en tu
   casilla podés agrupar/filtrar todas las cotizaciones juntas. Aclaración
   honesta: como el cliente termina en una ventana de redacción real,
   técnicamente podría cambiar el asunto antes de tocar enviar — no hay
   forma de impedirlo del todo sin un servidor propio que mande el mail
   por vos —, pero por defecto le va a llegar siempre así, que es lo que
   resuelve el caso normal.

   El código de producto (product.code) NO se muestra en ningún lado de la
   página, pero sí viaja acá, en el cuerpo del mail — es la única vía por
   la que llega a vos.
   ------------------------------------------------------------------------ */

// Valida el formulario y arma el mensaje. Si falta algo, muestra el error
// y devuelve null.
function prepareOrder() {
  hideCartStatus();

  const items = Object.values(cart);
  const nombre = els.cartNombre.value.trim();
  const apellido = els.cartApellido.value.trim();
  const whatsapp = els.cartWhatsapp.value.trim();

  if (items.length === 0) {
    showCartStatus("Todavía no agregaste ningún producto al pedido.", "error");
    return null;
  }
  if (!nombre || !apellido) {
    showCartStatus("Completá tus datos antes de enviar.", "error");
    return null;
  }
  // El WhatsApp es opcional: el email de contacto ya llega solo, como
  // remitente del mail que el cliente termina enviando desde su Gmail.

  const message = buildOrderMessage({ nombre, apellido, whatsapp, items });
  return message;
}

function openGmailCompose() {
  const message = prepareOrder();
  if (message === null) return;

  const to = encodeURIComponent(CONFIG.ORDER_EMAIL);
  const subject = encodeURIComponent(CONFIG.ORDER_EMAIL_SUBJECT);
  const body = encodeURIComponent(message);

  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;

  window.open(url, "_blank", "noopener,noreferrer");
  showCartStatus("Se abrió Gmail en una pestaña nueva, con el pedido ya cargado. Revisalo y tocá enviar desde ahí.", "success");
}

function buildOrderMessage({ nombre, apellido, whatsapp, items }) {
  const lines = [];
  lines.push(`Pedido - ${CONFIG.LAB_NAME}`);
  lines.push("");
  lines.push(`Cliente: ${nombre} ${apellido}`);
  if (whatsapp) lines.push(`WhatsApp: ${whatsapp}`);
  lines.push("");
  lines.push("Productos:");
  items.forEach(({ product, qty }) => {
    // El código sí va en el mail, aunque nunca se muestre en pantalla.
    const codePart = product.code ? ` (${product.code})` : "";
    lines.push(`- ${product.name}${codePart} — Cantidad: ${qty}`);
  });
  return lines.join("\n");
}
