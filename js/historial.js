let currentHistorialPedido = null;

// --------------------------------------------------------------------------
// Caché local del historial (en este navegador) — ver prefetchHistorial()
// y openHistorialModal(). El problema que esto ataca: Apps Script siempre
// tarda un par de segundos en responder, y eso se sentía como que "el
// historial tarda mucho" cada vez que se abría. Ahora, apenas el cliente
// se loguea (o si ya tenía la sesión guardada al abrir la página), se
// pide el historial en SEGUNDO PLANO sin que se note — y cuando
// efectivamente toca "Mi historial", lo que se muestra es esa copia ya
// guardada en el navegador, al instante, mientras por detrás se vuelve a
// pedir al servidor por si cambió algo. El resultado: la demora de Apps
// Script deja de notarse en el uso normal (abrir, mirar, cerrar) — solo
// se nota en la primera vez de cada sesión de navegador.
// --------------------------------------------------------------------------
const HISTORIAL_CACHE_KEY = "equivetHistorialCache";
const HISTORIAL_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 horas

function leerHistorialCache() {
  if (!session) return null;
  try {
    const raw = localStorage.getItem(HISTORIAL_CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.token !== session.token) return null;
    if (Date.now() - data.timestamp > HISTORIAL_CACHE_MAX_AGE_MS) return null;
    return data.pedidos;
  } catch (err) {
    return null;
  }
}

function guardarHistorialCache(pedidos) {
  if (!session) return;
  try {
    localStorage.setItem(HISTORIAL_CACHE_KEY, JSON.stringify({ token: session.token, pedidos: pedidos, timestamp: Date.now() }));
  } catch (err) {
    // localStorage lleno o bloqueado (modo privado, etc.) — no es crítico,
    // simplemente no se cachea esta vez.
  }
}

function borrarHistorialCache() {
  try {
    localStorage.removeItem(HISTORIAL_CACHE_KEY);
  } catch (err) {}
}

async function fetchMisPedidosYCachear() {
  const data = await fetchMisPedidos();
  if (data.ok) guardarHistorialCache(data.pedidos);
  return data;
}

// Se llama apenas hay sesión (justo después de loguearse/verificar
// cuenta/restablecer contraseña, y al abrir la página si ya había una
// sesión guardada) — no bloquea nada ni muestra ningún estado de carga,
// solo deja el historial listo en caché para cuando lo pidan.
function prefetchHistorial() {
  if (!session) return;
  fetchMisPedidosYCachear().catch(() => {});
}

async function fetchMisPedidos() {
  if (!session) return { ok: false, pedidos: [] };
  try {
    return await accountApiCall({ action: "misPedidos", token: session.token });
  } catch (err) {
    console.error("Error al traer el historial:", err);
    return { ok: false, pedidos: [] };
  }
}

function formatFechaHora(fecha, hora) {
  const horaCorta = (hora || "").toString().split(":").slice(0, 2).join(":");
  return [fecha, horaCorta].filter(Boolean).join(" · ");
}

function buildHistorialCard(pedido) {
  const card = document.createElement("button");
  card.type = "button";
  card.className = "historial-card";
  card.innerHTML = `
    <span class="historial-card-date">Solicitud #${escapeHtml(String(pedido.numeroPedidoCliente))} — ${escapeHtml(formatFechaHora(pedido.fecha, pedido.hora))}</span>
    <span class="historial-card-arrow" aria-hidden="true">→</span>
  `;
  card.addEventListener("click", () => openHistorialDetail(pedido));
  return card;
}

function renderHistorialList(pedidos) {
  els.historialList.innerHTML = "";
  els.historialEmpty.hidden = pedidos.length > 0;
  pedidos.forEach((pedido) => els.historialList.appendChild(buildHistorialCard(pedido)));
}

function historialDetailRowHtml(label, value) {
  if (!value) return "";
  return `<div class="historial-detail-row"><span class="k">${escapeHtml(label)}</span><span>${escapeHtml(String(value))}</span></div>`;
}

