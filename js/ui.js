/* =========================================================================
   UI.JS — Todo lo que dibuja cosas en pantalla: grilla, tarjetas, modales,
   chips de categoría y la sección de contacto. No decide de dónde salen
   los datos (eso es data.js) ni qué significa "agregar al pedido" (eso es
   cart.js) — solo los muestra y conecta los clicks con esas funciones.
   ========================================================================= */
 
/* ------------------------------------------------------------------------
   Búsqueda
   ------------------------------------------------------------------------ */
function setupSearch() {
  let debounceTimer;
  els.searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    const value = e.target.value;
    debounceTimer = setTimeout(() => {
      searchTerm = value.trim().toLowerCase();
      renderGrid();
    }, 200);
  });
}
 
/* ------------------------------------------------------------------------
   Chips de categoría
   ------------------------------------------------------------------------ */
function buildCategoryChips() {
  const categories = [...new Set(allProducts.flatMap((p) => p.categories))].sort();
  categoryColorMap = {};
  categories.forEach((c, i) => (categoryColorMap[c] = CATEGORY_COLORS[i % CATEGORY_COLORS.length]));

  els.categoryChips.innerHTML = "";
  els.categoryChips.appendChild(makeChip("Todas", null, activeCategory, (value) => {
    activeCategory = value;
    buildCategoryChips();
    updateSubcategoryChips(value);
    renderGrid();
  }));
  categories.forEach((c) => els.categoryChips.appendChild(makeChip(c, c, activeCategory, (value) => {
    activeCategory = value;
    buildCategoryChips();
    updateSubcategoryChips(value);
    renderGrid();
  })));
}

// Se llama cada vez que se elige una categoría (o "Todas"). Si esa
// categoría tiene más de una subcategoría entre los productos cargados,
// arma y muestra su panel de subcategorías (mismo estilo de chip); si no
// tiene, o se eligió "Todas", oculta ese panel.
function updateSubcategoryChips(category) {
  const subcats = category
    ? [...new Set(allProducts.filter((p) => p.categories.includes(category)).flatMap((p) => p.subcategories))].sort()
    : [];

  if (subcats.length === 0) {
    activeSubcategory = null;
    els.subcategoryChips.innerHTML = "";
    els.subcategoryChips.hidden = true;
    return;
  }

  // Si veníamos filtrando por una subcategoría que no pertenece a la
  // categoría recién elegida, se descarta.
  if (activeSubcategory && !subcats.includes(activeSubcategory)) {
    activeSubcategory = null;
  }

  renderSubcategoryChips(subcats);
  els.subcategoryChips.hidden = false;
}

function renderSubcategoryChips(subcats) {
  els.subcategoryChips.innerHTML = "";
  els.subcategoryChips.appendChild(makeChip("Todas", null, activeSubcategory, (value) => {
    activeSubcategory = value;
    renderSubcategoryChips(subcats);
    renderGrid();
  }));
  subcats.forEach((s) => els.subcategoryChips.appendChild(makeChip(s, s, activeSubcategory, (value) => {
    activeSubcategory = value;
    renderSubcategoryChips(subcats);
    renderGrid();
  })));
}

// Mismo patrón que buildCategoryChips, pero agrupando por laboratorio en
// vez de categoría. Usa el mismo estilo de chip (.chip / .category-chips)
// para que se vea exactamente igual.
function buildLabChips() {
  const labs = [...new Set(allProducts.map((p) => p.lab).filter(Boolean))].sort();

  els.labChips.innerHTML = "";
  els.labChips.appendChild(makeChip("Todos", null, activeLab, (value) => {
    activeLab = value;
    buildLabChips();
    renderGrid();
  }));
  labs.forEach((l) => els.labChips.appendChild(makeChip(l, l, activeLab, (value) => {
    activeLab = value;
    buildLabChips();
    renderGrid();
  })));
}

// Genérico: arma un botón "chip". onSelect recibe el valor elegido (o
// null para "Todas/Todos") y decide qué hacer — así lo puede reutilizar
// cualquier filtro (categoría, laboratorio, o el que se agregue a futuro)
// sin duplicar el diseño del botón.
function makeChip(label, value, activeValue, onSelect) {
  const chip = document.createElement("button");
  chip.className = "chip" + (activeValue === value ? " active" : "");
  chip.textContent = label;
  chip.type = "button";
  chip.addEventListener("click", () => onSelect(value));
  return chip;
}

