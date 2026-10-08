import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { JSON_BODY_LIMIT } from './config/constants.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(cookieParser());

const api = express.Router();

api.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Module routers are mounted here as each feature is built.

app.use('/api', api);

app.use(notFoundHandler);
app.use(errorHandler);
