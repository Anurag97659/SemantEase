import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/user.routes.js';
import wordRoutes from './routes/word.routes.js';
import personalNoteRoutes from './routes/personalNote.routes.js';
import suggestionRoutes from './routes/suggestion.routes.js';

const app = express();

// const allowedOrigins = ['http://localhost:3000'];

// app.use(
//   cors({
//     origin: (origin, callback) => {
//       if (allowedOrigins.includes(origin) || !origin) {
//         callback(null, true);
//       } else {
//         callback(new Error('Not allowed by CORS'));
//       }
//     },
//     credentials: true,
//   })
// );
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(",") 
  : ["http://localhost:3000","https://woahcab.onrender.com","https://lexiconic.onrender.com","https://lexiconic.anuragnidhi.tech"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cookieParser());

app.use('/WoahCab/users',userRoutes);
app.use('/WoahCab/words',wordRoutes);
app.use('/WoahCab/notes', personalNoteRoutes);
app.use('/WoahCab/suggestions', suggestionRoutes);


app.use((err, req, res, next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Something went wrong on the server";
  
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: err.errors || []
  });
});

export default app;
