require("dotenv").config();
const express = require("express");
const connectDB = require("./config/db");

const PORT = process.env.PORT;

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API is running...");
});

(async () => {
  try {
    connectDB();
    app.listen(PORT, () => {
      console.log(`🟢 Server is running at port: ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  }
})();
