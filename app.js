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

// Middleware to pass session data to all views
app.use((req, res, next) => {
    res.locals.student = req.session.student || null;
    res.locals.admin = req.session.admin || null;
    next();
});

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
    try {
        if (!req.file) {
            return res.status(400).send("Please upload a PDF file");
        }

        const note = new Note({
            title: req.body.title,
            course: req.body.course,
            semester: req.body.semester,
            subject: req.body.subject,
            unit: req.body.unit,
            pdf: `/uploads/${req.file.filename}`
        });
        await note.save();

        res.status(200).send("Note saved successfully!");
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).send("Error uploading note: " + error.message);
    }
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
    try {
        const id = req.params.id;

        await Note.findByIdAndUpdate(id, {
            title: req.body.title,
            semester: req.body.semester,
            subject: req.body.subject,
            unit: req.body.unit
        });

        res.redirect("/admin/notes");
    } catch (error) {
        console.error("Edit note error:", error);
        res.status(500).send("Error updating note");
    }
});

app.delete("/admin/notes/delete/:id", isAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const note = await Note.findById(id);
        if (!note) {
            return res.status(404).send("Note not found");
        }
        
        const filePath = path.join(
            __dirname,
            "public",
            note.pdf.startsWith("/") ? note.pdf.substring(1) : note.pdf
        );
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        
        await Note.findByIdAndDelete(id);
        res.redirect("/admin/notes");
    } catch (error) {
        console.error("Delete note error:", error);
        res.status(500).send("Error deleting note");
    }
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});


app.get("/register", (req, res) => {
    res.render("register.ejs");
});


app.post("/register", async (req, res) => {
    try {
        const { name, email, password, course, semester } = req.body;

        // Validate inputs
        if (!name || !email || !password || !course || !semester) {
            return res.status(400).render("register.ejs", {
                error: "All fields are required"
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).render("register.ejs", {
                error: "Please enter a valid email address"
            });
        }

        // Validate password length
        if (password.length < 6) {
            return res.status(400).render("register.ejs", {
                error: "Password must be at least 6 characters long"
            });
        }

        const existingStudent = await Student.findOne({ email });

        if (existingStudent) {
            return res.status(409).render("register.ejs", {
                error: "This email is already registered. Please log in."
            });
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
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).render("register.ejs", {
            error: "An error occurred during registration. Please try again."
        });
    }
});

app.get("/student-login", (req, res) => {
    res.render("student-login.ejs");
});

app.post("/student-login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("student-login.ejs", {
                error: "Email and password are required"
            });
        }

        const student = await Student.findOne({ email });

        if (!student) {
            return res.status(401).render("student-login.ejs", {
                error: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(password, student.password);

        if (!isMatch) {
            return res.status(401).render("student-login.ejs", {
                error: "Invalid email or password"
            });
        }

        req.session.student = student._id;
        res.redirect("/student/dashboard");
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).render("student-login.ejs", {
            error: "An error occurred during login. Please try again."
        });
    }
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
    try {
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

        res.render("notes-list.ejs", { 
            notes: notes,
            student: student
        });
    } catch (error) {
        console.error("Student notes error:", error);
        res.status(500).send("Error loading notes");
    }
});

// Protected download route - requires student login
app.get("/download/:filename", async (req, res) => {
    try {
        // Check if user is logged in (either student or admin)
        if (!req.session.student && !req.session.admin) {
            // Determine if they should login as student or admin based on context
            return res.status(401).render("student-login.ejs", {
                error: "You must login to download notes"
            });
        }

        const filename = req.params.filename;
        const filePath = path.join(__dirname, "public", "uploads", filename);

        // Verify file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).send("File not found");
        }

        // Display the PDF in browser (not download)
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline; filename=" + filename);
        res.sendFile(filePath);
    } catch (error) {
        console.error("Download error:", error);
        res.status(500).send("Error downloading file");
    }
});

function isAdmin(req, res, next) {
    if (req.session.admin) {
        next();
    } else {
        res.redirect("/login");
    }
}

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).render("login.ejs", {
                error: "Email and password are required"
            });
        }

        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.status(401).render("login.ejs", {
                error: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(password, admin.password);

        if (!isMatch) {
            return res.status(401).render("login.ejs", {
                error: "Invalid email or password"
            });
        }

        req.session.admin = true;
        res.redirect("/admin");
    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).render("login.ejs", {
            error: "An error occurred during login. Please try again."
        });
    }
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