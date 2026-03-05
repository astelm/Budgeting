require("dotenv").config();
const { createApp } = require("./app");

async function start() {
  const PORT = Number(process.env.PORT || 3000);
  const { app, repository } = createApp();

  await repository.healthCheck();

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Budgeting server running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
