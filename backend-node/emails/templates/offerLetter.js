const signature = require("../utils/signature");
const formatDateIST = require("../utils/formatDateIST");
const REQUIRED_CANDIDATE_DOCUMENTS = require("../../utils/requiredCandidateDocuments");

function offerLetterTemplate({ full_name, joiningDate, uploadLink }) {
  const date = formatDateIST(joiningDate) || "Pending";

  const docItems = REQUIRED_CANDIDATE_DOCUMENTS
    .map((d, i) => `<li>${i + 1}) ${d.label}</li>`)
    .join("\n      ");

  const html = `
    <p>Congratulations ${full_name}...!!</p>
    <p>We take immense pleasure in extending this offer to you. Your Joining date will be effective from <b>${date}</b>.</p>
    <p>Your formal Offer Letter will be shared with you separately by HR. Please sign and send the scanned copy for our records.</p>

    <p>You are requested to upload the following documents on the day of your joining:</p>
    <p style="margin:20px 0;">
      <a target="_blank" href="${uploadLink}" style="display:inline-block; background:#4f46e5; color:#ffffff; padding:12px 28px; text-decoration:none; border-radius:8px; font-weight:bold;">
        Upload Your Documents
      </a>
    </p>

    <p><b>List of Documents Required:</b></p>
    <ul>
      ${docItems}
    </ul>

    <p>Please acknowledge receipt of this email.</p>
    ${signature()}
  `;
  return {
    subject: `Offer letter - ${full_name} | Brisk Olive`,
    html,
  };
}

module.exports = offerLetterTemplate;
