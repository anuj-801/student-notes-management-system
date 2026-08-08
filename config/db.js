const mongoose = require("mongoose");

const connectDB = async () => {
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/studentNotes");
        console.log("Mongoose connected successfully");
    } catch (error) {
        console.log("MongoDB connection failed:", error.message);
    }
};

module.exports = connectDB;