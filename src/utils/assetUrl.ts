/**
 * URL of a file in /public that works on the web and in the desktop app.
 *
 * The desktop app loads index.html from disk and then changes the path with
 * the router, so a relative path ("./logo.png") would resolve against the
 * route, not the app folder. The folder is captured once, when this module
 * loads, before any navigation.
 */
const base =
  import.meta.env.BASE_URL === './' && typeof window !== 'undefined'
    ? new URL('.', window.location.href).href
    : import.meta.env.BASE_URL;

export const assetUrl = (name: string) => `${base}${name}`;