/* ------------------------------------------------------------------------
   Desplegables de filtro (Categorías / Laboratorios)
   Cada botón "toggle" muestra/oculta su propio panel de chips. Los dos
   son independientes: se puede tener uno, el otro, los dos, o ninguno
   abierto a la vez.
   ------------------------------------------------------------------------ */
function setupFilterToggles() {
  setupFilterToggle(els.categoryToggle, els.categoryChips);
  setupFilterToggle(els.labToggle, els.labChips);

  // Al cerrar "Categorías", si había un panel de subcategorías abierto
  // (anidado adentro), se oculta también — el filtro elegido se mantiene,
  // solo deja de verse hasta que se vuelva a abrir "Categorías".
  els.categoryToggle.addEventListener("click", () => {
    if (els.categoryToggle.getAttribute("aria-expanded") !== "true") {
      els.subcategoryChips.hidden = true;
    }
  });
}

function setupFilterToggle(toggleBtn, panelEl) {
  toggleBtn.addEventListener("click", () => {
    const isOpen = toggleBtn.getAttribute("aria-expanded") === "true";
    if (isOpen) {
      closeFilterPanel(toggleBtn, panelEl);
    } else {
      toggleBtn.setAttribute("aria-expanded", "true");
      panelEl.hidden = false;
    }
  });
}

function closeFilterPanel(toggleBtn, panelEl) {
  toggleBtn.setAttribute("aria-expanded", "false");
  panelEl.hidden = true;
}

/* ------------------------------------------------------------------------
   Grilla de productos
   ------------------------------------------------------------------------ */
