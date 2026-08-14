const express = require("express");
const app = express();
const PORT = 3000;
const path = require("path");
const methodOverride = require("method-override");
const fs = require("fs");

const upload = require("./middleware/upload");
const connectDB = require("./config/db");
const Note = require("./models/note");

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));

app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("home.ejs");
});

app.get("/notes", (req, res) => {
    res.render("notes.ejs");
});

app.get("/notes/semester/:semester", async (req, res) => {
    const semester = req.params.semester;
    const subjects = await Note.distinct("subject", {
        semester: semester
    });
    console.log(subjects);
    res.render("semester.ejs", {
        semester,
        subjects
    });
});

app.get("/notes/semester/:semester/:subject", async (req, res) => {
    const semester = req.params.semester;
    const subject = req.params.subject.replaceAll("-", " ");
    const notes = await Note.find({
        semester: semester,
        subject: new RegExp(`^${subject}$`, "i")
    })
    console.log("Semester:", semester);
    console.log("Subject:", subject);
    console.log(notes);
    res.render("notes-list.ejs", { notes });
});

app.get("/admin", async (req, res) => {
    const notes = await Note.find();
    console.log(notes);
    res.render("admin.ejs", { notes });
});

app.get("/admin/upload", (req, res) => {
    res.render("upload.ejs");
});

app.post("/admin", upload.single("pdf"), async (req, res) => {
    console.log("POST /admin received");
    const note = new Note({
        title: req.body.title,
        semester: req.body.semester,
        subject: req.body.subject,
        unit: req.body.unit,
        pdf: `/uploads/${req.file.filename}`
    });
    await note.save();
    console.log("NOTE SAVED:", note);

    res.send("Note saved successfully!");
});

app.get("/admin/notes", async (req, res) => {
    const notes = await Note.find();

    res.render("admin-notes.ejs", { notes });
});

app.get("/admin/notes/edit/:id", async (req, res) => {
    const { id } = req.params;
    const note = await Note.findById(id);
    console.log(note);
    res.render("edit-note.ejs", { note });
});

app.post("/admin/notes/edit/:id", async (req, res) => {
    const id = req.params.id;

    await Note.findByIdAndUpdate(id, {
        title: req.body.title,
        semester: req.body.semester,
        subject: req.body.subject,
        unit: req.body.unit
    });

    res.redirect("/admin/notes");
});

app.delete("/admin/notes/delete/:id", async (req, res) => {
    const id = req.params.id;
    const note = await Note.findById(id);
    const filePath = path.join(
        __dirname,
        "public",
        note.pdf.replace("/", "")
    );
    console.log("File path:", filePath);
    fs.unlinkSync(filePath);
    await Note.findByIdAndDelete(id);
    res.redirect("/admin/notes");
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});