function instructionsToAllAlreadyJoinedTemplate({ name, email, mobile, dept, deptLink, designation, designationLink, joinedDate }) {
  const date = joinedDate
    ? (() => {
        const d = new Date(joinedDate);
        return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
      })()
    : "Pending";
 
  const html = `
    <p>Dear All,</p>
    <p>${name} joined Brisk Olive <b> on ${date}</b></p>
    <p>Please complete these joining actions - to ensure smooth onboarding for the new joinee:</p>
    <ul>
      <li>HR: Please prepare:
        <ul><li>Company Onboarding Presentation.</li></ul>
      </li>
      <li>Department: Please prepare:
        <ul>
          <li>Department Onboarding Presentation.</li>
          <li>Role Briefing.</li>
        </ul>
      </li>
      <li>DME: Please keep these ready:
        <ul>
          <li>Creation of Passwords.</li>
          <li>Adding Checklist tasks (in coordination with the Dept).</li>
        </ul>
      </li>
      <li>Admin: Please keep these ready:
        <ul>
          <li>BO T-Shirt Size - (The Joinee will email you. If not, please check <a target="_blank" href="https://docs.google.com/spreadsheets/d/1C_hMicFGaw9wyKe-EMLorXY7eZX9XmlJ_UrXpmnSUQ0/">this sheet</a>, or call the Joinee)</li>
          <li>Welcome Kit.</li>
          <li>Provide Laptop.</li>
          <li>Prepare seating.</li>
        </ul>
      </li>
    </ul>
    <p>Please feel free to call me for any clarifications.</p>
  `;
 
  return {
    subject: `Hi All, Preparation for New Joinee: ${name} joined on ${date} ( ${email || ""} ${mobile || ""} )`,
    html,
  };
}
 
module.exports = instructionsToAllAlreadyJoinedTemplate;