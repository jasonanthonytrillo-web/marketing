# Database backups

The backup job uses `pg_dump` and Backblaze B2's S3-compatible API. It runs from the GitHub Actions workflow at `.github/workflows/database-backup.yml`, so it does not require a second Render service.

Required environment variables:

```env
DIRECT_URL=your-postgresql-direct-connection-string
B2_KEY_ID=your-backblaze-key-id
B2_APPLICATION_KEY=your-backblaze-application-key
B2_BUCKET_NAME=project-million-pos-backups
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_DAILY_RETENTION_DAYS=30
B2_MONTHLY_RETENTION_DAYS=365
```

Run a backup manually from the `backend` directory:

```powershell
npm.cmd run backup:database
```

The backup runner creates a compressed PostgreSQL dump, uploads a daily copy to `postgres/daily/`, and on the first day of each month also uploads a monthly copy to `postgres/monthly/`. Daily copies are retained for 30 days and monthly copies for 12 months. Backblaze credentials must remain in Render environment variables and must not be committed to the repository.

## GitHub Actions

Add the variables above as repository Actions secrets. The workflow installs PostgreSQL client tools, runs daily at 02:00 UTC, and can also be started manually from the repository's Actions tab. The workflow uses the GitHub-hosted runner, so no additional Render service is required.
