import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGO_URI as string;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGO_URI environment variable inside .env.local');
}

// Validate MongoDB URI format
if (!/^mongodb(\+srv)?:\/\/.+/.test(MONGODB_URI)) {
  throw new Error('MONGO_URI must be a valid MongoDB connection string (mongodb:// or mongodb+srv://)');
}

interface DbCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var dbCache: DbCache;
}

let cached = global.dbCache;

if (!cached) {
  cached = global.dbCache = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false }).then((db) => {
      console.log('MongoDB connected successfully');
      return db;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;
