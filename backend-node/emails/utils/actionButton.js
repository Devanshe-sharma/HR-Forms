// Shared CTA button for the 3 Salary Revision emails that require an
// action — links straight to the signed mail-action form
// (frontend/src/pages/outsider/SalaryRevisionAction.tsx) so the
// manager/management can fill in their decision without logging into the
// dashboard at all.
function actionButton(link, label) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr>
        <td style="border-radius:8px; background:#1a3e72;">
          <a href="${link}" target="_blank" rel="noreferrer"
             style="display:inline-block; padding:12px 28px; font-family:Arial,sans-serif; font-size:14px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:8px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

module.exports = actionButton;
