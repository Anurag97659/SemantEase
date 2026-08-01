import mongoose, { Schema } from "mongoose";

const blendSchema = new Schema(
  {
    members: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      ],
      validate: {
        validator: (value) => Array.isArray(value) && value.length >= 2,
        message: "A blend must have at least two members",
      },
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

blendSchema.index({ members: 1 });

export const Blend = mongoose.model("Blend", blendSchema);
