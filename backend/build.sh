#!/opt/render/project/src/.render/bin/sh
# Install dependencies
npm install
# Generate Prisma Client
npx prisma generate
# Optional: Sync database (Only run this manually or if you're sure)
# npx prisma db push --accept-data-loss
