function reminderTemplate({ name, plannedJoiningDate }) {
  const date = plannedJoiningDate
    ? (() => {
        const d = new Date(plannedJoiningDate);
        return `${d.getDate()} ${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`;
      })()
    : "Pending";
 
  const html = `
    <p>Dear ${name},</p>
    <p>As planned, I will be waiting for your joining at <b>9 am on ${date}</b></p>
    <p>Please remember to complete the pre-joining actions - to ensure a smooth onboarding (the list is given in my earlier email).</p>
    <p>Again, please feel free to call me if you have any queries (My mobile No is given below).</p>
  `;
 
  return {
    subject: `Hi ${name}, Awaiting your Joining`,
    html,
  };
}
 
module.exports = reminderTemplate;