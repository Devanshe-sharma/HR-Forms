const transporter = require("../mailer");
const Onboarding  = require("../../models/onboardingmodel");

async function triggerWeeklyHREmail() {
  try {
    const openDocs = await Onboarding.find({ fmsStatus: "Open" }).sort({ fmsScore: 1 });

    // 18. No open FMSs
    if (openDocs.length === 0) {
      await transporter.sendMail({
        from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
        to:      process.env.HR_EMAIL,
        subject: "✅ Weekly HR Tasks Summary — No Open FMSs",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;
                      padding:24px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
            <h2 style="color:#15803d;margin:0 0 8px;">All Clear! 🎉</h2>
            <p style="color:#166534;margin:0;">No open HR tasks this week.</p>
          </div>
        `,
      });
      return;
    }

    // 19. Weekly HR tasks summary — sorted worst score first
    let rowsHtml = "";
    for (const doc of openDocs) {
      const overdueItems = doc.checkLists
        .flatMap((l) => l.itemsList)
        .filter((it) => it.status === "OVERDUE")
        .map((it) => it.name)
        .filter(Boolean);

      rowsHtml += `
        <tr>
          <td style="border:1px solid #e2e8f0;padding:8px 10px;">${doc.name}</td>
          <td style="border:1px solid #e2e8f0;padding:8px 10px;">${doc.dept || "—"}</td>
          <td align="center" style="border:1px solid #e2e8f0;padding:8px 10px;
              color:${(doc.fmsScore ?? 0) < 0 ? "#dc2626" : "#15803d"};font-weight:700;">
            ${doc.fmsScore ?? 0}
          </td>
          <td align="center" style="border:1px solid #e2e8f0;padding:8px 10px;color:#dc2626;font-weight:600;">
            ${doc.tasksOverdue ?? 0}
          </td>
          <td style="border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;color:#dc2626;">
            ${overdueItems.slice(0, 3).join(", ") || "—"}
            ${overdueItems.length > 3 ? ` +${overdueItems.length - 3} more` : ""}
          </td>
        </tr>
      `;
    }

    await transporter.sendMail({
      from:    `"Brisk Olive HR" <${process.env.GMAIL_USER}>`,
      to:      process.env.HR_EMAIL,
      subject: `🔴 Weekly HR Tasks Summary — ${openDocs.length} Open FMS(s)`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;">
          <div style="background:#dc2626;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h2 style="color:#fff;margin:0;">Weekly HR Tasks Summary</h2>
            <p style="color:#fecaca;margin:4px 0 0;font-size:13px;">
              Action required — ${openDocs.length} open FMS(s) as of
              ${new Date().toLocaleDateString("en-IN")}
            </p>
          </div>
          <div style="background:#fff;border:1px solid #e2e8f0;
                      border-top:none;padding:24px;border-radius:0 0 8px 8px;">
            <table width="100%" cellpadding="6" cellspacing="0"
                   style="border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th align="left"   style="border:1px solid #e2e8f0;padding:8px 10px;">Name</th>
                  <th align="left"   style="border:1px solid #e2e8f0;padding:8px 10px;">Dept</th>
                  <th align="center" style="border:1px solid #e2e8f0;padding:8px 10px;">Score</th>
                  <th align="center" style="border:1px solid #e2e8f0;padding:8px 10px;">Overdue</th>
                  <th align="left"   style="border:1px solid #e2e8f0;padding:8px 10px;">Overdue Tasks</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      `,
    });

  } catch (err) {
    console.error("[triggerWeeklyHREmail] Email error:", err.message);
  }
}

module.exports = triggerWeeklyHREmail;