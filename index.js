const express = require("express");
const app = express();
const mergeRoute = require("./merge-full-show");

app.use(express.json());

// ✅ Route: /merge-audio/merge-full-show
app.use("/merge-audio", mergeRoute);

// Optional ping route to confirm Render is live
app.get("/ping", (req, res) => {
  res.send("✅ Server is alive!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
