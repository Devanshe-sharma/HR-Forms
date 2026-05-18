function employeeFeedbackTemplate({ name, email, mobile }) {
  const html = `
    <p>Dear ${name},</p>
    <p>Congratulations!</p>
    <p>All your Onboarding actions are now complete, except Coffee with Directors, and I hope you are now settled into your new position work-wise and administratively.</p>
    <p>We would love to hear about your onboarding experience. Please <a target="_blank" href="https://forms.gle/kEZftzvNQehcuLwN8">fill this form to let us know the same.</a></p>
  `;
 
  return {
    subject: `Dear ${name}, Please share your Onboarding experience ( ${email || ""} , ${mobile || ""} )`,
    html,
  };
}
 
module.exports = employeeFeedbackTemplate;