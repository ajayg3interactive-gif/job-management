import { setupServer } from 'msw/node';

export const API = 'http://localhost:4000/api';

// Each test registers the handlers it needs with server.use(...).
export const server = setupServer();
