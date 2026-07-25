import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { PersonalNote } from "../models/personalNote.model.js";

const cleanTitle = (title) => {
  if (typeof title !== "string" || !title.trim()) {
    throw new ApiError(400, "A note title is required");
  }
  if (title.trim().length > 120) {
    throw new ApiError(400, "A note title cannot be longer than 120 characters");
  }
  return title.trim();
};

const cleanBackgroundColor = (backgroundColor) => {
  if (typeof backgroundColor !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(backgroundColor)) {
    throw new ApiError(400, "Background color must be a six-digit hex color");
  }
  return backgroundColor;
};

const createPersonalNote = asyncHandler(async (req, res) => {
  const note = await PersonalNote.create({
    title: cleanTitle(req.body.title),
    owner: req.user._id,
    elements: [],
    backgroundColor: "#ffffff",
  });

  res.status(201).json(new ApiResponse(201, note, "Note created successfully"));
});

const getPersonalNotes = asyncHandler(async (req, res) => {
  const notes = await PersonalNote.find({ owner: req.user._id })
    .select("title elements createdAt updatedAt")
    .sort({ updatedAt: -1 });
  res.status(200).json(new ApiResponse(200, notes, "Notes retrieved successfully"));
});

const getPersonalNoteById = asyncHandler(async (req, res) => {
  const note = await PersonalNote.findOne({ _id: req.params.id, owner: req.user._id });
  if (!note) throw new ApiError(404, "Note not found");
  res.status(200).json(new ApiResponse(200, note, "Note retrieved successfully"));
});

const updatePersonalNote = asyncHandler(async (req, res) => {
  const update = {};
  if (req.body.title !== undefined) update.title = cleanTitle(req.body.title);
  if (req.body.elements !== undefined) {
    if (!Array.isArray(req.body.elements) || req.body.elements.length > 250) {
      throw new ApiError(400, "A note can contain up to 250 canvas items");
    }
    update.elements = req.body.elements;
  }
  if (req.body.backgroundColor !== undefined) update.backgroundColor = cleanBackgroundColor(req.body.backgroundColor);

  const note = await PersonalNote.findOneAndUpdate(
    { _id: req.params.id, owner: req.user._id },
    update,
    { new: true, runValidators: true }
  );
  if (!note) throw new ApiError(404, "Note not found");
  res.status(200).json(new ApiResponse(200, note, "Note saved successfully"));
});

const deletePersonalNote = asyncHandler(async (req, res) => {
  const note = await PersonalNote.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!note) throw new ApiError(404, "Note not found");
  res.status(200).json(new ApiResponse(200, note, "Note deleted successfully"));
});

export {
  createPersonalNote,
  getPersonalNotes,
  getPersonalNoteById,
  updatePersonalNote,
  deletePersonalNote,
};