function renderHistorialDetail(pedido) {
  const nombreCompleto = [pedido.nombre, pedido.apellido].filter(Boolean).join(" ");
  const itemsHtml = pedido.items.length
    ? pedido.items.map((item) => `
        <div class="historial-item-row">
          <span>${escapeHtml(item.nombre)}</span>
          <span>Cantidad: ${escapeHtml(String(item.cantidad))}</span>
        </div>
      `).join("")
    : `<p class="cart-empty">Esta solicitud no tiene productos del catálogo cargados.</p>`;

  const mensajeHtml = pedido.mensaje
    ? `<div class="historial-mensaje-block">
         <span class="historial-mensaje-label">Mensaje adicional</span>
         <p class="historial-mensaje">"${escapeHtml(pedido.mensaje)}"</p>
       </div>`
    : "";

  els.historialDetailBody.innerHTML = `
    ${historialDetailRowHtml("Solicitud", "#" + pedido.numeroPedidoCliente + " — " + formatFechaHora(pedido.fecha, pedido.hora))}
    ${historialDetailRowHtml("Cliente", nombreCompleto)}
    ${historialDetailRowHtml("Entidad", pedido.entidad)}
    ${historialDetailRowHtml("Necesita factura A", pedido.necesitaFactura ? "Sí" : "No")}
    ${historialDetailRowHtml("WhatsApp", formatearWhatsappParaMostrar(pedido.whatsapp))}
    ${historialDetailRowHtml("Email", pedido.email)}
    <div class="historial-items-list">${itemsHtml}</div>
    ${mensajeHtml}
  `;
}

function openHistorialDetail(pedido) {
  currentHistorialPedido = pedido;
  els.historialEditStatus.hidden = true;
  renderHistorialDetail(pedido);
  showHistorialView("detail");
}

function normalizarCodigo(codigo) {
  return String(codigo == null ? "" : codigo).trim().replace(/^0+(?=\d)/, "");
}

function cargarPedidoEnCarrito(pedido) {
  clearCart();

  const noEncontrados = [];
  pedido.items.forEach((item) => {
    const match = allProducts.find((p) => {
      if (item.codigo && p.code) return normalizarCodigo(item.codigo) === normalizarCodigo(p.code);
      return !item.codigo && p.name === item.nombre;
    });
    if (match) {
      const key = productKey(match);
      cart[key] = { product: match, qty: safeInt(item.cantidad) || 1 };
    } else {
      noEncontrados.push(item);
    }
  });

  els.cartNombre.value = pedido.nombre || "";
  els.cartApellido.value = pedido.apellido || "";
  els.cartEntidad.value = pedido.entidad || "";
  els.cartFactura.value = pedido.necesitaFactura ? "si" : "no";
  marcarFacturaConError(false);
  syncFacturaButtons();
  els.cartWhatsapp.value = formatearWhatsappParaMostrar(pedido.whatsapp || "");
  els.cartEmail.value = pedido.email || "";

  let mensaje = pedido.mensaje || "";
  if (noEncontrados.length > 0) {
    const aviso = "Productos de esta solicitud que ya no están en el catálogo actual: " +
      noEncontrados.map((i) => `${i.nombre} (cantidad ${i.cantidad})`).join(", ");
    mensaje = mensaje ? mensaje + "\n\n" + aviso : aviso;
  }
  els.cartMensaje.value = mensaje;

  editingOrderId = pedido.orderId;
  els.cartTitle.textContent = "Editando solicitud #" + pedido.numeroPedidoCliente;
  els.sendOrderBtn.textContent = "Editar y enviar solicitud";
  els.cartFab.textContent = "Solicitud " + pedido.numeroPedidoCliente;
  els.cancelEditBtn.hidden = false;
  els.clearCartBtn.hidden = true;

  Object.keys(cart).forEach((key) => {
    updateCartIndicator(key);
  });

  return noEncontrados;
}
