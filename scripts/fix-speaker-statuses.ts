import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq, and } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Migration script to fix speaker submission statuses
 * Run this once to update all existing speakers' statuses based on their submissions
 */
async function fixSpeakerStatuses() {
  console.log('🔧 Starting speaker status migration...\n');

  // Create database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  try {
    // Get all speakers
    const speakers = await db.select().from(schema.speakers);
    console.log(`📊 Found ${speakers.length} speakers to process\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const speaker of speakers) {
      console.log(`\n👤 Processing Speaker #${speaker.id} (${speaker.email})`);
      console.log(`   Current status: ${speaker.submissionStatus}`);

      // Get all asset requirements for the event
      const assetRequirements = await db
        .select()
        .from(schema.assetRequirements)
        .where(eq(schema.assetRequirements.eventId, speaker.eventId));

      // Get all required asset requirements
      const requiredAssets = assetRequirements.filter((ar) => ar.isRequired);
      console.log(`   Required assets: ${requiredAssets.length}`);

      // Get speaker's latest submissions
      const submissions = await db
        .select()
        .from(schema.submissions)
        .where(
          and(
            eq(schema.submissions.speakerId, speaker.id),
            eq(schema.submissions.isLatest, true),
          ),
        );

      console.log(`   Submissions found: ${submissions.length}`);

      // Calculate submission status
      let newStatus: 'pending' | 'partial' | 'complete';

      if (submissions.length === 0) {
        newStatus = 'pending';
      } else if (requiredAssets.length === 0) {
        // If no required assets, any submission means complete
        newStatus = 'complete';
      } else {
        // Check if all required assets are submitted
        const submittedRequirementIds = submissions.map(
          (s) => s.assetRequirementId,
        );
        const requiredAssetIds = requiredAssets.map((ra) => ra.id);

        const allRequiredSubmitted = requiredAssetIds.every((id) =>
          submittedRequirementIds.includes(id),
        );

        if (allRequiredSubmitted) {
          newStatus = 'complete';
        } else {
          newStatus = 'partial';
        }
      }

      console.log(`   Calculated status: ${newStatus}`);

      // Update if status changed
      if (newStatus !== speaker.submissionStatus) {
        await db
          .update(schema.speakers)
          .set({
            submissionStatus: newStatus,
            submittedAt: newStatus === 'complete' ? new Date() : speaker.submittedAt,
            updatedAt: new Date(),
          })
          .where(eq(schema.speakers.id, speaker.id));

        console.log(`   ✅ Updated: ${speaker.submissionStatus} → ${newStatus}`);
        updatedCount++;
      } else {
        console.log(`   ⏭️  Skipped: Status already correct`);
        skippedCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✨ Migration Complete!');
    console.log('='.repeat(50));
    console.log(`📊 Total speakers processed: ${speakers.length}`);
    console.log(`✅ Speakers updated: ${updatedCount}`);
    console.log(`⏭️  Speakers skipped (already correct): ${skippedCount}`);
    console.log('='.repeat(50) + '\n');
  } catch (error) {
    console.error('\n❌ Error during migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
fixSpeakerStatuses()
  .then(() => {
    console.log('🎉 Migration script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error);
    process.exit(1);
  });
