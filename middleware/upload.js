const multer = require("multer");

const upload = multer({
    dest: "public/uploads/",

    fileFilter: (req, file, cb) => {
        if(file.mimetype === "application/pdf") {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"));
        }
    }
});

module.exports = upload;