const cron = require('node-cron');
const Confirmations = require('../models/Confirmations');

// ─── Daily scheduler: Re-evaluate extended probations ─────────────────────────
// Runs at 00:05 AM every day (5 minutes after midnight)
// Looks for records where stage='on_hold' and reviewDate <= today
// Updates them to stage='pending_manager' to reopen for manager review

function startExtensionScheduler() {
  // Schedule: Every day at 00:05 AM (timezone-aware)
  const task = cron.schedule('5 0 * * *', async () => {
    try {
      const currentTime = new Date();
      console.log(`[Extension Scheduler] ⏰ Running at ${currentTime.toISOString()}`);

      // Set to start of current day (00:00:00)
      const today = new Date(currentTime);
      today.setHours(0, 0, 0, 0);

      // Find all 'on_hold' records where reviewDate <= today
      const recordsToReopen = await Confirmations.find({
        stage: 'on_hold',
        reviewDate: { $lte: today },
      }).select('_id employeeName employeeCode reviewDate extendedTill stage');

      if (recordsToReopen.length === 0) {
        console.log('[Extension Scheduler] ✅ No records due for re-evaluation');
        return;
      }

      console.log(`[Extension Scheduler] 📋 Found ${recordsToReopen.length} records due for re-evaluation`);

      // Update each record: reopen for manager review
      const result = await Confirmations.updateMany(
        {
          stage: 'on_hold',
          reviewDate: { $lte: today },
        },
        {
          $set: {
            stage: 'pending_manager',                    // Reopen for manager review
            currentStatus: 'probation',                  // Reset to probation for fresh review
          },
          $push: {
            history: {
              status: 'probation',
              reason: `Auto-reopened for re-evaluation. Review date reached: ${today.toISOString().split('T')[0]}`,
              monthsExtended: null,
              changedBy: 'system',
              changedByName: 'System (Auto-Reopen)',
              date: new Date(),
            },
          },
        }
      );

      console.log(`[Extension Scheduler] ✅ Successfully reopened ${result.modifiedCount} records for re-evaluation`);

      // Log details of reopened records
      recordsToReopen.forEach(record => {
        const reviewStr = record.reviewDate ? record.reviewDate.toISOString().split('T')[0] : 'N/A';
        const tillStr = record.extendedTill ? record.extendedTill.toISOString().split('T')[0] : 'N/A';
        console.log(`  • ${record.employeeName} (${record.employeeCode}) - Review: ${reviewStr}, Till: ${tillStr}`);
      });
    } catch (error) {
      console.error('[Extension Scheduler] ❌ Error:', error.message);
      console.error('[Extension Scheduler] Stack:', error.stack);
    }
  });

  console.log('[Extension Scheduler] ✅ Initialized - will run daily at 00:05 AM');
  return task;
}

module.exports = { startExtensionScheduler };

