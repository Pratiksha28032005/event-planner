const tabButtons = document.querySelectorAll(".tab-button");
const registerTabButtons = document.querySelectorAll(".register-tab-button");
const modeButtons = document.querySelectorAll(".mode-button");
const authPanels = document.querySelectorAll(".auth-panel");
const loginForms = document.querySelectorAll(".login-form");
const registerForms = document.querySelectorAll(".register-form");
const statusMessage = document.getElementById("status-message");
const userRegisterForm = document.getElementById("user-register-form");
const workerRegisterForm = document.getElementById("worker-register-form");
const userRegisterStatus = document.getElementById("user-register-status");
const workerRegisterStatus = document.getElementById("worker-register-status");
const passwordToggles = document.querySelectorAll(".password-toggle");
const THEME_STORAGE_KEY = "event-planner-theme";
const LEGACY_THEME_STORAGE_KEY = "theme";
let themeButtons = document.querySelectorAll(".theme-button");
const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  || localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
  || "dark";

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

function ensureThemeSwitch() {
  let themeSwitch = document.querySelector(".theme-switch");

  if (!themeSwitch) {
    themeSwitch = document.createElement("div");
    themeSwitch.className = "theme-switch floating-theme-switch";
    themeSwitch.setAttribute("aria-label", "Theme switcher");
    themeSwitch.innerHTML = `
      <button class="theme-button" type="button" data-theme="dark" aria-pressed="false">Dark</button>
      <button class="theme-button" type="button" data-theme="light" aria-pressed="false">Light</button>
    `;
    document.body.appendChild(themeSwitch);
  } else {
    themeSwitch.classList.add("floating-theme-switch");
  }

  themeButtons = document.querySelectorAll(".theme-button");
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;

  themeButtons.forEach((button) => {
    const isActive = button.dataset.theme === theme;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function clearMessage(element) {
  if (!element) {
    return;
  }

  element.textContent = "";
  element.classList.remove("error");
}

function showMessage(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle("error", isError);
}

function bindThemeButtons() {
  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.dataset.theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(LEGACY_THEME_STORAGE_KEY, theme);
      applyTheme(theme);
    });
  });
}

function activatePanel(mode) {
  modeButtons.forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  authPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${mode}-panel`);
  });

  clearMessage(statusMessage);
  clearMessage(userRegisterStatus);
  clearMessage(workerRegisterStatus);
}

function activateLoginTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  loginForms.forEach((form) => {
    form.classList.toggle("active", form.id === `${tabName}-form`);
  });

  clearMessage(statusMessage);
}

function activateRegisterTab(tabName) {
  registerTabButtons.forEach((button) => {
    const isActive = button.dataset.registerTab === tabName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  registerForms.forEach((form) => {
    form.classList.toggle("active", form.id === `${tabName}-register-form`);
  });

  clearMessage(userRegisterStatus);
  clearMessage(workerRegisterStatus);
}

function setSubmitState(button, activeText, idleText, isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? activeText : idleText;
}

function resetInitialScroll() {
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
  });
}

ensureThemeSwitch();
applyTheme(storedTheme);
bindThemeButtons();
activatePanel("login");
activateLoginTab("manager");
activateRegisterTab("user");
resetInitialScroll();

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activatePanel(button.dataset.mode);
  });
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateLoginTab(button.dataset.tab);
  });
});

registerTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateRegisterTab(button.dataset.registerTab);
  });
});

passwordToggles.forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.target);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Show" : "Hide";
  });
});

loginForms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const submitButton = form.querySelector(".submit-button");
    const role = form.dataset.role.toLowerCase();
    const formData = new FormData(form);
    const payload = {
      role,
      email: formData.get("email"),
      password: formData.get("password"),
      code: formData.get("code") || "",
      eventId: formData.get("eventId") || ""
    };

    const labelMap = {
      manager: "Login as Manager",
      user: "Login as User",
      worker: "Login as Worker"
    };

    setSubmitState(submitButton, "Signing in...", labelMap[role], true);
    clearMessage(statusMessage);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Unable to sign in.");
      }

      localStorage.setItem("event-planner-session", JSON.stringify(result));

      if (result.user.role === "manager") {
        window.location.href = "/manager-dashboard.html";
      } else if (result.user.role === "worker") {
        window.location.href = "/worker-dashboard.html";
      } else {
        window.location.href = "/user-dashboard.html";
      }
    } catch (error) {
      showMessage(statusMessage, error.message, true);
    } finally {
      setSubmitState(submitButton, "Signing in...", labelMap[role], false);
    }
  });
});

userRegisterForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!userRegisterForm.reportValidity()) {
    return;
  }

  const submitButton = userRegisterForm.querySelector(".submit-button");
  const formData = new FormData(userRegisterForm);
  const payload = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password")
  };

  setSubmitState(submitButton, "Creating account...", "Create User Account", true);
  clearMessage(userRegisterStatus);

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to create account.");
    }

    userRegisterForm.reset();
    showMessage(userRegisterStatus, "User account created. A manager can now assign events to this user.");
  } catch (error) {
    showMessage(userRegisterStatus, error.message, true);
  } finally {
    setSubmitState(submitButton, "Creating account...", "Create User Account", false);
  }
});

workerRegisterForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!workerRegisterForm.reportValidity()) {
    return;
  }

  const submitButton = workerRegisterForm.querySelector(".submit-button");
  const formData = new FormData(workerRegisterForm);
  const payload = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role")
  };

  setSubmitState(submitButton, "Submitting request...", "Submit Worker Request", true);
  clearMessage(workerRegisterStatus);

  try {
    const response = await fetch("/api/workers/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to register worker.");
    }

    workerRegisterForm.reset();
    showMessage(workerRegisterStatus, "Worker registration submitted. Waiting for manager approval.");
  } catch (error) {
    showMessage(workerRegisterStatus, error.message, true);
  } finally {
    setSubmitState(submitButton, "Submitting request...", "Submit Worker Request", false);
  }
});
