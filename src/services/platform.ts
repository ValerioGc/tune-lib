/** The desktop systems the app is built for, plus whatever else it may be opened on. */
export type Platform = 'windows' | 'linux' | 'other';

/**
 * Which system the interface is running on.
 *
 * Read from the user agent of the webview rather than asked of the shell: it is needed
 * while a component is being drawn, and a round trip would leave the answer late.
 */
export function currentPlatform(): Platform {
  const agent = globalThis.navigator?.userAgent ?? '';

  if (/windows/iu.test(agent)) {
    return 'windows';
  }

  return /linux|x11/iu.test(agent) ? 'linux' : 'other';
}
