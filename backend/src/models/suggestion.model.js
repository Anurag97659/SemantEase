import mongoose, { Schema } from "mongoose";

const suggestionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: [true, "Suggestion message is required"],
      trim: true,
    },
    category: {
      type: String,
      enum: ["Feature Request", "Bug Report", "General Feedback", "Other"],
      default: "Feature Request",
    },
    status: {
      type: String,
      enum: ["Pending", "Reviewed", "Resolved"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

export const Suggestion = mongoose.model("Suggestion", suggestionSchema);
