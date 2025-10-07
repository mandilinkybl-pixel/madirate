const express = require("express");
const router = express.Router();

// Hardcoded credentials
const USER_ID = "admin";
const PASSWORD = "admin123";

// ------------------ Authentication Middleware ------------------
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  return res.redirect("/login");
}

// ------------------ Login Page (GET) ------------------
router.get("/login", (req, res) => {
  if (req.session.loggedIn) return res.redirect("/"); // redirect if already logged in
  res.render("login", { error: null });
});

// ------------------ Login Form (POST) ------------------
router.post("/login", (req, res) => {
  const { userid, password } = req.body;

  if (userid === USER_ID && password === PASSWORD) {
    req.session.loggedIn = true;
    req.session.userid = userid;
    return res.redirect("/");
  } else {
    return res.render("login", { error: "Invalid credentials" });
  }
});

// ------------------ Logout ------------------
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Session destroy error:", err);
    res.redirect("/login");
  });
});

// ------------------ Protected Home Route ------------------
router.get("/", requireLogin, (req, res) => {
  res.render("dashboard", { user: req.session.userid });
});

module.exports = router;
