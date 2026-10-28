
const authForm = document.getElementById("authForm");
const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");
const nameField = document.getElementById("nameField");
const nameInput = document.getElementById("name");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const submitBtn = document.getElementById("submitBtn");
const authMessage = document.getElementById("authMessage");
const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");

let mode = "login";

function setMessage(message, success = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("success", success);
}

function setMode(nextMode) {
  mode = nextMode;
  const signup = mode === "signup";

  loginTab.classList.toggle("active", !signup);
  signupTab.classList.toggle("active", signup);
  nameField.hidden = !signup;
  nameInput.required = signup;

  passwordInput.autocomplete = signup ? "new-password" : "current-password";
  formTitle.textContent = signup ? "Create your account" : "Welcome back";
  formSubtitle.textContent = signup
    ? "Start your journey towards smarter water usage."
    : "Sign in to see your water insights.";
  submitBtn.innerHTML = signup
    ? 'Create account <span>→</span>'
    : 'Sign in <span>→</span>';

  setMessage("");
}

loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));

togglePassword.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  togglePassword.textContent = isPassword ? "Hide" : "Show";
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("");

  const email = document.getElementById("email").value.trim();
  const password = passwordInput.value;

  if (mode === "signup" && password.length < 8) {
    setMessage("Use a password with at least 8 characters.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Please wait...";

  try {
    const endpoint = mode === "signup"
      ? "/api/auth/signup"
      : "/api/auth/login";

    const body = { email, password };

    if (mode === "signup") {
      body.name = nameInput.value.trim();
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong.");
    }

    setMessage(data.message + " Redirecting...", true);
    window.location.replace("/dashboard.html");
  } catch (error) {
    setMessage(error.message || "Unable to connect to the server.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = mode === "signup"
      ? 'Create account <span>→</span>'
      : 'Sign in <span>→</span>';
  }
});

// If the user is already signed in, go to the dashboard.
fetch("/api/auth/me", { credentials: "same-origin" })
  .then((response) => {
    if (response.ok) window.location.replace("/dashboard.html");
  })
  .catch(() => {});
