/**
 * MongoDB Atlas Scheduled Trigger - Daily Reset (00:00 IST)
 * ---------------------------------------------------------
 * This function runs at 00:00 IST every night (18:30 UTC) to reset
 * daily call metrics across all leads in the friskytrails database.
 *
 * HOW TO SET UP IN ATLAS:
 * 1. Go to: https://cloud.mongodb.com
 * 2. Select your Project and Cluster.
 * 3. Left sidebar -> "App Services" -> Select (or create) an App.
 * 4. App sidebar -> "Triggers" -> "Add Trigger".
 * 5. Set:
 *    - Trigger Type:   Scheduled
 *    - Name:           midnight-daily-reset-IST
 *    - Schedule Type:  Advanced
 *    - CRON Expression: 30 18 * * *   (= 00:00 IST = 18:30 UTC)
 *    - Link Data Source: your cluster (e.g. "Cluster0")
 * 6. Paste the exports function below into the Function editor.
 * 7. Save -> Deploy.
 *
 * CRON Expression Reference:
 *   Field:   Minute  Hour  DayOfMonth  Month  DayOfWeek
 *   Value:     30     18       *          *        *
 *   Meaning:  18:30 UTC every day = 00:00 IST next day
 */

exports = async function () {
  try {
    // Replace "Cluster0" with your linked data source name if different
    const collection = context.services
      .get("Cluster0")
      .db("friskytrails")
      .collection("leads");

    // Only update documents where daily counters are non-zero (efficient partial scan)
    const result = await collection.updateMany(
      {
        $or: [
          { "booking.dailyDial": { $gt: 0 } },
          { "booking.dailyTalkTime": { $nin: ["0:0", "0:00", "00:00", null, ""] } }
        ]
      },
      {
        $set: {
          "booking.dailyDial": 0,
          "booking.dailyTalkTime": "0:0"
        }
      }
    );

    console.log(
      `[Atlas Trigger] Midnight reset (00:00 IST) completed. ` +
      `Modified: ${result.modifiedCount} lead(s). ` +
      `Matched: ${result.matchedCount} lead(s).`
    );

    return { success: true, modifiedCount: result.modifiedCount };
  } catch (err) {
    console.error("[Atlas Trigger] Midnight reset FAILED:", err.message);
    throw err;
  }
};
