import mongoose from "mongoose";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { User } from "../models/user.model.js";
import { Word } from "../models/word.model.js";
import { Blend } from "../models/blend.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const formatWordForViewer = (word, userId) => {
  const wordObject = word.toObject ? word.toObject() : word;
  const { notes = [], starredBy = [], ...safeWord } = wordObject;
  const isStarred = Boolean(
    userId &&
      starredBy.some(
        (starredUserId) => starredUserId.toString() === userId.toString()
      )
  );

  if (!userId) {
    return { ...safeWord, isStarred };
  }

  const viewerNote = notes.find(
    (note) => note.user?.toString() === userId.toString()
  );
  return viewerNote
    ? { ...safeWord, isStarred, note: viewerNote.content }
    : { ...safeWord, isStarred };
};

const formatBlendWordForViewer = (word, userId) => {
  const wordObject = word.toObject ? word.toObject() : word;
  const { notes = [], starredBy = [], ...safeWord } = wordObject;
  const isStarred = Boolean(
    userId &&
      starredBy.some(
        (starredUserId) => starredUserId.toString() === userId.toString()
      )
  );
  const ownerNote = notes.find(
    (note) => note.user?.toString() === wordObject.createdBy?._id?.toString()
  );

  return ownerNote
    ? { ...safeWord, isStarred, note: ownerNote.content }
    : { ...safeWord, isStarred };
};

const toUserCard = (user) => ({
  _id: user._id,
  username: user.username,
  fullname: user.fullname,
});

const getSocialOverview = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("friends", "username fullname")
    .populate("incomingFriendRequests", "username fullname")
    .populate("outgoingFriendRequests", "username fullname");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const blends = await Blend.find({ members: user._id })
    .populate("members", "username fullname")
    .sort({ createdAt: -1 });

  const blendCards = blends.map((blend) => ({
    _id: blend._id,
    members: (blend.members || []).map((member) => toUserCard(member)),
    title: (blend.members || []).map((member) => member.username).join(" + "),
    createdAt: blend.createdAt,
  }));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        friends: (user.friends || []).map((friend) => toUserCard(friend)),
        incomingRequests: (user.incomingFriendRequests || []).map((requester) =>
          toUserCard(requester)
        ),
        outgoingRequests: (user.outgoingFriendRequests || []).map((target) =>
          toUserCard(target)
        ),
        blends: blendCards,
      },
      "Social overview fetched successfully"
    )
  );
});

const searchUsers = asyncHandler(async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!query) {
    throw new ApiError(400, "Search query is required");
  }

  const currentUser = await User.findById(req.user._id).select(
    "friends incomingFriendRequests outgoingFriendRequests"
  );
  if (!currentUser) {
    throw new ApiError(404, "User not found");
  }

  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [
      { username: { $regex: query, $options: "i" } },
      { fullname: { $regex: query, $options: "i" } },
    ],
  })
    .select("username fullname")
    .limit(20);

  const friendIds = new Set((currentUser.friends || []).map((id) => id.toString()));
  const incomingIds = new Set(
    (currentUser.incomingFriendRequests || []).map((id) => id.toString())
  );
  const outgoingIds = new Set(
    (currentUser.outgoingFriendRequests || []).map((id) => id.toString())
  );

  const result = users.map((user) => {
    const userId = user._id.toString();
    let status = "none";
    if (friendIds.has(userId)) status = "friend";
    else if (outgoingIds.has(userId)) status = "requested";
    else if (incomingIds.has(userId)) status = "incoming_request";

    return {
      _id: user._id,
      username: user.username,
      fullname: user.fullname,
      status,
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Users fetched successfully"));
});

const sendFriendRequest = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    throw new ApiError(400, "Target user ID is required");
  }
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid target user ID");
  }

  if (userId === req.user._id.toString()) {
    throw new ApiError(400, "You cannot send a friend request to yourself");
  }

  const [currentUser, targetUser] = await Promise.all([
    User.findById(req.user._id),
    User.findById(userId),
  ]);

  if (!currentUser || !targetUser) {
    throw new ApiError(404, "User not found");
  }

  const currentId = currentUser._id.toString();
  const targetId = targetUser._id.toString();

  if ((currentUser.friends || []).some((id) => id.toString() === targetId)) {
    throw new ApiError(409, "You are already friends with this user");
  }

  if (
    (currentUser.outgoingFriendRequests || []).some(
      (id) => id.toString() === targetId
    )
  ) {
    throw new ApiError(409, "Friend request already sent");
  }

  if (
    (currentUser.incomingFriendRequests || []).some(
      (id) => id.toString() === targetId
    )
  ) {
    throw new ApiError(
      409,
      "This user has already requested you. Accept from Requests."
    );
  }

  currentUser.outgoingFriendRequests.push(targetUser._id);
  targetUser.incomingFriendRequests.push(currentUser._id);

  await Promise.all([currentUser.save(), targetUser.save()]);

  return res
    .status(200)
    .json(new ApiResponse(200, { requesterId: currentId, targetId }, "Friend request sent"));
});

