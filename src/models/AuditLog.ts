import mongoose, { Document, Model, Schema } from "mongoose";
import Counter from "./Counter";

export interface IAuditLog extends Document {
  auditLogId: string;
  userId?: string;
  otherUserId?: string;
  userRole?: "client" | "lawyer" | "judge" | "admin";
  otherUserRole?: "client" | "lawyer" | "judge" | "admin";
  action: string;
  entity?: "login" | "register" | "forgot_password" | "verification_request" | "user_request" | "user_verification" | "case_created" | "vault_access" | "case_assignment" | "case_update" | "vault_upload" | "admin_action" | "password_change";
  details?: Record<string, unknown>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema: Schema<IAuditLog> = new Schema({
  auditLogId: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    ref: "User",
    index: true,
  },
  otherUserId: {
    type: String,
    ref: "User",
    index: true,
  },
  userRole: {
    type: String,
    enum: ["client", "lawyer", "judge", "admin"],
  },
  otherUserRole: {
    type: String,
    enum: ["client", "lawyer", "judge", "admin"],
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  entity: {
    type: String,
    enum: ["login", "register", "forgot_password", "verification_request", "user_request", "user_verification", "case_created", "vault_access", "case_assignment", "case_update", "vault_upload", "admin_action", "password_change"],
  },
  details: {
    type: Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
}, { timestamps: true });

// Generate the id before validation so the required rule passes.
AuditLogSchema.pre("validate", async function () {
  if (this.isNew && !this.auditLogId) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "A" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    this.auditLogId = `A${counter.seq.toString().padStart(4, "0")}`;
  }
  this.updatedAt = new Date();
});

const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
