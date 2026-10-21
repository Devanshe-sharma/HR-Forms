// emails/templates/trainingApprovalRequest.js
// Rebuilt against TrainingTopic (trainingName/trainerName/
// proposedScheduleDate) — the old emailQuarterlyPlan.js referenced
// topic/description/trainer.name fields that don't exist on this model.
// Manual, HR-triggered from the Training Topic Management tab: summarises
// every currently "Pending Approval" topic into one request to Management.
function trainingApprovalRequestTemplate(topics) {
  const rows = topics.map((t, i) => `
    <tr>
      <td style="padding:10px; border:1px solid #ddd; text-align:center;">${i + 1}</td>
      <td style="padding:10px; border:1px solid #ddd;">${t.trainingName || '—'}</td>
      <td style="padding:10px; border:1px solid #ddd;">${t.capabilitySkill || '—'}</td>
      <td style="padding:10px; border:1px solid #ddd; text-align:center;">${t.trainerName || 'TBD'}</td>
      <td style="padding:10px; border:1px solid #ddd; text-align:center;">${t.proposedScheduleDate ? new Date(t.proposedScheduleDate).toLocaleDateString('en-IN') : 'TBD'}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
      <h2 style="color: #7a8b2e;">Training Plan – Approval Request</h2>
      <p>Dear Management Team,</p>
      <p>The HR team has prepared the following training topics for your review and approval.</p>

      <table style="width:100%; border-collapse:collapse; margin:20px 0; font-size:14px;">
        <thead>
          <tr style="background:#f4f6f2; color:#555;">
            <th style="padding:10px; border:1px solid #ddd;">S No.</th>
            <th style="padding:10px; border:1px solid #ddd;">Training Topic</th>
            <th style="padding:10px; border:1px solid #ddd;">Skill</th>
            <th style="padding:10px; border:1px solid #ddd;">Trainer (tentative)</th>
            <th style="padding:10px; border:1px solid #ddd;">Proposed Date</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p>We request your review and approval of the proposed trainings. Once approved, the sessions will be formally scheduled and communicated to all stakeholders.</p>
      <p>Warm regards,<br>HR Team<br>Brisk Olive Business Solutions Pvt. Ltd.</p>
    </div>
  `;

  return { subject: `Training Plan – Approval Request (${topics.length} topic${topics.length === 1 ? '' : 's'})`, html };
}

module.exports = trainingApprovalRequestTemplate;
