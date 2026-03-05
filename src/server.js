const { createApp } = require("./app");

const PORT = Number(process.env.PORT || 3000);
const { app } = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Budgeting server running on http://localhost:${PORT}`);
});
