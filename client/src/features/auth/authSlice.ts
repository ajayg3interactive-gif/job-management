import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuthUser } from '../../types/auth';

// 'unknown' until GET /auth/me has answered, so a refresh does not flash the login page.
export type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
}

const initialState: AuthState = { user: null, status: 'unknown' };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload;
      state.status = 'authenticated';
    },
    clearAuth(state) {
      state.user = null;
      state.status = 'unauthenticated';
    },
  },
});

export const { setUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;
