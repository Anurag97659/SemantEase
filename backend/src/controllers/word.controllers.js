import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Word } from "../models/word.model.js";
import { User } from "../models/user.model.js";
import { GoogleGenerativeAI } from "@google/generative-ai";


const formatWordForViewer = (word, userId) => {
  const wordObject = word.toObject ? word.toObject() : word;
  const { notes = [], starredBy = [], ...safeWord } = wordObject;
  const isStarred = Boolean(
    userId && starredBy.some((starredUserId) => starredUserId.toString() === userId.toString())
  );

  if (!userId) {
    return { ...safeWord, isStarred };
  }

  const viewerNote = notes.find((note) => note.user?.toString() === userId.toString());
  return viewerNote
    ? { ...safeWord, isStarred, note: viewerNote.content }
    : { ...safeWord, isStarred };
};

const createWord = asyncHandler(async (req, res) => {
  const { word } = req.body;
  const userId = req.user._id;

  if (!word || word.trim() === "") {
    throw new ApiError(400, "Word is required");
  }
  if(word.trim().length < 2){
    throw new ApiError(400, "Word must be at least 2 characters long");
  }
  if(word.trim().length > 45){
    throw new ApiError(400, "Word cannot be longer than 45 characters");
  }
  if (!/^[a-zA-Z\s']+$/.test(word.trim())) {
    throw new ApiError(400, "Word must contain only alphabetic characters");
  }
  const cleanWord = word.trim().toLowerCase();
  if (cleanWord.split(" ").length > 12) {
    throw new ApiError(400, "Phrase cannot contain more than 12 words");
 }
  const existingWord = await Word.findOne({ word: cleanWord });
  if (existingWord) {
    throw new ApiError(409, "Word already exists in the database");
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError(500, "GEMINI_API_KEY is not configured in backend environment variables");
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Generate a vocabulary dictionary entry for the English word "${cleanWord}". 
Return a JSON object matching this exact structure:
{
  "phonetic": "Phonetic transcription of the word in IPA format",
  "definitions": [
    {
      "partOfSpeech": "noun" (or "adverb", "adjective", "verb", etc.),
      "definition": "Clear Google-style definition"
    }
  ],
  "synonyms": ["up to 5 synonyms"],
  "antonyms": ["up to 5 antonyms"],
  "examples": ["exactly 3 sentence examples showing usage of the word"]
}
only allow dictionary entries for real English words and a valid phrase or idioms, if user types random prompts or gibberish, aur ask questions or anything which is not a valid word or idiom, like "What is the meaning of life?" or "How to make a cake? or tell me your name ", check it accurately and only passed the valid words or idioms to the dictionary entry generator, if the input is invalid,
return a JSON object with the following structure:
{"error": "Invalid input or unable to generate dictionary entry"}
Provide definitions for different parts of speech if applicable (e.g. noun, adjective, adverb). Ensure all list fields are array of strings. Do not include any markdown styling like \`\`\`json. Return only the JSON object.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let generatedData;
    try {
      generatedData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Gemini raw response:", responseText);
      console.error("Parse error details:", parseError);
      throw new ApiError(500, "Failed to parse dictionary response from Gemini");
    }
    if (generatedData.error) {
      throw new ApiError(400, `Gemini error: ${generatedData.error}`);
    }
    if (!generatedData.definitions || !Array.isArray(generatedData.definitions)) {
      throw new ApiError(500, "Invalid definitions format returned from Gemini");
    }

    const newWord = await Word.create({
      word: cleanWord,
      phonetic: generatedData.phonetic || "",
      definitions: generatedData.definitions,
      synonyms: generatedData.synonyms || [],
      antonyms: generatedData.antonyms || [],
      examples: generatedData.examples || [],
      createdBy: userId
    });

    res.status(201).json(new ApiResponse(201, formatWordForViewer(newWord, userId), "Word created successfully"));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Error generating word details via Gemini: ${error.message}`);
  }
});

const getWords = asyncHandler(async (req, res) => {
  const words = await Word.find().populate("createdBy", "username fullname");
  const wordsForViewer = words.map((word) => formatWordForViewer(word, req.user?._id));
  res.status(200).json(new ApiResponse(200, wordsForViewer, "Words retrieved successfully"));
});

const getWordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const word = await Word.findById(id).populate("createdBy", "username fullname");

  if (!word) {
    throw new ApiError(404, "Word not found");
  }

  res.status(200).json(new ApiResponse(200, formatWordForViewer(word, req.user?._id), "Word retrieved successfully"));
});

const updateWord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { word, definitions, examples, synonyms, antonyms } = req.body;

  const updatedWord = await Word.findByIdAndUpdate(
    id,
    { word, definitions, examples, synonyms, antonyms },
    { new: true }
  );

  if (!updatedWord) {
    throw new ApiError(404, "Word not found");
  }

  res.status(200).json(new ApiResponse(200, formatWordForViewer(updatedWord, req.user?._id), "Word updated successfully"));
});

const saveNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  if (typeof note !== "string" || !note.trim()) {
    throw new ApiError(400, "Note cannot be empty");
  }
  if (note.trim().length > 1000) {
    throw new ApiError(400, "Note cannot be longer than 1000 characters");
  }

  const word = await Word.findById(id);
  if (!word) {
    throw new ApiError(404, "Word not found");
  }

  const cleanNote = note.trim();
  const existingNote = word.notes.find((wordNote) => wordNote.user.toString() === req.user._id.toString());

  if (existingNote) {
    existingNote.content = cleanNote;
  } else {
    word.notes.push({ user: req.user._id, content: cleanNote });
  }

  await word.save();
  await word.populate("createdBy", "username fullname");
  res.status(200).json(new ApiResponse(200, formatWordForViewer(word, req.user._id), "Note saved successfully"));
});

const deleteNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const word = await Word.findById(id);

  if (!word) {
    throw new ApiError(404, "Word not found");
  }

  const noteIndex = word.notes.findIndex(
    (wordNote) => wordNote.user.toString() === req.user._id.toString()
  );

  if (noteIndex === -1) {
    throw new ApiError(404, "Note not found");
  }

  word.notes.splice(noteIndex, 1);
  await word.save();
  await word.populate("createdBy", "username fullname");
  res.status(200).json(new ApiResponse(200, formatWordForViewer(word, req.user._id), "Note deleted successfully"));
});

const toggleWordStar = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const word = await Word.findById(id);

  if (!word) {
    throw new ApiError(404, "Word not found");
  }

  const userId = req.user._id;
  const existingStarIndex = word.starredBy.findIndex(
    (starredUserId) => starredUserId.toString() === userId.toString()
  );

  if (existingStarIndex === -1) {
    word.starredBy.push(userId);
  } else {
    word.starredBy.splice(existingStarIndex, 1);
  }

  await word.save();
  await word.populate("createdBy", "username fullname");

  const isStarred = existingStarIndex === -1;
  res.status(200).json(
    new ApiResponse(
      200,
      formatWordForViewer(word, userId),
      isStarred ? "Word marked as important" : "Word removed from important words"
    )
  );
});

const deleteWord = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const word = await Word.findById(id);

  if (!word) {
    throw new ApiError(404, "Word not found");
  }

  if (word.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You do not have permission to delete this word");
  }

  await Word.findByIdAndDelete(id);

  res.status(200).json(new ApiResponse(200, word, "Word deleted successfully"));
});

