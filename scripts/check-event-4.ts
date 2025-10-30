import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function checkEvent4() {
  console.log('🔍 Checking Event #4 Data...\n');

  // Get speakers for event 4
  const speakers = await db
    .select()
    .from(schema.speakers)
    .where(eq(schema.speakers.eventId, 4));

  console.log(`📊 Found ${speakers.length} speaker(s) for Event #4\n`);

  for (const speaker of speakers) {
    console.log(`👤 Speaker #${speaker.id}:`);
    console.log(`   Email: ${speaker.email}`);
    console.log(`   Name: ${speaker.firstName} ${speaker.lastName}`);
    console.log(`   Status: ${speaker.submissionStatus}`);
    console.log(`   Submitted At: ${speaker.submittedAt}`);

    // Get asset requirements for this event
    const assetRequirements = await db
      .select()
      .from(schema.assetRequirements)
      .where(eq(schema.assetRequirements.eventId, speaker.eventId));

    const requiredAssets = assetRequirements.filter((ar) => ar.isRequired);
    console.log(`   Total asset requirements: ${assetRequirements.length}`);
    console.log(`   Required assets: ${requiredAssets.length}`);

    // Get submissions for this speaker
    const submissions = await db
      .select()
      .from(schema.submissions)
      .where(eq(schema.submissions.speakerId, speaker.id));

    console.log(`   Submissions count: ${submissions.length}`);

    if (submissions.length > 0) {
      console.log(`   Submitted requirement IDs: ${submissions.map(s => s.assetRequirementId).join(', ')}`);
    }

    // Calculate what status should be
    let expectedStatus: 'pending' | 'partial' | 'complete';
    if (submissions.length === 0) {
      expectedStatus = 'pending';
    } else if (requiredAssets.length === 0) {
      expectedStatus = 'complete';
    } else {
      const submittedRequirementIds = submissions.map((s) => s.assetRequirementId);
      const requiredAssetIds = requiredAssets.map((ra) => ra.id);
      const allRequiredSubmitted = requiredAssetIds.every((id) =>
        submittedRequirementIds.includes(id),
      );
      expectedStatus = allRequiredSubmitted ? 'complete' : 'partial';
    }

    console.log(`   Expected status: ${expectedStatus}`);
    console.log(`   Status matches: ${speaker.submissionStatus === expectedStatus ? '✅' : '❌'}`);
    console.log('');
  }

  await pool.end();
}

checkEvent4().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
