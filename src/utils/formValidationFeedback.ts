/**
 * Makes a blocked form submission visible.
 *
 * When a form fails native HTML validation the browser cancels the submit and
 * shows its own tooltip beside the first invalid field. That tooltip is not in
 * the DOM, cannot be styled, names one field at a time, and — the part that
 * actually hurts — is invisible if the field is scrolled out of view. On a long
 * form the user clicks the submit button, sees nothing happen anywhere near it,
 * and reasonably concludes the button is broken. An interaction audit of the
 * dashboard reported exactly that: controls that looked completely dead.
 *
 * The browser fires a non-bubbling `invalid` event on every field it rejects,
 * so one capture-phase listener covers every form in the application without
 * touching any of them. This deliberately does not disable native validation:
 * removing it from a form whose handler does not re-check the same fields would
 * let bad data through, which is far worse than a poor message.
 */
const FOCUS_DELAY_MS = 60;

let installed = false;

export const installFormValidationFeedback = () => {
  if (installed || typeof document === 'undefined') {
    return;
  }
  installed = true;

  let pending: number | null = null;

  document.addEventListener(
    'invalid',
    (event) => {
      const field = event.target as HTMLElement | null;
      if (!field || typeof field.scrollIntoView !== 'function') {
        return;
      }

      /**
       * Only the first invalid field in a submission gets the treatment.
       *
       * The browser fires this once per rejected field, so without the guard a
       * form with four empty fields would scroll four times in a row and land
       * on the last one — the opposite of helpful.
       */
      if (pending !== null) {
        return;
      }

      pending = window.setTimeout(() => {
        pending = null;
      }, 250);

      window.setTimeout(() => {
        field.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // Focus after the scroll starts, so the browser anchors its tooltip to
        // the field's resting position rather than where it began.
        window.setTimeout(() => {
          (field as HTMLInputElement).focus?.({ preventScroll: true });
        }, FOCUS_DELAY_MS);
      }, 0);
    },
    // Capture, because `invalid` does not bubble.
    true
  );
};
