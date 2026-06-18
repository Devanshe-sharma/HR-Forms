function newCandidateApplicationTemplate(doc) {
  const html = `
    <p>Dear All,</p>
    <p>
      <span style="font-size:16px">A new candidate application has been submitted by: <b>${doc.full_name}</b></span><br>
      Email: <b>${doc.email}</b> Phone: <b>${doc.phone}</b><br>
      Location: <b>${doc.city || "-"}, ${doc.state || "-"}, ${doc.country || "-"}</b>
    </p>
    <ul>
      <li>Profile Applied For: <b>${doc.designation || "-"}</b></li>
      <li>Highest Qualification: <b>${doc.highest_qualification || "-"}</b></li>
      <li>Previous Experience: <b>${doc.experience || "-"}</b>${doc.experience === "Yes" ? ` (${doc.total_experience || "-"} yrs, current CTC: ${doc.current_ctc || "-"}, notice period: ${doc.notice_period || "-"} days)` : ""}</li>
      <li>Expected Annual CTC: <b>${doc.expected_monthly_ctc || "-"}</b></li>
      <li>Open to Relocate (Noida Sec 63): <b>${doc.relocation || "-"}</b></li>
      <li>Hindi (R/W/S): <b>${doc.hindi_read || "-"} / ${doc.hindi_write || "-"} / ${doc.hindi_speak || "-"}</b></li>
      <li>English (R/W/S): <b>${doc.english_read || "-"} / ${doc.english_write || "-"} / ${doc.english_speak || "-"}</b></li>
      ${doc.linkedin ? `<li>LinkedIn: <a href="${doc.linkedin}">${doc.linkedin}</a></li>` : ""}
      ${doc.facebookLink ? `<li>Facebook: <a href="${doc.facebookLink}">${doc.facebookLink}</a></li>` : ""}
      ${doc.short_video_url ? `<li>Resume Video: <a href="${doc.short_video_url}">${doc.short_video_url}</a></li>` : ""}
    </ul>
  `;

  return {
    subject: `New Candidate Application: ${doc.full_name} — ${doc.designation}`,
    html,
  };
}

module.exports = newCandidateApplicationTemplate;