import { useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { getApiErrorMessage, getApiErrorCode, getApiErrorStatus } from '../utils/apiError';

/**
 * One way to report a failed request.
 *
 * Handlers around the app each assembled their own message, and most reached
 * for the wrong field — showing the bare code `PIN_NOT_SET`, or axios's
 * "Request failed with status code 409", instead of the sentence the server
 * wrote for exactly this case.
 *
 *   const { reportError, reportSuccess } = useApiError();
 *   try { await save(); reportSuccess('Saved'); }
 *   catch (err) { reportError(err, 'Could not save'); }
 *
 * The fallback is used only when the server sent nothing usable, so it should
 * describe the attempted action rather than restate that an error occurred.
 */
export const useApiError = () => {
  const { enqueueSnackbar } = useSnackbar();

  const reportError = useCallback(
    (err: unknown, fallback = 'Something went wrong') => {
      const message = getApiErrorMessage(err, fallback);
      const status = getApiErrorStatus(err);

      /**
       * 401 is handled by the interceptor, which signs the user out and
       * redirects. A toast on top of that would flash and vanish with the page,
       * so it is skipped.
       */
      if (status === 401) {
        return message;
      }

      enqueueSnackbar(message, {
        variant: 'error',
        // Long enough to read a full sentence, and dismissible — an error the
        // user cannot re-read is barely better than none.
        autoHideDuration: 6000
      });

      return message;
    },
    [enqueueSnackbar]
  );

  const reportSuccess = useCallback(
    (message: string) => {
      enqueueSnackbar(message, { variant: 'success', autoHideDuration: 3000 });
    },
    [enqueueSnackbar]
  );

  const reportWarning = useCallback(
    (message: string) => {
      enqueueSnackbar(message, { variant: 'warning', autoHideDuration: 5000 });
    },
    [enqueueSnackbar]
  );

  return { reportError, reportSuccess, reportWarning, getApiErrorCode };
};
