import type { SerializedError } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { ApiErrorBody, ApiErrorDetail } from '../types/auth';

export interface ParsedApiError {
  message: string;
  details: ApiErrorDetail[];
}

const isApiErrorBody = (data: unknown): data is ApiErrorBody =>
  typeof data === 'object' &&
  data !== null &&
  'error' in data &&
  typeof (data as ApiErrorBody).error?.message === 'string';

// Turns an RTK Query error into a message and field-level details for forms.
export function parseApiError(error: FetchBaseQueryError | SerializedError | undefined): ParsedApiError {
  if (error && 'status' in error) {
    if (isApiErrorBody(error.data)) {
      return { message: error.data.error.message, details: error.data.error.details ?? [] };
    }
    if (error.status === 'FETCH_ERROR') {
      return { message: 'Could not reach the server. Please try again.', details: [] };
    }
  }
  return { message: 'Something went wrong. Please try again.', details: [] };
}
