#!/usr/bin/env ts-node
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../src/models/User';
import bcrypt from 'bcrypt';

async function main() {
  const { MONGO_URI } = process.env;
  if (!MONGO_URI) {
    console.error('MONGO_URI not set in .env.local');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI, { bufferCommands: false });
  console.log('Connected to MongoDB');

  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage: ts-node scripts/create-admin.ts <email> <password>');
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.error(`User with email ${email} already exists.`);
    process.exit(1);
  }

  const admin = new User({
    fullName: 'Admin',
  phoneNumber: '+919000000000',
    email,
    address: 'Admin Address',
    role: 'admin',
    idDocument: 'ADMIN',
    professionalDocument: 'ADMIN',
    password,
    verificationStatus: 'accepted',
  });

  await admin.save();
  console.log('Admin user created with ID:', admin.userId);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
