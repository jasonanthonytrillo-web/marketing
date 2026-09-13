require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const { createGzip } = require('zlib');
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} = require('@aws-sdk/client-s3');

const required = [
  'DIRECT_URL',
  'B2_KEY_ID',
  'B2_APPLICATION_KEY',
  'B2_BUCKET_NAME',
  'B2_ENDPOINT',
  'B2_REGION'
];

for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}

const dailyRetentionDays = Number(process.env.B2_DAILY_RETENTION_DAYS || 30);
const monthlyRetentionDays = Number(process.env.B2_MONTHLY_RETENTION_DAYS || 365);
if (!Number.isFinite(dailyRetentionDays) || dailyRetentionDays < 1 || !Number.isFinite(monthlyRetentionDays) || monthlyRetentionDays < 1) {
  throw new Error('Backup retention values must be positive numbers.');
}

const s3 = new S3Client({
  region: process.env.B2_REGION,
  endpoint: process.env.B2_ENDPOINT,
  forcePathStyle: true,
  // Backblaze B2 does not support the AWS SDK's optional trailing
  // checksum on streamed PutObject requests.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId: process.env.B2_KEY_ID,
    secretAccessKey: process.env.B2_APPLICATION_KEY
  }
});

const tempFile = path.join(os.tmpdir(), `project-million-${Date.now()}.sql.gz`);

function runPgDump(outputPath) {
  return new Promise((resolve, reject) => {
    const pgDump = spawn(process.env.PG_DUMP_PATH || 'pg_dump', [
      '--dbname', process.env.DIRECT_URL,
      '--no-owner',
      '--no-privileges',
      '--format', 'plain'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    const output = fs.createWriteStream(outputPath, { mode: 0o600 });
    const gzip = createGzip({ level: 9 });
    let errorOutput = '';

    pgDump.stderr.on('data', chunk => { errorOutput += chunk.toString(); });

    pipeline(pgDump.stdout, gzip, output)
      .catch(error => {
        pgDump.kill();
        reject(error);
      });

    pgDump.on('error', error => {
      if (error.code === 'ENOENT') {
        reject(new Error('pg_dump was not found. Install PostgreSQL client tools on the backup runner.'));
      } else {
        reject(error);
      }
    });

    pgDump.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump failed with exit code ${code}: ${errorOutput.trim()}`));
    });
  });
}

async function uploadBackup(prefix) {
  const now = new Date();
  const stamp = now.toISOString().replace(/[.:]/g, '-');
  const key = `postgres/${prefix}/${now.toISOString().slice(0, 7)}/project-million-${stamp}.sql.gz`;
  // Use a Buffer so the S3-compatible request has a fixed body and does not
  // use aws-chunked streaming, which B2 may reject as malformed framing.
  const backupBody = fs.readFileSync(tempFile);

  await s3.send(new PutObjectCommand({
    Bucket: process.env.B2_BUCKET_NAME,
    Key: key,
    Body: backupBody,
    ContentLength: backupBody.length,
    ContentType: 'application/gzip',
    Metadata: {
      backupType: 'postgresql',
      createdAt: now.toISOString()
    }
  }));

  return key;
}

async function removeExpiredBackups(prefix, retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let continuationToken;
  const expired = [];

  do {
    const page = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.B2_BUCKET_NAME,
      Prefix: `postgres/${prefix}/`,
      ContinuationToken: continuationToken
    }));

    for (const object of page.Contents || []) {
      if (object.Key && object.LastModified && object.LastModified.getTime() < cutoff) {
        expired.push({ Key: object.Key });
      }
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  for (let index = 0; index < expired.length; index += 1000) {
    await s3.send(new DeleteObjectsCommand({
      Bucket: process.env.B2_BUCKET_NAME,
      Delete: { Objects: expired.slice(index, index + 1000), Quiet: true }
    }));
  }

  return expired.length;
}

async function main() {
  try {
    await runPgDump(tempFile);
    const dailyKey = await uploadBackup('daily');
    const monthlyKey = new Date().getUTCDate() === 1 ? await uploadBackup('monthly') : null;
    const deletedDaily = await removeExpiredBackups('daily', dailyRetentionDays);
    const deletedMonthly = await removeExpiredBackups('monthly', monthlyRetentionDays);
    console.log(JSON.stringify({ success: true, dailyKey, monthlyKey, deletedDaily, deletedMonthly }));
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

main().catch(error => {
  console.error(`Database backup failed: ${error.message}`);
  process.exitCode = 1;
});
