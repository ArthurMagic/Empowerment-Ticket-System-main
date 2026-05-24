const { defineConfig } = require('drizzle-kit');

module.exports = defineConfig({
  out: './drizzle',
  schema: './src/schema/reservations.ts',
  dialect: 'postgresql',
  dbCredentials: {
    // Füge HIER direkt deinen echten Neon Connection String ein!
    url: 'postgresql://neondb_owner:npg_wZoLhldPX37y@ep-proud-forest-al7hj7zg.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require', 
  },
});