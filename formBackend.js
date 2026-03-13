const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

// ─── In-Memory Store ──────────────────────────────────────────────────────────
const submissions = [];

// ─── Nodemailer Transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Validation Helper ────────────────────────────────────────────────────────
function validateFormData({ name, email, message }) {
  const errors = [];

  if (!name || name.trim().length < 2)
    errors.push("Name must be at least 2 characters.");

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email))
    errors.push("A valid email address is required.");

  if (!message || message.trim().length < 10)
    errors.push("Message must be at least 10 characters.");

  return errors;
}

// ─── POST /formBackend ────────────────────────────────────────────────────────
app.post("/formBackend", async (req, res) => {
  const { name, email, message } = req.body;

  // 1. Validate
  const errors = validateFormData({ name, email, message });
  if (errors.length > 0) {
    return res.status(400).json({ success: false, errors });
  }

  try {
    // 2. Save to in-memory store
    const submission = { id: Date.now(), name, email, message, createdAt: new Date() };
    submissions.push(submission);

    // 3. Send email notification
    await transporter.sendMail({
      from: `"Form Bot" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
      subject: `New Form Submission from ${name}`,
      html: `
        <h2>New Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong> ${message}</p>
        <p><em>Submitted at ${new Date().toLocaleString()}</em></p>
      `,
    });

    return res.status(201).json({
      success: true,
      message: "Form submitted successfully.",
      data: { id: submission.id },
    });
  } catch (err) {
    console.error("Submission error:", err);
    return res.status(500).json({ success: false, error: "Server error. Please try again." });
  }
});

// ─── GET /formBackend (fetch all submissions) ─────────────────────────────────
app.get("/formBackend", (req, res) => {
  res.json({ success: true, data: [...submissions].reverse() });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
