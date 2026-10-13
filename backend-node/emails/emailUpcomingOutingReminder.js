const sendEmail = require('../emails/sendEmail');
const Outing = require('../models/Outing');
const moment = require('moment-timezone');

// Temporary test-only override — see emailQuarterlyOutingApproval.js for
// the full explanation. Remove to restore normal recipients.
const OUTING_MAIL_OVERRIDE_TO = 'software.developer@briskolive.com';

function buildReminderHtml(outing, sentAtLabel) {
  const dateTimeStr = outing.tentativeDate
    ? moment(outing.tentativeDate).tz('Asia/Kolkata').format('dddd, MMMM Do YYYY [at] hh:mm A z')
    : 'TBD';

  const venue = outing.tentativePlace || 'Venue details will be shared soon';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333; line-height: 1.6;">
      <h2 style="color: #7a8b2e;">Upcoming Outing/Event Scheduled – ${outing.topic}</h2>

      <p>Dear Team,</p>
      <p>We are pleased to inform you that the following outing/event has been scheduled:</p>

      <ul style="list-style:none; padding-left:0;">
        <li><strong>Event Title:</strong> ${outing.topic}</li>
        <li><strong>Description:</strong> ${outing.description || 'No description available'}</li>
        <li><strong>Date & Time:</strong> ${dateTimeStr}</li>
        <li><strong>Venue:</strong> ${venue}</li>
      </ul>

      <p>This email serves as a two-week prior intimation to help you plan your availability.</p>
      <p>Further reminders and calendar blocks will follow closer to the event date.</p>

      <p>Regards,<br>
      <strong>HR Team</strong></p>

      <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
      <small style="color:#777; font-size:12px;">
        Outing ID: ${outing._id}<br>
        Sent on ${sentAtLabel}
      </small>
    </div>
  `;
}

// Pure builder for a single outing — used by the manual "preview & send" UI
// (routes/outing.js's /:id/mail/reminder/send).
async function buildUpcomingOutingReminderMail(outingId) {
  const outing = await Outing.findById(outingId).lean();
  if (!outing) throw new Error('Outing not found');

  const sentAtLabel = moment().tz('Asia/Kolkata').format('MMMM DD, YYYY [at] hh:mm A z');

  return {
    to: OUTING_MAIL_OVERRIDE_TO,
    cc: '',
    subject: `Upcoming Outing/Event Scheduled – ${outing.topic}`,
    body: buildReminderHtml(outing, sentAtLabel),
  };
}

/**
 * Automatic path — called from the (currently paused) daily reminder cron
 * job. Finds every Scheduled outing exactly 14 days out that hasn't had its
 * reminder sent yet, and sends one email per match.
 */
async function sendUpcomingOutingReminder() {
  try {
    const now = moment().tz('Asia/Kolkata').startOf('day');
    const targetDate = now.clone().add(14, 'days');

    const upcomingOutings = await Outing.find({
      status: 'Scheduled',
      tentativeDate: {
        $gte: targetDate.toDate(),
        $lt: targetDate.clone().add(1, 'day').toDate()
      },
      reminder2WeeksSent: false
    }).lean();

    if (upcomingOutings.length === 0) {
      console.log(`[${now.format('YYYY-MM-DD')}] No upcoming outings for 2-week reminder.`);
      return { success: true, sentCount: 0 };
    }

    let sentCount = 0;

    for (const outing of upcomingOutings) {
      const html = buildReminderHtml(outing, now.format('MMMM DD, YYYY [at] hh:mm A z'));

      const result = await sendEmail({
        to: OUTING_MAIL_OVERRIDE_TO,
        subject: `Upcoming Outing/Event Scheduled – ${outing.topic}`,
        html,
      });

      if (result.success) {
        await Outing.updateOne(
          { _id: outing._id },
          { $set: { reminder2WeeksSent: true } }
        );
        console.log(`2-week outing reminder sent & marked for: ${outing.topic} (ID: ${outing._id})`);
        sentCount++;
      } else {
        console.error(`Failed to send 2-week reminder for ${outing.topic}:`, result.error);
      }
    }

    return { success: true, sentCount };
  } catch (err) {
    console.error('2-week outing reminder error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendUpcomingOutingReminder, buildUpcomingOutingReminderMail };
