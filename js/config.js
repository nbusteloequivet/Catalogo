/* =========================================================================
   CONFIG.JS — Configuración general del sitio.
   Es el único archivo que normalmente vas a tocar para cambios de datos
   (planilla, contacto, textos). Los demás archivos (data.js, cart.js,
   ui.js, main.js) leen estos valores, no hace falta tocarlos para esto.
   ========================================================================= */
const CONFIG = {
  // URL del CSV publicado (Archivo > Compartir > Publicar en la Web > CSV)
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQC4BFXcTT1kYiQALcRtU2X4EkKqAbXc1tf0hfLzsaZbofK_AaDVn6X6Nj9Vlx-6ld484FGk1VHG1Y2/pub?gid=0&single=true&output=csv",

  // Nombre y bajada que se muestran arriba de todo, centrados
  LAB_NAME: "EquiVet",
  LAB_SUBTITLE: "Especialistas en reproducción",

  // Cada cuánto se vuelve a consultar la planilla sola, en milisegundos
  AUTO_REFRESH_MS: 30000,

  // Ancho de imagen que se le pide a Drive
  IMAGE_WIDTH: 500,

  // ---- Datos de destino del pedido: A DÓNDE TE LLEGA A VOS ----
  ORDER_EMAIL: "nbustelo.equivet@gmail.com",

  // Asunto FIJO para todos los mails de cotización (para poder filtrarlos
  // y agruparlos en tu casilla).
  ORDER_EMAIL_SUBJECT: "Pedido de cotización - EquiVet",

  // ---- Datos de contacto de la empresa (sección "Contacto" al pie) ----
  COMPANY_INSTAGRAM_URL: "https://instagram.com/equivet_arg",
  COMPANY_INSTAGRAM_HANDLE: "@equivet_arg",

  COMPANY_WHATSAPP_NUMBER: "5491158846826",
  COMPANY_WHATSAPP_DISPLAY: "+54 9 11 5884-6826",

  COMPANY_EMAIL: "nbustelo.equivet@gmail.com",

  COMPANY_HOURS: "Lunes a viernes de 9 a 17 hs",

  COMPANY_ADDRESS: "Reconquista 177, B2814BJE Los Cardales, Provincia de Buenos Aires",

  // Coordenadas EXACTAS para el mapa (latitud,longitud). Usar coordenadas
  // en vez del texto de la dirección evita que Google Maps muestre varios
  // resultados posibles en lugar de un único punto.
  //
  // Cómo conseguirlas: abrí Google Maps, buscá tu dirección, hacé click
  // derecho justo sobre el punto exacto del local (no en el resultado de
  // la búsqueda, sino en el mapa) y elegí la primera opción del menú, que
  // son las coordenadas (algo como "-34.401234, -58.912345"). Click ahí
  // para copiarlas, y pegalas acá abajo tal cual, sin espacios.
  COMPANY_MAP_QUERY: "-34.34031436171752,-58.993835363352446",

  // Ruta del logo (usado en el header). Acepta .png, .jpg o .svg — el
  // navegador lo muestra igual, solo cambiá el nombre de archivo acá si
  // el logo cambia.
  LOGO_PATH: "assets/logo-equivet.jpg",

  // ---- Base de datos de pedidos (planilla "Pedidos") ----
  // URL del Google Apps Script publicado como "Web App" (ver README para
  // el paso a paso de cómo generarla). Cada vez que alguien envía un
  // presupuesto, además del mail, se manda una copia de los datos acá
  // para ir guardando un historial de pedidos en la planilla. Si esto
  // falla por lo que sea, el mail se manda igual — nunca depende uno
  // del otro.
  ORDERS_SHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbzh_Ync4bQOfKprLcN4faM6cn04MMfZoegSFYPH8TVwvLSxJbJ3s5uRphAX-Th2MjPK4Q/exec",
};

/* Colores para distinguir categorías a simple vista (franja + chip activo). */
const CATEGORY_COLORS = [
  "#b200ff", "#000000", "#ff2ecb", "#00b3c6", "#ff7a00",
  "#00a651", "#ffcc00", "#e63946", "#3a5cff", "#8c52ff",
];

/* Columnas que el programa busca en la planilla (sin importar mayúsculas
   ni tildes, ver normalizeHeader en data.js). El precio, moneda e IVA se
   siguen leyendo por si los necesitás el día de mañana (por ejemplo, para
   una versión con precios distintos por cliente logueado), pero a
   propósito NO se muestran en la página pública. El código de producto
   también se lee siempre, pero ya no se muestra en ningún lado de cara al
   cliente — solo viaja en el cuerpo del mail de la cotización. */
const COLUMNS = {
  name: "nombre",
  category: "categoria",
  subcategory: "subcategoria",
  price: "precio",
  currency: "moneda",
  iva: "iva",
  code: "codigo",
  lab: "laboratorio",
  description: "descripcion",
  image: "imagen",
  availability: "disponibilidad",
};
