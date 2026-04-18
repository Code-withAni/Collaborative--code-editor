/**
 * db.js
 * MongoDB connection configuration using Mongoose.
 * Implements retry logic and graceful shutdown handling.
 */

import mongoose from 'mongoose';

/**
 * Connects to MongoDB using the MONGO_URI environment variable.
 * Retries up to 5 times before exiting the process.
 */
const connectDB = async (retries = 5) => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error('[DB] MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(uri);

      console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      console.error(`[DB] Connection attempt ${attempt}/${retries} failed: ${err.message}`);

      if (attempt === retries) {
        console.error('[DB] Max retries reached. Exiting...');
        process.exit(1);
      }

      // Exponential back-off: 2s, 4s, 8s …
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[DB] Retrying in ${delay / 1000}s...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

// Graceful shutdown: close the Mongoose connection when process is terminated.
const gracefulShutdown = async (signal) => {
  console.log(`[DB] Received ${signal}. Closing MongoDB connection...`);
  await mongoose.connection.close();
  console.log('[DB] MongoDB connection closed.');
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export default connectDB;
