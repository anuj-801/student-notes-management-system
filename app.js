const express = require("express");
const app = express();

const PORT = 3000;

app.use(express.static("public"));

app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("home.ejs");
});

app.get("/notes", (req, res) => {
    res.render("notes.ejs");
});

app.get("/notes/semester1", (req, res) => {
    res.render("semester.ejs");
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});