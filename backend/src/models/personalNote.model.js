import mongoose, { Schema } from "mongoose";

const personalNoteSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    elements: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    backgroundColor: {
      type: String,
      default: "#ffffff",
      match: /^#[0-9A-Fa-f]{6}$/,
    },
  },
  { timestamps: true }
);

personalNoteSchema.index({ owner: 1, updatedAt: -1 });

export const PersonalNote = mongoose.model("PersonalNote", personalNoteSchema);
