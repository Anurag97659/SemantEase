import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Playlist } from "../models/playlist.model.js";
import { Word } from "../models/word.model.js";

const MAX_PLAYLIST_WORDS = 500;

const cleanName = (name) => {
  if (typeof name !== "string" || !name.trim()) {
    throw new ApiError(400, "A playlist name is required");
  }
  if (name.trim().length > 120) {
    throw new ApiError(
      400,
      "A playlist name cannot be longer than 120 characters"
    );
  }
  return name.trim();
};

const cleanWordIds = (wordIds) => {
  if (wordIds === undefined) return [];
  if (!Array.isArray(wordIds)) {
    throw new ApiError(400, "wordIds must be an array");
  }
  if (wordIds.length > MAX_PLAYLIST_WORDS) {
    throw new ApiError(
      400,
      `A playlist can contain up to ${MAX_PLAYLIST_WORDS} words`
    );
  }

  const uniqueIds = [...new Set(wordIds)];
  if (
    uniqueIds.some(
      (wordId) =>
        typeof wordId !== "string" || !mongoose.isValidObjectId(wordId)
    )
  ) {
    throw new ApiError(400, "One or more selected words are invalid");
  }
  return uniqueIds;
};

const ensureWordsExist = async (wordIds) => {
  if (!wordIds.length) return;
  const existingCount = await Word.countDocuments({ _id: { $in: wordIds } });
  if (existingCount !== wordIds.length) {
    throw new ApiError(400, "One or more selected words no longer exist");
  }
};

const getOwnedPlaylist = async (id, ownerId) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, "Playlist not found");
  }
  const playlist = await Playlist.findOne({ _id: id, owner: ownerId });
  if (!playlist) throw new ApiError(404, "Playlist not found");
  return playlist;
};

const wordSelection =
  "word phonetic definitions synonyms antonyms examples createdAt updatedAt";

const playlistForDetail = async (id, ownerId) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(404, "Playlist not found");
  }
  const playlist = await Playlist.findOne({ _id: id, owner: ownerId }).populate(
    {
      path: "words",
      select: wordSelection,
    }
  );
  if (!playlist) throw new ApiError(404, "Playlist not found");
  return playlist;
};

const createPlaylist = asyncHandler(async (req, res) => {
  const wordIds = cleanWordIds(req.body.wordIds);
  await ensureWordsExist(wordIds);

  const playlist = await Playlist.create({
    name: cleanName(req.body.name),
    owner: req.user._id,
    words: wordIds,
  });

  res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

const getPlaylists = asyncHandler(async (req, res) => {
  const playlists = await Playlist.find({ owner: req.user._id })
    .select("name words createdAt updatedAt")
    .sort({ updatedAt: -1 });

  const summaries = playlists.map((playlist) => ({
    _id: playlist._id,
    name: playlist.name,
    wordCount: playlist.words.length,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  }));

  res
    .status(200)
    .json(new ApiResponse(200, summaries, "Playlists retrieved successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const playlist = await playlistForDetail(req.params.id, req.user._id);
  res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist retrieved successfully"));
});

const addWordsToPlaylist = asyncHandler(async (req, res) => {
  const wordIds = cleanWordIds(req.body.wordIds);
  const playlist = await getOwnedPlaylist(req.params.id, req.user._id);

  const newWordIds = wordIds.filter(
    (wordId) =>
      !playlist.words.some(
        (playlistWordId) => playlistWordId.toString() === wordId
      )
  );

  if (playlist.words.length + newWordIds.length > MAX_PLAYLIST_WORDS) {
    throw new ApiError(
      400,
      `A playlist can contain up to ${MAX_PLAYLIST_WORDS} words`
    );
  }

  await ensureWordsExist(newWordIds);
  playlist.words.push(...newWordIds);
  await playlist.save();

  const populatedPlaylist = await playlistForDetail(playlist._id, req.user._id);
  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        populatedPlaylist,
        "Words added to playlist successfully"
      )
    );
});

export { createPlaylist, getPlaylists, getPlaylistById, addWordsToPlaylist };
