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
   Envío de la cotización por Email — sin backend: se arma el mensaje y se
   abre el cliente de correo ya con el texto cargado. La persona que hace
   el pedido confirma el envío desde ahí.

   El asunto es SIEMPRE el mismo (CONFIG.ORDER_EMAIL_SUBJECT), para que en
   tu casilla de mail puedas agrupar/filtrar todas las cotizaciones juntas.

   El código de producto (product.code) NO se muestra en ningún lado de la
   página, pero sí viaja acá, en el cuerpo del mail — es la única vía por
   la que llega a vos.
   ------------------------------------------------------------------------ */
function sendOrder() {
  hideCartStatus();

  const items = Object.values(cart);
  const nombre = els.cartNombre.value.trim();
  const apellido = els.cartApellido.value.trim();
  const whatsapp = els.cartWhatsapp.value.trim();
  const email = els.cartEmail.value.trim();

  if (items.length === 0) {
    showCartStatus("Todavía no agregaste ningún producto al pedido.", "error");
    return;
  }
  if (!nombre || !apellido) {
    showCartStatus("Completá tus datos antes de enviar.", "error");
    return;
  }
  if (!whatsapp && !email) {
    showCartStatus("Dejanos un WhatsApp o un Email de contacto.", "error");
    return;
  }

  const message = buildOrderMessage({ nombre, apellido, whatsapp, email, items });

  const subject = encodeURIComponent(CONFIG.ORDER_EMAIL_SUBJECT);
  const body = encodeURIComponent(message);
  window.location.href = `mailto:${CONFIG.ORDER_EMAIL}?subject=${subject}&body=${body}`;

  showCartStatus("Se abrió tu cliente de correo con el pedido cargado. Confirmá el envío desde ahí y después podés vaciar el pedido.", "success");
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
