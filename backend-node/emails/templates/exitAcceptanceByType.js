const signature = require("../utils/signature");

// Content for the "acceptance" email to the employee, keyed by exitType —
// unlike exitAcceptanceTemplate.js / exitAcceptanceAlreadyTemplate.js
// (which only vary by exitStatus: Serving Notice Period vs Already
// Left/Left), these 7 vary by WHY the person is exiting instead, and
// don't care about exitStatus at all.
//
// `addressedToTeam: true` (Demise only) means the body is written "Dear
// Team" about the employee, not to them — the sender routes this to
// HR/internal instead of the employee's own inbox.
const EXIT_ACCEPTANCE_BY_TYPE = {
  "Resignation": (doc) => ({
    subject: `Exit from Brisk Olive – ${doc.name}`,
    html: `
      <p>Dear ${doc.name},</p>
      <p>We acknowledge and accept your resignation from Brisk Olive Business Solutions Pvt. Ltd.</p>
      <p>As part of the exit process, please ensure the following are completed:</p>
      <ul>
        <li>Complete knowledge transfer of your responsibilities to your manager.</li>
        <li>Hand over all Company assets to the Admin in good condition.</li>
        <li>Complete and sign the Exit Clearance Form and No Dues Declaration.</li>
        <li>Ensure all department clearances are completed.</li>
      </ul>
      <p>Your Full &amp; Final Settlement will be processed as per the applicable Company policies.</p>
      <p>Your Experience Certificate will be issued upon completion of the required exit formalities.</p>
      <p>We thank you for your contributions to Brisk Olive and wish you all the best for your future endeavors.</p>
      ${signature()}
    `,
  }),

  "Completion of Tenure": (doc) => ({
    subject: `Completion of Tenure – ${doc.name}`,
    html: `
      <p>Dear ${doc.name},</p>
      <p>This is to inform you that your tenure with Brisk Olive Business Solutions Pvt. Ltd. is being concluded as per the terms of your engagement with us.</p>
      <p>Please ensure the following exit formalities are completed:</p>
      <ul>
        <li>Complete knowledge transfer of your responsibilities.</li>
        <li>Hand over all Company assets to the Admin in good condition.</li>
        <li>Complete and sign the Exit Form and No Dues Declaration.</li>
        <li>Ensure all department clearances are completed.</li>
      </ul>
      <p>Your Full &amp; Final Settlement will be processed as per the applicable Company policies.</p>
      <p>Your Experience Certificate will be issued upon completion of the required formalities.</p>
      <p>We appreciate your contribution during your tenure with Brisk Olive and wish you success in your future endeavors.</p>
      ${signature()}
    `,
  }),

  "Retirement": (doc) => ({
    subject: `Retirement from Brisk Olive – ${doc.name}`,
    html: `
      <p>Dear ${doc.name},</p>
      <p>As you retire from your services with Brisk Olive Business Solutions Pvt. Ltd., we would like to thank you for your valuable contribution and commitment to the organization.</p>
      <p>As part of the retirement formalities, please ensure:</p>
      <ul>
        <li>Completion of knowledge transfer, wherever applicable.</li>
        <li>Handover of all Company assets to the Admin in good condition.</li>
        <li>Completion and signing of the Exit Clearance Form and No Dues Declaration.</li>
        <li>Completion of all department clearances.</li>
        <li>Processing of your Full &amp; Final Settlement as per applicable Company policies.</li>
        <li>Issuance of applicable service documents and Experience Certificate upon completion of exit formalities.</li>
      </ul>
      <p>We sincerely appreciate your contribution to Brisk Olive and wish you a fulfilling and happy retirement.</p>
      ${signature()}
    `,
  }),

  "Demise": (doc) => ({
    addressedToTeam: true,
    subject: `Condolences – ${doc.name}`,
    html: `
      <p>Dear Team,</p>
      <p>It is with deep regret that we were informed about the unfortunate demise of ${doc.name}, who was associated with Brisk Olive Business Solutions Pvt. Ltd. as ${doc.designation || "-"}.</p>
      <p>We extend our deepest condolences to the family and loved ones during this difficult time.</p>
      <p>HR and the concerned departments will coordinate the necessary formalities, including:</p>
      <ul>
        <li>Settlement of pending dues and applicable benefits.</li>
        <li>Completion of required documentation.</li>
        <li>Return/recovery of Company assets, wherever applicable.</li>
        <li>Coordination with the family/nominee for necessary documentation and dues settlement.</li>
      </ul>
      <p>We request everyone to respect the privacy of the family and extend their support and understanding during this difficult period.</p>
      <p>With deepest condolences,<br>HR Department<br>Brisk Olive Business Solutions Pvt. Ltd.</p>
    `,
  }),

  "Termination": (doc, dateStr) => ({
    subject: `Separation from Brisk Olive – ${doc.name}`,
    html: `
      <p>Dear ${doc.name},</p>
      <p>This is to formally communicate that your employment with Brisk Olive Business Solutions Pvt. Ltd. will cease effective ${dateStr}, in accordance with the applicable terms of your employment and Company policy.</p>
      <p>You are required to complete the following exit formalities:</p>
      <ul>
        <li>Complete the required handover of your responsibilities.</li>
        <li>Return all Company assets to the Admin in good condition.</li>
        <li>Complete and sign the Exit Clearance Form and No Dues Declaration.</li>
        <li>Complete all applicable department clearances.</li>
      </ul>
      <p>Your Full &amp; Final Settlement will be processed as per applicable Company policies.</p>
      <p>Applicable separation/service documents will be issued upon completion of the required formalities.</p>
      <p>Please coordinate with the HR Department for completion of the exit process.</p>
      ${signature()}
    `,
  }),

  "Asked to Leave": (doc, dateStr) => ({
    subject: `Separation from Brisk Olive – ${doc.name}`,
    html: `
      <p>Dear ${doc.name},</p>
      <p>This is to formally communicate that Brisk Olive Business Solutions Pvt. Ltd. has decided to conclude your employment with the Company, effective ${dateStr}.</p>
      <p>Please ensure the following exit formalities are completed:</p>
      <ul>
        <li>Complete the required handover of your responsibilities.</li>
        <li>Return all Company assets to the Admin in good working condition.</li>
        <li>Complete and sign the Exit Clearance Form and No Dues Declaration.</li>
        <li>Complete the required department clearances.</li>
      </ul>
      <p>Your Full &amp; Final Settlement will be processed as per applicable Company policies.</p>
      <p>Applicable separation/service documents will be issued upon completion of the required formalities.</p>
      <p>Please coordinate with the HR Department to complete the exit formalities.</p>
      <p>We thank you for your association with Brisk Olive and wish you well for your future endeavors.</p>
      ${signature()}
    `,
  }),

  "Absconded": (doc, dateStr) => ({
    subject: `Employment Separation – ${doc.name}`,
    html: `
      <p>Dear ${doc.name},</p>
      <p>Our records indicate that you have been absent from work without authorization and have not reported to duty or responded to communication from the Company since ${dateStr}.</p>
      <p>We have not received the required communication or confirmation regarding your absence.</p>
      <p>You are required to:</p>
      <ul>
        <li>Contact the HR Department immediately regarding your employment status.</li>
        <li>Complete the required handover of Company responsibilities, wherever applicable.</li>
        <li>Return all Company assets in your possession.</li>
        <li>Complete the applicable exit and No Dues formalities.</li>
        <li>Clear any pending department requirements.</li>
      </ul>
      <p>In the absence of a response within the applicable period, the Company may proceed with further action in accordance with the terms of your employment and applicable Company policy.</p>
      <p>Please treat this communication as important and contact HR at the earliest.</p>
      ${signature()}
    `,
  }),
};

// Returns { subject, html, addressedToTeam? } for a recognized exitType,
// or null if doc.exitType isn't one of the 7 above (blank, legacy
// free-text, or anything not yet mapped) — the caller falls back to the
// original exitStatus-only acceptance emails in that case.
function buildExitAcceptanceByType(doc, dateStr) {
  const builder = EXIT_ACCEPTANCE_BY_TYPE[doc.exitType];
  if (!builder) return null;
  return builder(doc, dateStr);
}

module.exports = buildExitAcceptanceByType;