function renderGrid() {
  const filtered = allProducts.filter((p) => {
    if (activeCategory && !p.categories.includes(activeCategory)) return false;
    if (activeSubcategory && !p.subcategories.includes(activeSubcategory)) return false;
    if (activeLab && p.lab !== activeLab) return false;
    if (searchTerm) {
      // El código sigue siendo buscable (útil si alguien lo tipea de
      // memoria) aunque nunca se muestre en la tarjeta.
      const haystack = `${p.name} ${p.categories.join(" ")} ${p.subcategories.join(" ")} ${p.code} ${p.lab}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });
 
  els.grid.innerHTML = "";
  cartIndicatorEls = {};
  addButtonEls = {};
 
  if (filtered.length === 0) {
    els.emptyState.hidden = false;
    return;
  }
  els.emptyState.hidden = true;
 
  const fragment = document.createDocumentFragment();
  filtered.forEach((p) => fragment.appendChild(buildCard(p)));
  els.grid.appendChild(fragment);
}
 
function availabilityTagHtml(p) {
  const cls = p.availability === "En stock" ? "in" : "out";
  return `<span class="avail-tag ${cls}">${escapeHtml(p.availability)}</span>`;
}
 
// Nota: el producto trae "code" (p.code) pero deliberadamente no se
// renderiza en ningún lado de la tarjeta ni del modal — el cliente no debe
// verlo en pantalla. Sigue viajando en el mail de la cotización (cart.js).
function buildCard(p) {
  const key = productKey(p);
 
  const card = document.createElement("article");
  card.className = "product-card";
 
  const strip = document.createElement("div");
  strip.className = "card-strip";
  // Si el producto tiene más de una categoría, la franja usa el color de
  // la primera (es solo una referencia visual rápida, no hace falta que
  // represente las dos a la vez).
  strip.style.background = categoryColorMap[p.categories[0]] || CATEGORY_COLORS[0];
  card.appendChild(strip);
 
  const media = document.createElement("div");
  media.className = "card-media";
  media.appendChild(buildImageEl(p, false));
  media.addEventListener("click", () => openProductModal(p));
  card.appendChild(media);
 
  const body = document.createElement("div");
  body.className = "card-body";
  // El renglón de laboratorio se imprime SIEMPRE (aunque quede vacío) para
  // que la altura de la tarjeta no varíe según el producto — si solo lo
  // agregáramos cuando corresponde, esas tarjetas puntuales quedarían más
  // altas que el resto de la grilla.
  const showLab = Boolean(p.lab) && duplicateProductNames.has(normalizeNameForCompare(p.name));

  // Una categoría/subcategoría por renglón (en vez de todas juntas
  // separadas por coma en un solo renglón) — con 2 o más queda mucho más
  // legible. Cada <span> es un hijo directo de .card-body (flex-column),
  // así que cada uno cae en su propia línea solo.
  const categoryHtml = p.categories.map((c) => `<span class="card-category">${escapeHtml(c)}</span>`).join("");
  const subcategoryHtml = p.subcategories.map((s) => `<span class="card-subcategory">${escapeHtml(s)}</span>`).join("");

  // ".card-bottom" agrupa la línea divisoria + "En stock" + selector de
  // cantidad + "Agregar" en un solo bloque anclado siempre al FONDO de la
  // tarjeta (margin-top: auto en style.css), sin importar cuánto texto
  // haya arriba (nombre, categorías, subcategorías, laboratorio). Así la
  // línea divisoria queda siempre a la misma altura en toda la fila de la
  // grilla, tenga el producto 1 categoría o 3.
  body.innerHTML = `
    <h3 class="card-title">${escapeHtml(p.name)}</h3>
    ${categoryHtml}
    ${subcategoryHtml}
    <span class="card-lab">${showLab ? escapeHtml(p.lab) : ""}</span>
    <div class="card-bottom">
      <div class="card-footer">${availabilityTagHtml(p)}</div>
    </div>
  `;
  body.querySelector(".card-title").addEventListener("click", () => openProductModal(p));
 
  const cartRow = buildCartRow(p, key);
  body.querySelector(".card-bottom").appendChild(cartRow.wrapper);
  card.appendChild(body);
 
  cartIndicatorEls[key] = cartRow.indicatorEl;
  updateCartIndicator(key);
 
  return card;
}
 
// Estado "pendiente" del botón: "Agregar" si el producto todavía no está
// en el pedido, "Modificar" si ya está (el cliente está por cambiar la
// cantidad de algo que ya había agregado). Se usa tanto al construir la
// tarjeta como cada vez que hay que volver atrás desde "Agregado" o
// "Modificado" (porque el cliente tocó +/-, escribió una cantidad nueva,
// o el producto se sacó del pedido desde otro lado).
function setAddButtonIdle(btn, key) {
  btn.classList.remove("is-done");
  btn.textContent = cart[key] ? "Modificar" : "Agregar";
}

// Estado "confirmado": "Agregado" la primera vez que el producto entra al
// pedido, "Modificado" las veces siguientes que se confirma un cambio de
// cantidad sobre un producto que ya estaba — mismo color en los dos
// casos, como pediste.
function setAddButtonDone(btn, wasInCart) {
  btn.classList.add("is-done");
  btn.textContent = wasInCart ? "Modificado" : "Agregado";
}

// Se llama desde cart.js cuando el producto se saca del pedido por otra
// vía que no sea este mismo botón (el ✕ del carrito, o "Vaciar pedido"),
// para que la tarjeta no se quede mostrando "Agregado"/"Modificado" de un
// producto que en realidad ya no está en el pedido.
function resetAddButton(key) {
  const btn = addButtonEls[key];
  if (!btn) return;
  setAddButtonIdle(btn, key);
}

// Controles de cantidad + botón "Agregar" (reutilizados en tarjeta y modal)
function buildCartRow(p, key) {
  const wrapper = document.createElement("div");
  wrapper.className = "card-cart-row";
 
  const qtyControl = document.createElement("div");
  qtyControl.className = "qty-control";
 
  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.className = "qty-btn";
  minusBtn.textContent = "−";
  minusBtn.setAttribute("aria-label", "Restar uno");
 
  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.className = "qty-input";
  qtyInput.min = "0";
  qtyInput.value = "1";
  qtyInput.setAttribute("aria-label", `Cantidad de ${p.name}`);
 
  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.className = "qty-btn";
  plusBtn.textContent = "+";
  plusBtn.setAttribute("aria-label", "Sumar uno");
 
  const stopBubble = (fn) => (e) => { e.stopPropagation(); fn(e); };
 
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "add-btn";
  setAddButtonIdle(addBtn, key); // "Agregar" si es nuevo, "Modificar" si ya estaba en el pedido

  // Cada vez que el cliente toca +/- o escribe una cantidad nueva, si el
  // botón estaba mostrando "Agregado"/"Modificado" (un cambio ya
  // confirmado), vuelve a pedir confirmación con "Modificar" — ese
  // cambio todavía no se mandó al pedido hasta que lo vuelva a tocar.
  const onQtyChanged = () => {
    if (addBtn.classList.contains("is-done")) setAddButtonIdle(addBtn, key);
  };

  minusBtn.addEventListener("click", stopBubble(() => {
    qtyInput.value = Math.max(0, safeInt(qtyInput.value) - 1);
    onQtyChanged();
  }));
  plusBtn.addEventListener("click", stopBubble(() => {
    qtyInput.value = safeInt(qtyInput.value) + 1;
    onQtyChanged();
  }));
  qtyInput.addEventListener("click", (e) => e.stopPropagation());
  qtyInput.addEventListener("input", onQtyChanged);
 
  qtyControl.append(minusBtn, qtyInput, plusBtn);
 
  addBtn.addEventListener("click", stopBubble(() => {
    const qty = safeInt(qtyInput.value);
    if (qty <= 0) {
      // removeFromCart ya deja el botón en "Agregar" (ver resetAddButton
      // en cart.js) — no hace falta tocarlo de nuevo acá.
      removeFromCart(key);
    } else {
      const wasInCart = Boolean(cart[key]);
      addToCart(p, key, qty);
      setAddButtonDone(addBtn, wasInCart);
    }
  }));
 
  wrapper.append(qtyControl, addBtn);
  addButtonEls[key] = addBtn;
 
  const indicatorEl = document.createElement("div");
  indicatorEl.className = "cart-indicator";
  indicatorEl.hidden = true;
 
  const outer = document.createElement("div");
  outer.appendChild(wrapper);
  outer.appendChild(indicatorEl);
 
  return { wrapper: outer, indicatorEl };
}
 
function buildImageEl(p, large) {
  if (!p.imageUrl) {
    const placeholder = document.createElement("div");
    placeholder.className = "no-image";
    placeholder.textContent = "Sin imagen";
    return placeholder;
  }
  const img = document.createElement("img");
  img.src = p.imageUrl;
  img.alt = p.name;
  img.loading = large ? "eager" : "lazy";
  img.onerror = () => {
    img.replaceWith(Object.assign(document.createElement("div"), {
      className: "no-image",
      textContent: "Imagen no disponible",
    }));
  };
  return img;
}
 
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
 
/* ------------------------------------------------------------------------
   Modal de detalle de producto
   ------------------------------------------------------------------------ */
function openProductModal(p) {
  const key = productKey(p);
  els.modalBody.innerHTML = "";
 
  const media = document.createElement("div");
  media.className = "modal-media";
  media.appendChild(buildImageEl(p, true));
 
  const info = document.createElement("div");
  info.className = "modal-info";
  const modalCategoryHtml = p.categories.map((c) => `<span class="modal-category">${escapeHtml(c)}</span>`).join("");
  const modalSubcategoryHtml = p.subcategories.map((s) => `<span class="modal-subcategory">${escapeHtml(s)}</span>`).join("");
  info.innerHTML = `
    <h2 id="modal-title">${escapeHtml(p.name)}</h2>
    <div class="modal-tags">${modalCategoryHtml}${modalSubcategoryHtml}</div>
    <div class="modal-avail-row">${availabilityTagHtml(p)}</div>
    ${p.lab ? `<div class="modal-row"><span class="k">Laboratorio</span><span>${escapeHtml(p.lab)}</span></div>` : ""}
    ${p.description ? `<p class="modal-desc">${escapeHtml(p.description)}</p>` : ""}
  `;
 
  const cartRow = buildCartRow(p, key);
  cartRow.wrapper.querySelector(".card-cart-row").classList.add("modal-cart-row");
  info.appendChild(cartRow.wrapper);
 
  els.modalBody.appendChild(media);
  els.modalBody.appendChild(info);
 
  cartIndicatorEls[key] = cartRow.indicatorEl;
  updateCartIndicator(key);
 
  openModalEl(els.productModal);
}
 
/* ------------------------------------------------------------------------
   Apertura / cierre genérico de modales
   ------------------------------------------------------------------------ */
function openModalEl(modalEl) {
  modalEl.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModalEl(modalEl) {
  modalEl.hidden = true;
  if (els.productModal.hidden && els.cartModal.hidden) {
    document.body.style.overflow = "";
  }
  if (modalEl === els.productModal) renderGrid();
}
 
function setupModalClosers() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => closeModalEl(document.getElementById(btn.dataset.closeModal)));
  });
  [els.productModal, els.cartModal].forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModalEl(overlay);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!els.cartModal.hidden) closeModalEl(els.cartModal);
    else if (!els.productModal.hidden) closeModalEl(els.productModal);
  });
}
 
/* ------------------------------------------------------------------------
   Modal / botón del carrito
   ------------------------------------------------------------------------ */
function setupCartModal() {
  els.cartFab.addEventListener("click", () => {
    renderCartModal();
    openModalEl(els.cartModal);
  });
 
  els.clearCartBtn.addEventListener("click", () => {
    clearCart();
    showCartStatus("Vaciaste tu pedido.", "success");
  });
 
  els.sendGmailBtn.addEventListener("click", openGmailCompose);
}
 
function renderCartModal() {
  const items = Object.entries(cart);
  els.cartItemsEl.innerHTML = "";
  els.cartEmptyEl.hidden = items.length > 0;
 
  items.forEach(([key, entry]) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    // Acá tampoco se muestra el código: la referencia visible para el
    // cliente es la categoría (o subcategoría, si tiene).
    const metaText = entry.product.subcategories.length
      ? entry.product.subcategories.join(", ")
      : entry.product.categories.join(", ");
    row.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${escapeHtml(entry.product.name)}</div>
        <div class="cart-item-meta">${escapeHtml(metaText)}</div>
      </div>
    `;
 
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.className = "cart-item-qty";
    qtyInput.value = String(entry.qty);
    qtyInput.setAttribute("aria-label", `Cantidad de ${entry.product.name}`);
    qtyInput.addEventListener("change", () => {
      const qty = safeInt(qtyInput.value);
      if (qty <= 0) {
        removeFromCart(key);
      } else {
        entry.qty = qty;
        updateCartIndicator(key);
      }
    });
 
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "cart-item-remove";
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", `Quitar ${entry.product.name}`);
    removeBtn.addEventListener("click", () => removeFromCart(key));
 
    row.appendChild(qtyInput);
    row.appendChild(removeBtn);
    els.cartItemsEl.appendChild(row);
  });
}
 
function showCartStatus(msg, type) {
  els.cartStatus.hidden = false;
  els.cartStatus.textContent = msg;
  els.cartStatus.className = "cart-status " + type;
}
function hideCartStatus() {
  els.cartStatus.hidden = true;
}
 
/* ------------------------------------------------------------------------
   Textarea de "Mensaje adicional": crece solo hacia abajo a medida que el
   cliente escribe (en vez de dejarlo arrastrar la esquina a mano, que
   quedaba raro — ver el resize:none puesto en style.css). No tiene techo:
   por más que escriba mucho, el cuadro sigue agrandándose sin cortar
   texto ni mostrar scroll interno.
   ------------------------------------------------------------------------ */
function setupAutoGrowTextarea(textareaEl) {
  const resize = () => {
    textareaEl.style.height = "auto";
    textareaEl.style.height = textareaEl.scrollHeight + "px";
  };
  textareaEl.addEventListener("input", resize);
  resize(); // altura correcta si ya viene con texto (ej. al reabrir el modal)
}

/* ------------------------------------------------------------------------
   Botón "Contacto": baja a la sección de contacto al final de la página.
   ------------------------------------------------------------------------ */
function setupContactFab() {
  els.contactFab.addEventListener("click", () => {
    els.contactSection.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
 
/* ------------------------------------------------------------------------
   Contacto de la empresa (Instagram, WhatsApp, email, horarios y mapa)
   ------------------------------------------------------------------------ */
function setupCompanyContact() {
  els.contactInstagram.href = CONFIG.COMPANY_INSTAGRAM_URL;
  els.contactInstagramValue.textContent = CONFIG.COMPANY_INSTAGRAM_HANDLE;
 
  els.contactWhatsapp.href = `https://wa.me/${CONFIG.COMPANY_WHATSAPP_NUMBER}`;
  els.contactWhatsappValue.textContent = CONFIG.COMPANY_WHATSAPP_DISPLAY;
 
  els.contactGmail.href = "#";
  els.contactGmail.addEventListener("click", (e) => {
    e.preventDefault();
    openEmailContact(CONFIG.COMPANY_EMAIL, "", "");
  });
  els.contactGmailValue.textContent = CONFIG.COMPANY_EMAIL;
 
  els.contactHoursValue.textContent = CONFIG.COMPANY_HOURS;
 
  els.contactAddressValue.textContent = CONFIG.COMPANY_ADDRESS;
  // Ojo: acá se usa COMPANY_MAP_QUERY (coordenadas), no COMPANY_ADDRESS
  // (texto) — es lo que evita que aparezcan varias ubicaciones posibles.
  const encodedQuery = encodeURIComponent(CONFIG.COMPANY_MAP_QUERY);
  els.contactMapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  els.contactMapIframe.src = `https://www.google.com/maps?q=${encodedQuery}&output=embed`;
}
 
/* ------------------------------------------------------------------------
   Banner de estado del catálogo
   ------------------------------------------------------------------------ */
function showStatus(msg, type) {
  els.statusBanner.hidden = false;
  els.statusBanner.textContent = msg;
  els.statusBanner.className = "status-banner" + (type === "info" ? " info" : "");
}
function hideStatus() {
  els.statusBanner.hidden = true;
}
