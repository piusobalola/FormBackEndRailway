const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ─── In-Memory Store ──────────────────────────────────────────────────────────
const submissions = [];

// ─── Nodemailer Transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── POST /formBackend — accepts ANY fields ───────────────────────────────────
app.post("/formBackend", async (req, res) => {
  const fields = req.body;

  if (!fields || Object.keys(fields).length === 0) {
    return res.status(400).json({ success: false, error: "No form data received." });
  }

  try {
    // 1. Save to in-memory store (always succeeds)
    const submission = { id: Date.now(), ...fields, createdAt: new Date() };
    submissions.push(submission);

    // 2. Build email rows dynamically
    const rows = Object.entries(fields)
      .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
      .join("");

    // 3. Send email — log exact error if it fails
    try {
      await transporter.sendMail({
        from: `"Form Bot" <${process.env.SMTP_USER}>`,
        to: process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
        subject: "New Form Submission",
        html: `<h2>New Submission</h2>${rows}<p><em>Submitted at ${new Date().toLocaleString()}</em></p>`,
      });
    } catch (emailErr) {
      // Submission is saved — return success but warn about email
      console.error("❌ Email error:", emailErr.message, emailErr.response || "");
      return res.status(201).json({
        success: true,
        message: "Form saved but email notification failed.",
        emailError: emailErr.message,
        data: { id: submission.id },
      });
    }

    return res.status(201).json({
      success: true,
      message: "Form submitted successfully.",
      data: { id: submission.id },
    });

  } catch (err) {
    console.error("❌ Submission error:", err.message, err.stack);
    return res.status(500).json({
      success: false,
      error: "Server error.",
      detail: err.message, // visible in response for easier debugging
    });
  }
});

// ─── GET /formBackend — fetch all submissions ─────────────────────────────────
app.get("/formBackend", (req, res) => {
  res.json({ success: true, data: [...submissions].reverse() });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));