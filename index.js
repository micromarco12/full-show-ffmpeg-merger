const express = require("express");
const app = express();

// Parse incoming JSON requests
app.use(express.json());

// Route handler for /merge-audio
const merge = require("./merge-full-show");
app.use("/merge-audio", mergeRoute);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟢 Server running on port ${PORT}`);
});
