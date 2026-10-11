require("dotenv").config();

const express = require("express");
const app = express();
const PORT = 3000;
const path = require("path");
const methodOverride = require("method-override");
const fs = require("fs");
const session = require("express-session");

const upload = require("./middleware/upload");
const connectDB = require("./config/db");
const Note = require("./models/note");
const Admin = require("./models/admin");
const Student = require("./models/student");
const bcrypt = require("bcrypt");

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));

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
    res.render("notes-list.ejs", { notes });
});

app.get("/admin", isAdmin, async (req, res) => {
    const notes = await Note.find();
    res.render("admin.ejs", { notes });
});

app.get("/admin/upload", isAdmin, (req, res) => {
    res.render("upload.ejs");
});

app.post("/admin", isAdmin, upload.single("pdf"), async (req, res) => {
    const note = new Note({
        title: req.body.title,
        course: req.body.course,
        semester: req.body.semester,
        subject: req.body.subject,
        unit: req.body.unit,
        pdf: `/uploads/${req.file.filename}`
    });
    await note.save();

    res.send("Note saved successfully!");
});

app.get("/admin/notes", isAdmin, async (req, res) => {
    const semester = req.query.semester;

    let notes;
    if (semester) {
        notes = await Note.find({ semester: semester });
    } else {
        notes = await Note.find();
    }
    res.render("admin-notes.ejs", {
        notes,
        semester
    });
});

app.get("/admin/notes/edit/:id", isAdmin, async (req, res) => {
    const { id } = req.params;
    const note = await Note.findById(id);
    res.render("edit-note.ejs", { note });
});

app.post("/admin/notes/edit/:id", isAdmin, async (req, res) => {
    const id = req.params.id;

    await Note.findByIdAndUpdate(id, {
        title: req.body.title,
        semester: req.body.semester,
        subject: req.body.subject,
        unit: req.body.unit
    });

    res.redirect("/admin/notes");
});

app.delete("/admin/notes/delete/:id", isAdmin, async (req, res) => {
    const id = req.params.id;
    const note = await Note.findById(id);
    if (!note) {
        return res.status(404).send("Note not found");
    }
    const filePath = path.join(
        __dirname,
        "public",
        note.pdf.replace("/", "")
    );
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    await Note.findByIdAndDelete(id);
    res.redirect("/admin/notes");
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});


app.get("/register", (req, res) => {
    res.render("register.ejs");
});


app.post("/register", async (req, res) => {
    const { name, email, password, course, semester } = req.body;

    const existingStudent = await Student.findOne({ email });

    if (existingStudent) {
    return res.status(409).send(
        "This email is already registered. Please log in."
    );
}

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = new Student({
        name,
        email,
        password: hashedPassword,
        course,
        semester
    });

    await student.save();

    res.redirect("/student-login");
});

app.get("/student-login", (req, res) => {
    res.render("student-login.ejs");
});

app.post("/student-login", async (req, res) => {
    const { email, password } = req.body;

    const student = await Student.findOne({ email });

    if (!student) {
        return res.send("Invalid email or password");
    }

    const isMatch = await bcrypt.compare(
        password,
        student.password
    );

    if (!isMatch) {
        return res.send("Invalid email or password");
    }

    req.session.student = student._id;

    res.redirect("/student/dashboard");
});

app.get("/student/dashboard", async (req, res) => {
    if (!req.session.student) {
        return res.redirect("/student-login");
    }

    const student = await Student.findById(req.session.student);

    if (!student) {
        return res.redirect("/student-login");
    }

    res.render("student-dashboard.ejs", { student });
});

app.get("/student/notes", async (req, res) => {
    if (!req.session.student) {
        return res.redirect("/student-login");
    }

    const student = await Student.findById(req.session.student);

    if (!student) {
        return res.redirect("/student-login");
    }

    const notes = await Note.find({
        course: student.course,
        semester: student.semester
    });

    res.render("notes-list.ejs", { notes });
});

function isAdmin(req, res, next) {
    if (req.session.admin) {
        next();
    } else {
        res.redirect("/login");
    }
}

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });

    if (!admin) {
        return res.send("Invalid email and password");
    }
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
        return res.send("Invalid email or password");
    }

    req.session.admin = true;
    res.redirect("/admin");
});

app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/login");
    });
});

app.get("/student-logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/student-login");
    });
});

app.use((req, res) => {
    res.status(404).render("404.ejs");
});

connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});