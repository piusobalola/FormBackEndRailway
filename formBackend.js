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

// ─── Email Template ───────────────────────────────────────────────────────────
function buildEmailHTML(fields) {
  const rows = Object.entries(fields)
    .map(
      ([key, value]) => `
      <tr>
        <td style="padding:10px 16px;background:#f9fafb;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:35%;text-transform:capitalize;">
          ${key.replace(/([A-Z])/g, " $1").trim()}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;color:#111827;word-break:break-word;">
          ${value || "<em style='color:#9ca3af'>—</em>"}
        </td>
      </tr>`
    )
    .join("");

  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

            <!-- Header -->
            <tr>
              <td style="background:#111827;padding:24px 32px;">
                <h1 style="margin:0;color:#ffffff;font-size:20px;">📬 New Form Submission</h1>
                <p style="margin:4px 0 0;color:#9ca3af;font-size:13px;">
                  Received on ${new Date().toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}
                </p>
              </td>
            </tr>

            <!-- Fields Table -->
            <tr>
              <td style="padding:24px 32px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;font-size:14px;">
                  ${rows}
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                  This email was sent automatically by your form backend.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

function buildSubject(fields) {
  // Use "name" or "fullName" field if present, otherwise fallback
  const name = fields.name || fields.fullName || fields.username || null;
  return name
    ? `New Submission from ${name}`
    : `New Form Submission — ${new Date().toLocaleDateString()}`;
}

// ─── POST /formBackend — accepts ANY fields ───────────────────────────────────
app.post("/formBackend", async (req, res) => {
  const fields = req.body;

  if (!fields || Object.keys(fields).length === 0) {
    return res.status(400).json({ success: false, error: "No form data received." });
  }

  try {
    const submission = { id: Date.now(), ...fields, createdAt: new Date() };
    submissions.push(submission);

    try {
      await resend.emails.send({
        from: "Form Bot <onboarding@resend.dev>",
        to: process.env.NOTIFY_EMAIL,
        subject: buildSubject(fields),
        html: buildEmailHTML(fields),
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