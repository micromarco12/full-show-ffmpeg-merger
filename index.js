const express = require("express");
const app = express();
const mergeRoute = require("./merge-full-show");

app.use(express.json());

// This will handle requests to /merge-audio/merge-full-show
app.use("/merge-audio", mergeRoute);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
