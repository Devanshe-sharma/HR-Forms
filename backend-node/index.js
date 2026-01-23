const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(require("cors")());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Mongo connected"))
    .catch(console.error);

app.get("/health", (req, res) => {
    res.json({ status: "Node backend working" });
});

app.listen(5000, () => console.log("Node running on 5000"));
