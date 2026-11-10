/* Coffee 'n' Crunch · comportamiento de la página (sin dependencias).
   ?captura apaga animaciones y vídeo (para capturas); ?dia=0..6&hora=HH:MM simula un momento (0 = domingo). */
(() => {
  "use strict";
  window.CNC = true;
  const doc = document.documentElement;
  const q = (s, c = document) => c.querySelector(s);
  const qa = (s, c = document) => [...c.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);
  const CAPTURA = params.has("captura");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ahorro = !!(navigator.connection && navigator.connection.saveData);
  const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

  if (CAPTURA) {
    doc.classList.remove("js");
    qa('img[loading="lazy"]').forEach(i => { i.loading = "eager"; });
  }

  /* ---------- hora de Lloret de Mar y estado de apertura ---------- */
  const NOMBRES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const horario = JSON.parse(q("#datos-horario").textContent);
  const aMin = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const fmt = s => s.replace(/^0/, "");

  function ahora() {
    if (params.has("dia") || params.has("hora")) {
      const [h, m] = (params.get("hora") || "10:00").split(":").map(Number);
      const d = params.has("dia") ? Number(params.get("dia")) : new Date().getDay();
      return { d, min: h * 60 + (m || 0) };
    }
    try {
      const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
      const v = t => partes.find(p => p.type === t).value;
      const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { d: dias[v("weekday")], min: Number(v("hour")) * 60 + Number(v("minute")) };
    } catch (e) {
      const f = new Date();
      return { d: f.getDay(), min: f.getHours() * 60 + f.getMinutes() };
    }
  }

  function estado() {
    const { d, min } = ahora();
    const hoy = horario.find(x => x.d === d);
    if (hoy && min >= aMin(hoy.a) && min < aMin(hoy.c)) return { abierto: true, texto: `Abierto ahora, hasta las ${fmt(hoy.c)}`, d };
    if (hoy && min < aMin(hoy.a)) return { abierto: false, texto: `Cerrado ahora. Abre hoy a las ${fmt(hoy.a)}`, d };
    for (let i = 1; i <= 7; i++) {
      const sig = horario.find(x => x.d === (d + i) % 7);
      if (sig) return { abierto: false, texto: `Cerrado ahora. Abre ${i === 1 ? "mañana" : "el " + NOMBRES[sig.d]} a las ${fmt(sig.a)}`, d };
    }
    return { abierto: false, texto: "Cerrado", d };
  }

  function pintarEstado() {
    const e = estado();
    qa("[data-estado]").forEach(el => {
      el.classList.toggle("abierto", e.abierto);
      const t = q("[data-estado-texto]", el);
      if (t) t.textContent = e.texto;
    });
    qa("[data-estado-corto]").forEach(el => { el.textContent = e.texto; });
    qa(".horario tr").forEach(tr => tr.classList.toggle("hoy", Number(tr.dataset.dia) === e.d));
  }
  pintarEstado();
  setInterval(pintarEstado, 60000);

  /* ---------- cabecera fija, menú del móvil y barra de acciones ---------- */
  const cabecera = q("#cabecera");
  const portada = q(".portada");
  const barra = q("[data-barra-movil]");
  if ("IntersectionObserver" in window && portada) {
    const centinela = document.createElement("div");
    centinela.style.cssText = "position:absolute;top:0;left:0;width:1px;height:8px;pointer-events:none";
    document.body.prepend(centinela);
    new IntersectionObserver(([e]) => cabecera.classList.toggle("es-fija", !e.isIntersecting)).observe(centinela);
    if (barra && !CAPTURA) new IntersectionObserver(([e]) => barra.classList.toggle("visible", !e.isIntersecting), { rootMargin: "0px 0px -35% 0px" }).observe(portada);
  }

  const botonMenu = q(".cabecera__menu");
  const menu = q("#menu-movil");
  function cerrarMenu(devolverFoco) {
    if (menu.hidden) return;
    menu.hidden = true;
    botonMenu.setAttribute("aria-expanded", "false");
    q(".sr-only", botonMenu).textContent = "Abrir el menú";
    if (devolverFoco) botonMenu.focus();
  }
  if (botonMenu && menu) {
    botonMenu.addEventListener("click", () => {
      if (!menu.hidden) return cerrarMenu(false);
      menu.hidden = false;
      botonMenu.setAttribute("aria-expanded", "true");
      q(".sr-only", botonMenu).textContent = "Cerrar el menú";
      const primero = q("a", menu);
      if (primero) primero.focus();
    });
    menu.addEventListener("click", e => { if (e.target.closest("a")) cerrarMenu(false); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarMenu(true); });
    matchMedia("(min-width: 861px)").addEventListener("change", e => { if (e.matches) cerrarMenu(false); });
  }

  /* ---------- vídeo de la portada: carga tras la página, solo si conviene ---------- */
  const video = q(".portada__video");
  if (video && !reduce && !ahorro && !CAPTURA) {
    const src = matchMedia("(max-width: 860px)").matches ? video.dataset.srcMovil : video.dataset.src;
    let cargado = false;
    const cargar = () => {
      if (cargado) return;
      cargado = true;
      video.src = src;
      video.addEventListener("playing", () => video.classList.add("listo"), { once: true });
      video.play().catch(() => {});
    };
    const empezar = () => setTimeout(cargar, 250);
    if (document.readyState === "complete") empezar(); else addEventListener("load", empezar, { once: true });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        if (!cargado) return;
        if (e.isIntersecting) video.play().catch(() => {}); else video.pause();
      }).observe(video);
    }
    document.addEventListener("visibilitychange", () => { if (cargado && document.hidden) video.pause(); else if (cargado) video.play().catch(() => {}); });
  }

  /* ---------- la carta: el azucarero de sobres (pestañas) ---------- */
  const tabs = qa(".sobrecito");
  if (tabs.length) {
    const panelDe = t => document.getElementById(t.getAttribute("aria-controls"));
    const listas = qa('.azucarero [role="tablist"]');

    function verter(panel) {
      if (reduce || CAPTURA || !panel.animate) return;
      const filas = qa(".carta__foto, .carta__titulo, .carta__desc, .carta__desde, .lista__cab, .plato", panel);
      filas.forEach((f, i) => f.animate(
        [{ opacity: 0, transform: "translateY(-7px)" }, { opacity: 1, transform: "none" }],
        { duration: 320, delay: Math.min(i * 18, 380), easing: EASE, fill: "backwards" }
      ));
    }

    function elegir(tab, { foco = false, animar = true, desplazar = true } = {}) {
      tabs.forEach(t => {
        const sel = t === tab;
        t.setAttribute("aria-selected", String(sel));
        panelDe(t).hidden = !sel;
      });
      // cada fila de sobres conserva una pestaña alcanzable con Tab
      listas.forEach(l => {
        const propias = qa(".sobrecito", l);
        const activa = propias.includes(tab) ? tab : propias[0];
        propias.forEach(t => { t.tabIndex = t === activa ? 0 : -1; });
      });
      if (foco) tab.focus();
      if (desplazar && matchMedia("(max-width: 760px)").matches) {
        // mueve solo la fila de sobres, nunca la página
        const fila = tab.parentElement;
        const destino = tab.offsetLeft - (fila.clientWidth - tab.offsetWidth) / 2;
        fila.scrollTo({ left: Math.max(0, destino), behavior: reduce ? "auto" : "smooth" });
      }
      if (animar) verter(panelDe(tab));
    }

    // el sobre elegido vierte un poco de azúcar sobre la carta
    function azucar(desde) {
      if (reduce || CAPTURA || !desde.animate) return;
      const r = desde.getBoundingClientRect();
      const capa = document.createElement("div");
      capa.className = "granos";
      capa.setAttribute("aria-hidden", "true");
      capa.style.left = `${r.left + scrollX + r.width / 2}px`;
      capa.style.top = `${r.bottom + scrollY - 6}px`;
      document.body.appendChild(capa);
      for (let n = 0; n < 34; n++) {
        const g = document.createElement("i");
        const lado = 2 + Math.random() * 3;
        g.style.width = g.style.height = `${lado}px`;
        if (n % 4 === 0) g.style.background = "var(--oro-claro)";
        capa.appendChild(g);
        const x0 = (Math.random() - 0.5) * 18, x1 = x0 + (Math.random() - 0.5) * 56;
        const y1 = 60 + Math.random() * 110;
        g.animate([
          { transform: `translate(${x0}px, 0) rotate(0deg)`, opacity: 1 },
          { transform: `translate(${x1}px, ${y1}px) rotate(${Math.round(Math.random() * 220)}deg)`, opacity: 0 },
        ], { duration: 620 + Math.random() * 420, delay: n * 12, easing: "cubic-bezier(.55, .06, .68, .19)", fill: "both" });
      }
      setTimeout(() => capa.remove(), 1600);
    }

    tabs.forEach(t => t.addEventListener("click", () => { const antes = t.getAttribute("aria-selected") === "true"; elegir(t); if (!antes) azucar(t); }));
    listas.forEach(l => l.addEventListener("keydown", e => {
      const propias = qa(".sobrecito", l);
      const i = propias.indexOf(document.activeElement);
      if (i < 0) return;
      let n = null;
      if (e.key === "ArrowRight") n = propias[(i + 1) % propias.length];
      if (e.key === "ArrowLeft") n = propias[(i - 1 + propias.length) % propias.length];
      if (e.key === "Home") n = propias[0];
      if (e.key === "End") n = propias[propias.length - 1];
      if (n) { e.preventDefault(); elegir(n, { foco: true }); }
    }));
    elegir(tabs[0], { animar: false, desplazar: false });
  }

  /* ---------- haz tu pareja ---------- */
  const fCafe = q("#calc-cafe"), fCrunch = q("#calc-crunch"), total = q("#calc-total");
  if (fCafe && fCrunch && total) {
    const sumar = () => {
      const t = Number(fCafe.value) + Number(fCrunch.value);
      total.value = t.toFixed(2).replace(".", ",") + " €";
      if (!reduce && total.animate) total.animate([{ opacity: .35, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: EASE });
    };
    fCafe.addEventListener("change", sumar);
    fCrunch.addEventListener("change", sumar);
  }

  /* ---------- opiniones: el sobre de arriba del montón se aparta y llega el siguiente ---------- */
  const citas = qa(".cita__item");
  const cita = q("[data-cita]");
  if (citas.length > 1 && cita) {
    let i = 0, ocupado = false;
    const ver = async (n, dir) => {
      if (ocupado) return;
      const antes = citas[i];
      i = (n + citas.length) % citas.length;
      if (reduce || CAPTURA || !cita.animate) { antes.hidden = true; citas[i].hidden = false; return; }
      ocupado = true;
      await cita.animate(
        [{ transform: "none", opacity: 1 }, { transform: `translateX(${dir * -42}px) rotate(${dir * -2.5}deg)`, opacity: 0 }],
        { duration: 200, easing: "cubic-bezier(.4, 0, 1, 1)", fill: "forwards" }
      ).finished;
      antes.hidden = true;
      citas[i].hidden = false;
      await cita.animate(
        [{ transform: `translateX(${dir * 36}px) rotate(${dir * 2}deg)`, opacity: 0 }, { transform: "none", opacity: 1 }],
        { duration: 380, easing: EASE, fill: "forwards" }
      ).finished;
      cita.getAnimations().forEach(a => a.cancel());
      ocupado = false;
    };
    q("[data-cita-prev]").addEventListener("click", () => ver(i - 1, -1));
    q("[data-cita-next]").addEventListener("click", () => ver(i + 1, 1));
  }

  /* ---------- inclinación del sobre de la portada y azucarillos que se mueven con el ratón ---------- */
  const objeto = q("[data-inclina]");
  const flotan = qa("[data-flota]");
  if (objeto && portada && !reduce && !CAPTURA && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const paso = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      objeto.style.transform = `perspective(1600px) rotateX(${(-cy * 3).toFixed(2)}deg) rotateY(${(cx * 4).toFixed(2)}deg)`;
      flotan.forEach(a => {
        const f = Number(a.dataset.flota);
        a.style.setProperty("--mx", `${(cx * 26 * f).toFixed(1)}px`);
        a.style.setProperty("--my", `${(cy * 18 * f).toFixed(1)}px`);
      });
      raf = Math.abs(tx - cx) > 0.0015 || Math.abs(ty - cy) > 0.0015 ? requestAnimationFrame(paso) : 0;
    };
    const pedir = () => { if (!raf) raf = requestAnimationFrame(paso); };
    portada.addEventListener("pointermove", e => {
      const r = portada.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      pedir();
    });
    portada.addEventListener("pointerleave", () => { tx = 0; ty = 0; pedir(); });
  }

  /* ---------- perro de la terraza: bucle que solo corre mientras se ve ---------- */
  const videoPerro = q(".mosaico__video");
  if (videoPerro && !reduce && !ahorro && !CAPTURA && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!videoPerro.src) {
          videoPerro.src = videoPerro.dataset.src;
          videoPerro.addEventListener("playing", () => videoPerro.classList.add("listo"), { once: true });
        }
        videoPerro.play().catch(() => {});
      } else if (videoPerro.src) {
        videoPerro.pause();
      }
    }, { rootMargin: "120px 0px" }).observe(videoPerro);
  }

  /* ---------- apariciones al hacer scroll ---------- */
  const animables = qa(".titular, .entradilla, .aparece, .aparece-foto, .toldo, .plano, .opiniones__estrellas");
  const cuentas = qa("[data-cuenta]");
  if ("IntersectionObserver" in window && !CAPTURA) {
    const io = new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add("visto");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    animables.forEach(el => io.observe(el));

    // fotos que respiran (zoom lento) solo mientras están en pantalla
    const ioVivo = new IntersectionObserver(entradas => entradas.forEach(e => e.target.classList.toggle("en-vista", e.isIntersecting)));
    qa(".vivo").forEach(el => ioVivo.observe(el));

    if (!reduce) cuentas.forEach(el => {
      const final = Number(el.dataset.cuenta);
      const entero = el.hasAttribute("data-entero");
      const texto = el.textContent;
      const ioCuenta = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        ioCuenta.disconnect();
        const t0 = performance.now(), dur = entero ? 1400 : 1100;
        const paso = t => {
          const p = Math.min(1, (t - t0) / dur);
          const v = final * (1 - Math.pow(1 - p, 3));
          el.textContent = p < 1 ? (entero ? String(Math.round(v)) : v.toFixed(1).replace(".", ",")) : texto;
          if (p < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      }, { threshold: 0.6 });
      ioCuenta.observe(el);
    });
  } else {
    animables.forEach(el => el.classList.add("visto"));
  }

  /* ---------- enlace activo de la cabecera ---------- */
  const enlacesNav = qa(".cabecera__nav a");
  const secciones = enlacesNav.map(a => q(a.getAttribute("href"))).filter(Boolean);
  if ("IntersectionObserver" in window && secciones.length) {
    const ioNav = new IntersectionObserver(entradas => {
      entradas.forEach(e => {
        const a = enlacesNav.find(x => x.getAttribute("href") === "#" + e.target.id);
        if (a) a.toggleAttribute("aria-current", e.isIntersecting);
        if (a && e.isIntersecting) a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    secciones.forEach(s => ioNav.observe(s));
  }
})();
