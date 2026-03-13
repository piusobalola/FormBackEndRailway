const express = require("express");
const cors = require("cors");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── In-Memory Store ──────────────────────────────────────────────────────────
const submissions = [];

// ─── POST /formBackend — accepts ANY fields ───────────────────────────────────
app.post("/formBackend", async (req, res) => {
  const fields = req.body;

  if (!fields || Object.keys(fields).length === 0) {
    return res.status(400).json({ success: false, error: "No form data received." });
  }

  try {
    // 1. Save to in-memory store
    const submission = { id: Date.now(), ...fields, createdAt: new Date() };
    submissions.push(submission);

    // 2. Build email rows dynamically from any submitted fields
    const rows = Object.entries(fields)
      .map(([key, value]) => `<p><strong>${key}:</strong> ${value}</p>`)
      .join("");

    // 3. Send email via Resend (HTTPS — works on Railway free tier)
    try {
      await resend.emails.send({
        from: "Form Bot <onboarding@resend.dev>", // use your own domain once verified
        to: process.env.NOTIFY_EMAIL,
        subject: "New Form Submission",
        html: `<h2>New Submission</h2>${rows}<p><em>Submitted at ${new Date().toLocaleString()}</em></p>`,
      });
    } catch (emailErr) {
      console.error("❌ Email error:", emailErr.message);
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
    console.error("❌ Submission error:", err.message);
    return res.status(500).json({ success: false, error: "Server error.", detail: err.message });
  }
});

// ─── GET /formBackend — fetch all submissions ─────────────────────────────────
app.get("/formBackend", (req, res) => {
  res.json({ success: true, data: [...submissions].reverse() });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));