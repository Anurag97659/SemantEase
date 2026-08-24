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

const parseFreeDictionaryWord = (payload) => {
  const entry = Array.isArray(payload) ? payload[0] : null;
  if (!entry?.meanings) return null;

  const data = {
    definitions: [],
    examples: new Set(),
    synonyms: new Set(),
    antonyms: new Set(),
    definitionKeys: new Set(),
  };

  for (const meaning of entry.meanings) {
    const partOfSpeech = meaning.partOfSpeech || "definition";
    for (const item of meaning.definitions || []) {
      if (item.definition?.trim()) {
        const key = `${partOfSpeech}:${item.definition}`.toLowerCase();
        if (!data.definitionKeys.has(key)) {
          data.definitionKeys.add(key);
          data.definitions.push({ partOfSpeech, definition: item.definition.trim() });
        }
      }
      if (item.example?.trim()) data.examples.add(item.example.trim());
      for (const synonym of [...(meaning.synonyms || []), ...(item.synonyms || [])]) {
        if (synonym?.trim()) data.synonyms.add(synonym.trim());
      }
      for (const antonym of [...(meaning.antonyms || []), ...(item.antonyms || [])]) {
        if (antonym?.trim()) data.antonyms.add(antonym.trim());
      }
    }
  }

  if (!data.definitions.length) return null;

  return {
    phonetic: entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || "",
    definitions: data.definitions,
    examples: [...data.examples].slice(0, 3),
    synonyms: [...data.synonyms].slice(0, 5),
    antonyms: [...data.antonyms].slice(0, 5),
  };
};

const getFreeDictionaryWordDetails = async (cleanWord) => {
  const baseUrl = (process.env.FREE_DICTIONARY_API_BASE_URL || "https://api.dictionaryapi.dev/api/v2").replace(/\/$/, "");
  let response;
  try {
    response = await fetch(`${baseUrl}/entries/en/${encodeURIComponent(cleanWord)}`);
  } catch (error) {
    throw new ApiError(502, "Could not reach Free Dictionary. Please try again.");
  }

  if (response.status === 404) {
    throw new ApiError(404, "No Free Dictionary entry was found for this word.");
  }
  if (!response.ok) {
    throw new ApiError(502, `Free Dictionary lookup failed (${response.status}).`);
  }

  const parsedWord = parseFreeDictionaryWord(await response.json());
  if (!parsedWord) {
    throw new ApiError(404, "Free Dictionary did not return a definition for this word.");
  }

  return parsedWord;
};

const sourceNames = {
  "free-dictionary": "Free Dictionary",
  gemini: "Gemini",
};

const hasUsableDefinitions = (data) =>
  Array.isArray(data?.definitions) &&
  data.definitions.some(
    (item) =>
      typeof item?.partOfSpeech === "string" &&
      item.partOfSpeech.trim() &&
      typeof item?.definition === "string" &&
      item.definition.trim()
  );

const parseGeminiJson = (responseText) => {
  
  const jsonText = responseText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  return JSON.parse(jsonText);
};

const getGeminiWordDetails = async (cleanWord) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new ApiError(500, "GEMINI_API_KEY is not configured in backend environment variables");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const prompt = `Create a reliable vocabulary dictionary entry for the English term "${cleanWord}".
First decide whether it is a recognisable English word, established phrase, or idiom. If it is, generate the entry even if it is uncommon, inflected, or has more than one part of speech. Only return an error when it is clearly gibberish, a question, or not a dictionary term.

Return only a JSON object matching this structure:
{
  "phonetic": "IPA pronunciation, or an empty string when unavailable",
  "definitions": [
    {
      "partOfSpeech": "noun",
      "definition": "Clear, concise definition"
    }
  ],
  "synonyms": ["up to 5 synonyms"],
  "antonyms": ["up to 5 antonyms"],
  "examples": ["up to 3 complete sentence examples"]
}

Every definition must have a non-empty partOfSpeech and definition. All list fields must be arrays of strings. Do not include markdown or commentary.
For an invalid term, return only {"error":"Invalid input"}.`;

  let lastFailure;
  
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await model.generateContent(prompt);
      const generatedData = parseGeminiJson(result.response.text());

      if (generatedData?.error) {
        lastFailure = "invalid";
        continue;
      }
      if (hasUsableDefinitions(generatedData)) {
        return generatedData;
      }

      lastFailure = "invalid-format";
    } catch (error) {
      lastFailure = error;
      console.error(`Gemini dictionary attempt ${attempt + 1} failed:`, error);
    }
  }

  if (lastFailure === "invalid") {
    throw new ApiError(422, `Gemini could not find a dictionary entry for "${cleanWord}". Check the spelling and try again.`);
  }

  throw new ApiError(502, "Gemini could not generate the dictionary entry. Please try again.");
};

const createWord = asyncHandler(async (req, res) => {
  const { word, source = "gemini" } = req.body;
  
  const normalizedSource = source === "dictionary" ? "free-dictionary" : source;
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
  const cleanWord = word.trim().replace(/\s+/g, " ").toLowerCase();
  if (cleanWord.split(" ").length > 12) {
    throw new ApiError(400, "Phrase cannot contain more than 12 words");
 }
  const existingWord = await Word.findOne({ word: cleanWord });
  if (existingWord) {
    throw new ApiError(409, `Word "${cleanWord}" already exists in the dictionary`);
  }

  if (!Object.hasOwn(sourceNames, normalizedSource)) {
    throw new ApiError(400, "Source must be free-dictionary or gemini");
  }

  let generatedData;
  try {
    if (normalizedSource === "free-dictionary") {
      generatedData = await getFreeDictionaryWordDetails(cleanWord);
    } else {
      generatedData = await getGeminiWordDetails(cleanWord);
    }

    if (!hasUsableDefinitions(generatedData)) {
      throw new ApiError(500, `Invalid definitions format returned from ${sourceNames[normalizedSource]}`);
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
    if (error?.code === 11000) {
      throw new ApiError(409, `Word "${cleanWord}" already exists in the dictionary`);
    }
    throw new ApiError(500, `Error generating word details via ${sourceNames[normalizedSource]}: ${error.message}`);
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
