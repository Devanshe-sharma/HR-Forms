function welcomeYetToJoinTemplate({ name, dept, deptLink, designation, designationLink, plannedJoiningDate }) {
  const date = plannedJoiningDate
    ? (() => {
        const d = new Date(plannedJoiningDate);
        return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
      })()
    : "Pending";
 
  const html = `
    <p>Dear ${name},</p>
    <p>Welcome to the Brisk Olive Family! We eagerly await your arrival <b>at 9 am on ${date}</b></p>
    <p>Your Dept: ${dept || "-"}<br>Your Designation/Role: ${designation || "-"}</p>
    <p>Your official email id will be allotted once you join. Till then, I will email you on this id.</p>
    <p>Please take these actions - to help get settled at Brisk Olive:</p>
    <p>Note: Take all actions marked "Before Joining" must be completed before your joining date.</p>
 
    <p><b>Before Joining:</b></p>
    <ul>
      <li><b>At least 3 days before joining,</b> <a target="_blank" href="https://forms.gle/sL4HRaWAMfTjoKtf7">please fill this form.</a> (You will need to keep the following ready to fill the form):
        <ul>
          <li>Your BO T-Shirt Size: <a target="_blank" href="https://drive.google.com/file/d/1_Q7_FjnckMZHJnpEv3A1UXOfC_OQO00x/">See this to decide your T-Shirt size.</a></li>
          <li>Your Photo softcopy (For BO ERP).</li>
          <li>Your Next of Kin Details.</li>
          <li>Your Blood Group: (If not available, please get a blood test done).</li>
          <li>Your Documents: As per the <a target="_blank" href="https://docs.google.com/document/d/1QFvOLMUJ8Issd7ecHAJYoICQjOlcugZL/">Employee Checklist.</a> Please compile your Documents in a <a target="_blank" href="https://drive.google.com/file/d/1PqUnRojjIzE2r9orlgqb6IMigK4xJqYx/">punched file - see sample photo.</a> Include an envelope in the file, with your name on it, and 2 photos in an envelope. <b>(Bring this file with you on your joining day)</b>.</li>
        </ul>
      </li>
      <li>Read these, to prepare: (The MD and Top Management will all meet you &amp; discuss these within 7 days of your joining) - <b>(Some links on these pages will only be accessible to you after you join)</b>:
        <ul>
          <li><a target="_blank" href="https://docs.google.com/presentation/d/1r0MOiJxEpyj9ocw2HVTtaF2MvDyrN6b-_EIKKsDxZZY/edit?usp=sharing">Know how BO works.</a></li>
          <li><a target="_blank" href="${deptLink || "#"}">Know your Department.</a></li>
          <li><a target="_blank" href="${designationLink || "#"}">Know your Role.</a></li>
        </ul>
      </li>
    </ul>
 
    <p><b>After Joining:</b></p>
    <ul>
      <li>Day 1: I will be waiting at <b>9 am</b> to receive you. Your Schedule:
        <ul>
          <li>Submit Documents, fill your details in BOs ERP, create Logins &amp; get your Welcome Kit.</li>
          <li>Company, Department and Role briefings, and saying Hi to all employees.</li>
        </ul>
      </li>
      <li>Week 1:
        <ul>
          <li>Meet the MD and Top Management.</li>
          <li>Onboarding Test, followed by Coffee and Interview with MD.</li>
          <li>Start with your work.</li>
        </ul>
      </li>
    </ul>
  `;
 
  return {
    subject: `Welcome to Brisk Olive, ${name}`,
    html,
  };
}
 
module.exports = welcomeYetToJoinTemplate;