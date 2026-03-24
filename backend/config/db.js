const mongoose = require("mongoose");

const connectDB = async (retries = 5) => {
  for (let i = 1; i <= retries; i++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
      });
      console.log(`✅ MongoDB connected: ${conn.connection.host}`);
      return;
    } catch (err) {
      console.error(`❌ MongoDB attempt ${i}/${retries} failed: ${err.message}`);
      if (i === retries) {
        console.error("💡 Fix: Go to MongoDB Atlas → Network Access → Add IP Address → Allow access from anywhere (0.0.0.0/0) for development.");
        return;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
};

module.exports = connectDB;
