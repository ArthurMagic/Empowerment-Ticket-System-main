module.exports = {
  apps: [
    {
      name: "empowerment-api",
      script: "artifacts/api-server/dist/index.mjs",
      cwd: "/root/apps/empowerment",
      env: {
        NODE_ENV: "production",
        DATABASE_URL: "postgres://USER:PASSWORD@localhost:5432/DBNAME",
        BASE_PATH: "/"
      }
    }
  ]
};