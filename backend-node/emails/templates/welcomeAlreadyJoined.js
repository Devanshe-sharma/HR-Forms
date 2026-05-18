function welcomeAlreadyJoinedTemplate({ name, dept, deptLink, designation, designationLink }) {
  const html = `
    <p>Dear ${name},</p>
    <p>Welcome to the Brisk Olive Family!</p>
    <p>Your Dept: ${dept || "-"}<br>Your Designation/Role: ${designation || "-"}</p>
    <p>Please ensure on the day of your onboarding that you complete the following actions at Brisk Olive:</p>
    <p>Note: All actions are to be completed on the onboarding day.</p>
 
    <p><b>On Joining:</b></p>
    <ul>
      <li><a target="_blank" href="https://forms.gle/uGWWTWsyjxKrAyLr5">Please fill this form.</a> (You will need to keep the following ready to fill the form):
        <ul>
          <li>Your BO T-Shirt Size: <a target="_blank" href="https://drive.google.com/file/d/1_Q7_FjnckMZHJnpEv3A1UXOfC_OQO00x/">See this to decide your T-Shirt size.</a></li>
          <li>Your Photo softcopy (For BO ERP).</li>
          <li>Your Next of Kin Details.</li>
          <li>Your Blood Group: (If not available, please get a blood test done).</li>
          <li>Your Documents: As per the <a target="_blank" href="https://docs.google.com/document/d/1QFvOLMUJ8Issd7ecHAJYoICQjOlcugZL/">Employee Checklist.</a> Please compile your Documents in a <a target="_blank" href="https://drive.google.com/file/d/1PqUnRojjIzE2r9orlgqb6IMigK4xJqYx/">punched file - see sample photo.</a> Include an envelope in the file, with your name on it, and 2 photos in an envelope. <b>(Hand this file over to the HR Dept, i.e., me.)</b>.</li>
        </ul>
      </li>
      <li>Read these, to prepare: (the MD and Top Management will all meet you &amp; discuss these within 7 days of your joining):
        <ul>
          <li><a target="_blank" href="https://docs.google.com/presentation/d/1r0MOiJxEpyj9ocw2HVTtaF2MvDyrN6b-_EIKKsDxZZY/edit?usp=sharing">Know how BO works.</a></li>
          <li><a target="_blank" href="${deptLink || "#"}">Know your Department.</a></li>
          <li><a target="_blank" href="${designationLink || "#"}">Know your Role.</a></li>
        </ul>
      </li>
    </ul>
 
    <p><b>I also hope all these actions have been done. If not, please contact me:</b></p>
    <ul>
      <li>Day 1:
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
 
module.exports = welcomeAlreadyJoinedTemplate;