const acceptFriendRequest = asyncHandler(async (req, res) => {
  const { requesterId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(requesterId)) {
    throw new ApiError(400, "Invalid requester ID");
  }

  const [currentUser, requester] = await Promise.all([
    User.findById(req.user._id),
    User.findById(requesterId),
  ]);

  if (!currentUser || !requester) {
    throw new ApiError(404, "User not found");
  }

  const currentUserId = currentUser._id.toString();
  const requesterUserId = requester._id.toString();
  const incomingRequestExists = (currentUser.incomingFriendRequests || []).some(
    (id) => id.toString() === requesterUserId
  );

  if (!incomingRequestExists) {
    throw new ApiError(404, "No incoming request from this user");
  }

  currentUser.incomingFriendRequests = (currentUser.incomingFriendRequests || []).filter(
    (id) => id.toString() !== requesterUserId
  );
  requester.outgoingFriendRequests = (requester.outgoingFriendRequests || []).filter(
    (id) => id.toString() !== currentUserId
  );

  if (!(currentUser.friends || []).some((id) => id.toString() === requesterUserId)) {
    currentUser.friends.push(requester._id);
  }
  if (!(requester.friends || []).some((id) => id.toString() === currentUserId)) {
    requester.friends.push(currentUser._id);
  }

  await Promise.all([currentUser.save(), requester.save()]);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Friend request accepted"));
});

const rejectFriendRequest = asyncHandler(async (req, res) => {
  const { requesterId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(requesterId)) {
    throw new ApiError(400, "Invalid requester ID");
  }

  const [currentUser, requester] = await Promise.all([
    User.findById(req.user._id),
    User.findById(requesterId),
  ]);

  if (!currentUser || !requester) {
    throw new ApiError(404, "User not found");
  }

  const currentUserId = currentUser._id.toString();
  const requesterUserId = requester._id.toString();
  const incomingRequestExists = (currentUser.incomingFriendRequests || []).some(
    (id) => id.toString() === requesterUserId
  );

  if (!incomingRequestExists) {
    throw new ApiError(404, "No incoming request from this user");
  }

  currentUser.incomingFriendRequests = (currentUser.incomingFriendRequests || []).filter(
    (id) => id.toString() !== requesterUserId
  );
  requester.outgoingFriendRequests = (requester.outgoingFriendRequests || []).filter(
    (id) => id.toString() !== currentUserId
  );

  await Promise.all([currentUser.save(), requester.save()]);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Friend request rejected"));
});

const createBlend = asyncHandler(async (req, res) => {
  const memberIds = req.body.memberIds;
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw new ApiError(400, "At least one friend must be selected");
  }

  const currentUser = await User.findById(req.user._id).select("friends");
  if (!currentUser) {
    throw new ApiError(404, "User not found");
  }

  const friendIdSet = new Set((currentUser.friends || []).map((id) => id.toString()));
  const normalizedIds = Array.from(new Set(memberIds.map((id) => String(id).trim())));

  if (
    normalizedIds.some(
      (id) => !mongoose.Types.ObjectId.isValid(id) || !friendIdSet.has(id)
    )
  ) {
    throw new ApiError(400, "Only existing friends can be added to a blend");
  }

  const allMemberIds = Array.from(
    new Set([req.user._id.toString(), ...normalizedIds])
  );
  if (allMemberIds.length < 2) {
    throw new ApiError(400, "A blend needs at least two unique members");
  }

  const sortedSignature = [...allMemberIds].sort().join(":");
  const existingBlends = await Blend.find({ members: { $all: allMemberIds } });
  const exactBlend = existingBlends.find((blend) => {
    const signature = (blend.members || []).map((id) => id.toString()).sort().join(":");
    return signature === sortedSignature;
  });

  if (exactBlend) {
    throw new ApiError(409, "This blend already exists");
  }

  const blend = await Blend.create({
    members: allMemberIds,
    createdBy: req.user._id,
  });

  await blend.populate("members", "username fullname");
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        _id: blend._id,
        members: blend.members.map((member) => toUserCard(member)),
        title: blend.members.map((member) => member.username).join(" + "),
      },
      "Blend created successfully"
    )
  );
});

