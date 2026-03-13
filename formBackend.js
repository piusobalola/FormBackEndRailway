const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // support HTML form posts too
app.use(cors());

// ─── In-Memory Store ──────────────────────────────────────────────────────────
const submissions = [];

// ─── Nodemailer Transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── POST /formBackend — accepts ANY fields ───────────────────────────────────
app.post("/formBackend", async (req, res) => {
  const fields = req.body;

  // Reject empty submissions
  if (!fields || Object.keys(fields).length === 0) {
    return res.status(400).json({ success: false, error: "No form data received." });
  }

  try {
    // Save all fields to in-memory store
    const submission = { id: Date.now(), ...fields, createdAt: new Date() };
    submissions.push(submission);

    // Build email rows dynamically from whatever fields were sent
    const rows = Object.entries(fields)
      .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
      .join("");

    await transporter.sendMail({
      from: `"Form Bot" <${process.env.SMTP_USER}>`,
      to: process.env.NOTIFY_EMAIL || process.env.SMTP_USER,
      subject: "New Form Submission",
      html: `<h2>New Submission</h2>${rows}<p><em>Submitted at ${new Date().toLocaleString()}</em></p>`,
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

// ─── GET /formBackend — fetch all submissions ─────────────────────────────────
app.get("/formBackend", (req, res) => {
  res.json({ success: true, data: [...submissions].reverse() });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));