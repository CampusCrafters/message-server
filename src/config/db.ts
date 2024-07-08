import "dotenv/config";
import mongoose from "mongoose";

const connectToMongoDB = async () => {
  const clientOptions = {
    serverApi: { version: "1", strict: true, deprecationErrors: true },
  };
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("MongoDB URL is not defined");
  }
  const uri = `${DATABASE_URL}`;

  try {
    await mongoose.connect(uri, { ...clientOptions, serverApi: "1" });
    await mongoose.connection.db.admin().command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (e) {
    console.error("Error connecting to MongoDB:", e);
  }
};

export default connectToMongoDB;
