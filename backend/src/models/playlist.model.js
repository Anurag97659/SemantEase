import mongoose, { Schema } from "mongoose";

const playlistSchema = new Schema(
  {
    name: {
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
    words: {
      type: [
        {
          type: Schema.Types.ObjectId,
          ref: "Word",
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

playlistSchema.index({ owner: 1, updatedAt: -1 });

export const Playlist = mongoose.model("Playlist", playlistSchema);
