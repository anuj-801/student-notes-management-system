const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema({
    title: String,
    course: String,
    semester: String,
    subject: String,
    unit: String,
    pdf: String
});

const Note = mongoose.model("Note", noteSchema);

module.exports = Note;