const searchWords = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || !q.trim()) {
    throw new ApiError(400, "Query parameter is required");
  }

  const words = await Word.find().populate("createdBy", "username fullname");

  if (words.length === 0) {
    return res.status(200).json(new ApiResponse(200, [], "No words in database"));
  }

  const compactWords = words.map(w => ({
    id: w._id.toString(),
    word: w.word,
    definitions: w.definitions.map(d => `${d.partOfSpeech}: ${d.definition}`),
    synonyms: w.synonyms,
    antonyms: w.antonyms
  }));

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `You are a semantic search engine for a user's vocabulary list.
Find the words in the vocabulary bank that are semantically related or match the user query.
Sort the matches by relevance.

User Search Query: "${q}"

Vocabulary Bank:
${JSON.stringify(compactWords)}

Return a JSON array of matching word IDs (strings) from the vocabulary bank. If no words are related, return an empty array []. Do not include markdown styling like \`\`\`json.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let matchedIds = [];
    try {
      matchedIds = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse search matches:", responseText, parseError);
    }

    if (!Array.isArray(matchedIds)) {
      matchedIds = [];
    }

    const matchedWords = matchedIds
      .map(id => words.find(w => w._id.toString() === id))
      .filter(Boolean);

    const wordsForViewer = matchedWords.map((word) => formatWordForViewer(word, req.user?._id));
    res.status(200).json(new ApiResponse(200, wordsForViewer, "Semantic search completed"));
  } catch (error) {
    console.error("Semantic search failed:", error);
    const query = q.toLowerCase();
    const fallbackWords = words.filter(item => {
      const wordMatch = item.word.toLowerCase().includes(query);
      const definitionMatch = item.definitions.some(d =>
        d.definition.toLowerCase().includes(query)
      );
      const posMatch = item.definitions.some(d =>
        d.partOfSpeech.toLowerCase().includes(query)
      );
      return wordMatch || definitionMatch || posMatch;
    });
    const wordsForViewer = fallbackWords.map((word) => formatWordForViewer(word, req.user?._id));
    res.status(200).json(new ApiResponse(200, wordsForViewer, "Semantic search fallback completed"));
  }
});

const generateTest = asyncHandler(async (req, res) => {
  const words = await Word.find();

  if (words.length === 0) {
    throw new ApiError(400, "No words found in the database. Please add some words first to generate a test.");
  }

  const shuffled = words.sort(() => 0.5 - Math.random());
  const selectedWords = shuffled.slice(0, 30);

  const compactWords = selectedWords.map(w => ({
    word: w.word,
    definitions: w.definitions.map(d => `${d.partOfSpeech}: ${d.definition}`),
    synonyms: w.synonyms,
    antonyms: w.antonyms,
    examples: w.examples
  }));

  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError(500, "GEMINI_API_KEY is not configured in backend environment variables");
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `You are an expert test generator creating a competitive English vocabulary exam.
Generate exactly 30 multiple-choice questions (MCQs) based on the following list of vocabulary words:
${JSON.stringify(compactWords)}

Guidelines:
1. Question levels must target competitive exams like AFCAT, CDS, and other advanced competitive tests.
2. The questions themselves MUST be based on the provided vocabulary words (e.g. asking about meanings, synonyms, antonyms, cloze test, most appropriate use, fill-in-the-blanks, or correct usage of these words).
3. The options (A, B, C, D) must be independent of the database words (i.e. they can be any plausible words/phrases, not just other words from the database).
4. Each question must have exactly 4 options labeled starting with "A. ", "B. ", "C. ", "D. ".
5. Identify the correct answer option by its label letter ('A', 'B', 'C', or 'D').
6. Generate exactly 30 questions. If there are fewer than 30 words provided, you can generate multiple questions for some words to reach the 30 question count.
7. Question should be high-quality, clear, and unambiguous, suitable for competitive exams. Avoid any vague or overly complex phrasing.
8. Return a JSON array matching this exact schema:
[
  {
    "question": "A complete sentence or question asking about a word or its usage, e.g., 'What is the synonym of ...' or 'Choose the correct word to fill in the blank: ...'",
    "level": "AFCAT/CDS/Competitive Level",
    "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
    "correctAnswer": "A" // Must be one of "A", "B", "C", "D"
  }
]

Do not include any markdown formatting like \`\`\`json. Return only the JSON array.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let questions = [];
    try {
      questions = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Gemini test generation raw response:", responseText);
      throw new ApiError(500, "Failed to parse test questions generated by Gemini");
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new ApiError(500, "Invalid format or empty questions generated by Gemini");
    }

    res.status(200).json(new ApiResponse(200, questions, "Test generated successfully"));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, `Error generating test: ${error.message}`);
  }
});

export {
  createWord,
  getWords,
  getWordById,
  updateWord,
  saveNote,
  deleteNote,
  toggleWordStar,
  deleteWord,
  searchWords,
  generateTest
};
