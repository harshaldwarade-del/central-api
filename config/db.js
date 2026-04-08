const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {});

    console.log(`MongoDB connected`);

    mongoose.connection.on("disconnected", () =>
      console.warn("MongoDB disconnected. Retrying…"),
    );
    mongoose.connection.on("reconnected", () =>
      console.log("MongoDB reconnected"),
    );
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
