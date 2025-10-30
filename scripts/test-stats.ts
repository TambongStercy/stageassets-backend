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

async function testStats() {
  const eventId = 4;

  console.log('📊 Testing Enhanced Stats for Event #4\n');

  // Get asset requirements for this event
  const assetRequirements = await db
    .select()
    .from(schema.assetRequirements)
    .where(eq(schema.assetRequirements.eventId, eventId));

  const totalAssetTypes = assetRequirements.length;
  const requiredAssetTypes = assetRequirements.filter((ar) => ar.isRequired).length;
  const optionalAssetTypes = totalAssetTypes - requiredAssetTypes;

  console.log(`Asset Types:`);
  console.log(`  Total: ${totalAssetTypes}`);
  console.log(`  Required: ${requiredAssetTypes}`);
  console.log(`  Optional: ${optionalAssetTypes}\n`);

  // Get all speakers for this event
  const speakers = await db
    .select()
    .from(schema.speakers)
    .where(eq(schema.speakers.eventId, eventId));

  const totalSpeakers = speakers.length;

  console.log(`Speakers: ${totalSpeakers}\n`);

  // Calculate expected vs received assets
  const totalExpectedAssets = totalSpeakers * totalAssetTypes;
  const totalRequiredAssets = totalSpeakers * requiredAssetTypes;
  const totalOptionalAssets = totalSpeakers * optionalAssetTypes;

  console.log(`Expected Assets:`);
  console.log(`  Total: ${totalExpectedAssets}`);
  console.log(`  Required: ${totalRequiredAssets}`);
  console.log(`  Optional: ${totalOptionalAssets}\n`);

  // Get all submissions for this event's speakers
  const speakerIds = speakers.map((s) => s.id);
  let totalReceivedAssets = 0;
  let totalRequiredAssetsReceived = 0;
  let totalOptionalAssetsReceived = 0;

  if (speakerIds.length > 0) {
    const submissions: any[] = [];
    for (const speakerId of speakerIds) {
      const speakerSubmissions = await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.speakerId, speakerId));
      submissions.push(...speakerSubmissions);
    }

    totalReceivedAssets = submissions.length;

    const requiredAssetIds = assetRequirements
      .filter((ar) => ar.isRequired)
      .map((ar) => ar.id);

    for (const submission of submissions) {
      if (requiredAssetIds.includes(submission.assetRequirementId)) {
        totalRequiredAssetsReceived++;
      } else {
        totalOptionalAssetsReceived++;
      }
    }
  }

  console.log(`Received Assets:`);
  console.log(`  Total: ${totalReceivedAssets}`);
  console.log(`  Required: ${totalRequiredAssetsReceived}`);
  console.log(`  Optional: ${totalOptionalAssetsReceived}\n`);

  const overallProgress = totalExpectedAssets > 0
    ? Math.round((totalReceivedAssets / totalExpectedAssets) * 100)
    : 0;

  const requiredAssetsProgress = totalRequiredAssets > 0
    ? Math.round((totalRequiredAssetsReceived / totalRequiredAssets) * 100)
    : 0;

  console.log(`Progress:`);
  console.log(`  Overall: ${overallProgress}% (${totalReceivedAssets}/${totalExpectedAssets})`);
  console.log(`  Required: ${requiredAssetsProgress}% (${totalRequiredAssetsReceived}/${totalRequiredAssets})`);

  await pool.end();
}

testStats().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
