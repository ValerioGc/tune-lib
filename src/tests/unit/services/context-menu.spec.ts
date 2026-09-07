import { describe, expect, it } from 'vitest';

import { silenceWebviewMenu } from '@/services/context-menu';

function rightClick(target: EventTarget): MouseEvent {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  target.dispatchEvent(event);

  return event;
}

describe('silenceWebviewMenu', () => {
  it('keeps the browser menu from opening', () => {
    const stop = silenceWebviewMenu();

    expect(rightClick(document.body).defaultPrevented).toBe(true);

    stop();
  });

  it('gives the menu back once it is stopped', () => {
    const stop = silenceWebviewMenu();
    stop();

    expect(rightClick(document.body).defaultPrevented).toBe(false);
  });

  it('leaves a menu of the app alone, since that one stops the event first', () => {
    const stop = silenceWebviewMenu();
    const row = document.createElement('div');
    document.body.append(row);
    let opened = false;

    row.addEventListener('contextmenu', (event) => {
      opened = true;
      event.preventDefault();
      event.stopPropagation();
    });

    expect(rightClick(row).defaultPrevented).toBe(true);
    expect(opened).toBe(true);

    row.remove();
    stop();
  });
});
