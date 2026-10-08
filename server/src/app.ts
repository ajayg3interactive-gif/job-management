import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

export const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
