import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { matchmakingRouter } from './matchmaking/routes';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

app.use(cors());
app.use(express.json({ limit: '8kb' }));

app.use('/api/matches', matchmakingRouter);
app.use('/api/v1/matches', matchmakingRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});
