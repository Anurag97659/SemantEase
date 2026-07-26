import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Suggestion } from "../models/suggestion.model.js";

const getAdminUsername = () => {
  const envAdmin = process.env.ADMIN_USERNAME;
  return envAdmin.replace(/;/g, "").replace(/['"]/g, "").trim().toLowerCase();
};

export const createSuggestion = asyncHandler(async (req, res) => {
  const { title, message, category } = req.body;

  if (!title || title.trim() === "") {
    throw new ApiError(400, "Title is required");
  }

  if (!message || message.trim() === "") {
    throw new ApiError(400, "Suggestion message is required");
  }

  const suggestion = await Suggestion.create({
    user: req.user._id,
    username: req.user.username,
    title: title.trim(),
    message: message.trim(),
    category: category || "Feature Request",
  });

  return res
    .status(201)
    .json(new ApiResponse(201, suggestion, "Suggestion submitted successfully"));
});

export const getSuggestions = asyncHandler(async (req, res) => {
  const adminUsername = getAdminUsername();
  if (req.user?.username?.toLowerCase() !== adminUsername) {
    throw new ApiError(403, "Access denied. Suggestions are only accessible by admin.");
  }

  const suggestions = await Suggestion.find()
    .sort({ createdAt: -1 })
    .populate("user", "username fullname");

  return res
    .status(200)
    .json(new ApiResponse(200, suggestions, "Suggestions retrieved successfully"));
});

export const updateSuggestionStatus = asyncHandler(async (req, res) => {
  const adminUsername = getAdminUsername();
  if (req.user?.username?.toLowerCase() !== adminUsername) {
    throw new ApiError(403, "Access denied. Only admin can update suggestion status.");
  }

  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["Pending", "Reviewed", "Resolved"];
  if (!status || !validStatuses.includes(status)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }

  const suggestion = await Suggestion.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  );

  if (!suggestion) {
    throw new ApiError(404, "Suggestion not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, suggestion, "Suggestion status updated successfully"));
});

export const deleteSuggestion = asyncHandler(async (req, res) => {
  const adminUsername = getAdminUsername();
  if (req.user?.username?.toLowerCase() !== adminUsername) {
    throw new ApiError(403, "Access denied. Only admin can delete suggestions.");
  }

  const { id } = req.params;

  const suggestion = await Suggestion.findByIdAndDelete(id);

  if (!suggestion) {
    throw new ApiError(404, "Suggestion not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Suggestion deleted successfully"));
});
