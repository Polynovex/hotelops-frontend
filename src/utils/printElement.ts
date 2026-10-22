/**
 * Prints one element on its own.
 *
 * Printing the app page and hiding everything else does not survive the app
 * layout (a fixed sidebar and a scrolling main area), which printed a blank or
 * clipped page. This copies the element and the page's styles into a hidden
 * frame and prints that, so the printout is exactly the element.
 */
export const printElement = (elementId: string, title = document.title) => {
  const source = document.getElementById(elementId);
  if (!source) return false;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }

  // Emotion (MUI) styles live in <style> tags; stylesheet links are copied too.
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n');

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>${styles}
<style>
  @page { margin: 12mm; }
  html, body { background: #fff !important; color: #111 !important; margin: 0; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .print-root { box-shadow: none !important; border: none !important; }
  /* Plain black on white, whatever theme the app is in. */
  .print-root, .print-root * { color: #111 !important; background-color: transparent !important; box-shadow: none !important; }
  .print-root table { border-collapse: collapse; width: 100%; }
  .print-root td, .print-root th { border-bottom: 1px solid #ccc !important; }
</style></head><body><div class="print-root">${source.outerHTML}</div></body></html>`);
  doc.close();

  const finish = () => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
  };
  // Give images (the hotel logo) a moment to load.
  if (doc.readyState === 'complete') setTimeout(finish, 250);
  else frame.onload = () => setTimeout(finish, 250);
  return true;
};
