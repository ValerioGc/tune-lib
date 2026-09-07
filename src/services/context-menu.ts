/**
 * The webview brings a menu of its own — back, reload, save as, print — and the right button
 * opens it anywhere the app has not claimed it. Those are the commands of a browser: reload
 * throws away what is on screen and save as offers to write the page to disk, neither of
 * which means anything in a music library.
 *
 * Only the packaged app is silenced: in development that menu is the way to the inspector.
 * What the app itself puts on the right button — the actions menu of a track row — stops the
 * event before it reaches here, so it keeps working either way.
 */
export function silenceWebviewMenu(target: EventTarget = document): () => void {
  const silence = (event: Event) => event.preventDefault();

  target.addEventListener('contextmenu', silence);

  return () => target.removeEventListener('contextmenu', silence);
}