const getBlendById = asyncHandler(async (req, res) => {
  const { blendId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(blendId)) {
    throw new ApiError(400, "Invalid blend ID");
  }

  const blend = await Blend.findById(blendId).populate("members", "username fullname");
  if (!blend) {
    throw new ApiError(404, "Blend not found");
  }

  const isMember = (blend.members || []).some(
    (member) => member._id.toString() === req.user._id.toString()
  );
  if (!isMember) {
    throw new ApiError(403, "You are not a member of this blend");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        _id: blend._id,
        members: (blend.members || []).map((member) => toUserCard(member)),
        title: (blend.members || []).map((member) => member.username).join(" + "),
        createdAt: blend.createdAt,
      },
      "Blend details fetched successfully"
    )
  );
});

const deleteBlend = asyncHandler(async (req, res) => {
  const { blendId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(blendId)) {
    throw new ApiError(400, "Invalid blend ID");
  }

  const blend = await Blend.findById(blendId);
  if (!blend) {
    throw new ApiError(404, "Blend not found");
  }

  const isMember = (blend.members || []).some(
    (memberId) => memberId.toString() === req.user._id.toString()
  );
  if (!isMember) {
    throw new ApiError(403, "You are not a member of this blend");
  }

  await Blend.findByIdAndDelete(blendId);
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Blend deleted successfully"));
});

const getBlendWords = asyncHandler(async (req, res) => {
  const { blendId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(blendId)) {
    throw new ApiError(400, "Invalid blend ID");
  }

  const blend = await Blend.findById(blendId);
  if (!blend) {
    throw new ApiError(404, "Blend not found");
  }

  const viewerId = req.user._id.toString();
  const isMember = (blend.members || []).some((memberId) => memberId.toString() === viewerId);
  if (!isMember) {
    throw new ApiError(403, "You are not a member of this blend");
  }

  const words = await Word.find({ createdBy: { $in: blend.members } })
    .populate("createdBy", "username fullname")
    .sort({ createdAt: -1 });

  const wordsForViewer = words.map((word) =>
    formatBlendWordForViewer(word, req.user._id)
  );
  return res
    .status(200)
    .json(new ApiResponse(200, wordsForViewer, "Blend words fetched successfully"));
});

const searchBlendWords = asyncHandler(async (req, res) => {
  const { blendId } = req.params;
  const queryText = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!mongoose.Types.ObjectId.isValid(blendId)) {
    throw new ApiError(400, "Invalid blend ID");
  }
  if (!queryText) {
    throw new ApiError(400, "Query parameter is required");
  }

  const blend = await Blend.findById(blendId);
  if (!blend) {
    throw new ApiError(404, "Blend not found");
  }

  const viewerId = req.user._id.toString();
  const isMember = (blend.members || []).some((memberId) => memberId.toString() === viewerId);
  if (!isMember) {
    throw new ApiError(403, "You are not a member of this blend");
  }

  const words = await Word.find({ createdBy: { $in: blend.members } }).populate(
    "createdBy",
    "username fullname"
  );

  if (words.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], "No words in this blend"));
  }

  const compactWords = words.map((word) => ({
    id: word._id.toString(),
    word: word.word,
    definitions: word.definitions.map(
      (definition) => `${definition.partOfSpeech}: ${definition.definition}`
    ),
    synonyms: word.synonyms,
    antonyms: word.antonyms,
  }));

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured");
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `You are a semantic search engine for a vocabulary list.
Find relevant words for this query and return only matching IDs sorted by relevance.

Query: "${queryText}"
Vocabulary bank:
${JSON.stringify(compactWords)}

Return only a JSON array of IDs like ["id1","id2"].`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    let matchedIds = [];
    try {
      matchedIds = JSON.parse(responseText);
    } catch (_error) {
      matchedIds = [];
    }
    if (!Array.isArray(matchedIds)) {
      matchedIds = [];
    }

    const matchedWords = matchedIds
      .map((id) => words.find((word) => word._id.toString() === id))
      .filter(Boolean);
    const wordsForViewer = matchedWords.map((word) =>
      formatBlendWordForViewer(word, req.user._id)
    );

    return res
      .status(200)
      .json(new ApiResponse(200, wordsForViewer, "Blend semantic search completed"));
  } catch (_error) {
    const query = queryText.toLowerCase();
    const fallback = words.filter((item) => {
      const wordMatch = item.word.toLowerCase().includes(query);
      const definitionMatch = item.definitions.some((definition) =>
        definition.definition.toLowerCase().includes(query)
      );
      const posMatch = item.definitions.some((definition) =>
        definition.partOfSpeech.toLowerCase().includes(query)
      );
      return wordMatch || definitionMatch || posMatch;
    });
    const wordsForViewer = fallback.map((word) =>
      formatBlendWordForViewer(word, req.user._id)
    );
    return res
      .status(200)
      .json(new ApiResponse(200, wordsForViewer, "Blend search fallback completed"));
  }
});

export {
  getSocialOverview,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  createBlend,
  getBlendById,
  deleteBlend,
  getBlendWords,
  searchBlendWords,
};
