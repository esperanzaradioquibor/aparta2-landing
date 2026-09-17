const nav = document.getElementById("nav");
const burger = document.getElementById("burger");
const navLinks = document.getElementById("navLinks");
const yearEl = document.getElementById("year");

yearEl.textContent = new Date().getFullYear();

window.addEventListener("scroll", () => {
  nav.classList.toggle("is-scrolled", window.scrollY > 24);
});

burger.addEventListener("click", () => {
  const open = navLinks.classList.toggle("is-open");
  burger.setAttribute("aria-expanded", String(open));
});

navLinks.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    burger.setAttribute("aria-expanded", "false");
  })
);

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        entry.target.style.transitionDelay = `${Math.min(i * 80, 320)}ms`;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.14, rootMargin: "0px 0px -60px 0px" }
);

document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

const form = document.getElementById("registroForm");
const note = document.getElementById("formNote");
const acepto = document.getElementById("acepto");
const aceptoError = document.getElementById("aceptoError");

const rules = {
  nombre: (v) => v.trim().length >= 3 || "Escribe tu nombre completo.",
  edad: (v) => (Number(v) >= 14 && Number(v) <= 30) || "Debes tener entre 14 y 30 años.",
  telefono: (v) => v.replace(/\D/g, "").length >= 7 || "Ingresa un teléfono válido.",
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Ingresa un correo válido.",
};

function validateField(input) {
  const rule = rules[input.name];
  if (!rule) return true;

  const result = rule(input.value);
  const wrapper = input.closest(".field");
  const errorEl = wrapper.querySelector(".error");

  if (result !== true) {
    wrapper.classList.add("invalid");
    errorEl.textContent = result;
    return false;
  }

  wrapper.classList.remove("invalid");
  errorEl.textContent = "";
  return true;
}

form.querySelectorAll("input, select").forEach((input) => {
  input.addEventListener("blur", () => validateField(input));
  input.addEventListener("input", () => {
    if (input.closest(".field")?.classList.contains("invalid")) validateField(input);
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const fields = [...form.querySelectorAll("input[name], select[name]")];
  const valid = fields.map(validateField).every(Boolean);

  if (!acepto.checked) {
    aceptoError.textContent = "Debes aceptar las normas del retiro.";
    aceptoError.style.display = "block";
  } else {
    aceptoError.textContent = "";
    aceptoError.style.display = "none";
  }

  if (!valid || !acepto.checked) {
    note.textContent = "Revisa los campos marcados en rojo.";
    note.classList.remove("ok");
    form.querySelector(".invalid input, .invalid select")?.focus();
    return;
  }

  const nombre = form.nombre.value.trim().split(" ")[0];
  note.textContent = `¡Listo, ${nombre}! Tu registro fue enviado. Pronto te contactaremos con los detalles.`;
  note.classList.add("ok");
  form.reset();
});
