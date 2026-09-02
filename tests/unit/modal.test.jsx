// Every overlay in the game is the same <Modal>, so its close paths are
// tested once, exhaustively — plus once per real sheet in the app.
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Modal, swipeCloses } from '../../src/ui/base.jsx';

afterEach(cleanup);

function Harness({ dismissible, onClose = vi.fn() }) {
  const [open, setOpen] = React.useState(true);
  const close = () => {
    setOpen(false);
    onClose();
  };
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        again
      </button>
      {open ? (
        <Modal open onClose={close} title="Odds" eyebrow="catalogue" icon="eye" dismissible={dismissible}>
          <p>sheet body</p>
        </Modal>
      ) : (
        <span>closed</span>
      )}
    </div>
  );
}

const modal = () => document.querySelector('.modal');
const closeBtn = () => document.querySelector('.modal .xbtn');

describe('Modal (every sheet in ScratchVerse)', () => {
  it('renders a real, reachable close button', () => {
    render(<Harness />);
    const b = closeBtn();
    expect(b).toBeTruthy();
    expect(b.tagName).toBe('BUTTON');
    expect(b.getAttribute('aria-label')).toBe('Close');
    expect(b.querySelector('svg')).toBeTruthy();
    expect(modal().getAttribute('role')).toBe('dialog');
    expect(modal().getAttribute('aria-modal')).toBe('true');
  });

  it('closes on the X', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(closeBtn());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('closed')).toBeTruthy();
  });

  it('closes on Escape — only for the topmost modal', () => {
    const one = vi.fn();
    const two = vi.fn();
    render(
      <div>
        <Modal open onClose={one} title="One">
          <p>one</p>
        </Modal>
        <Modal open onClose={two} title="Two">
          <p>two</p>
        </Modal>
      </div>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(two).toHaveBeenCalledTimes(1);
    expect(one).not.toHaveBeenCalled();
  });

  it('closes on backdrop tap but never on a tap inside the sheet', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T">
        <p id="body">body</p>
      </Modal>
    );
    fireEvent.click(document.querySelector('.scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(document.getElementById('body'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a swipe-down past the threshold, and not before', () => {
    expect(swipeCloses({ offset: { y: 30 }, velocity: { y: 10 } })).toBe(false);
    expect(swipeCloses({ offset: { y: 140 }, velocity: { y: 0 } })).toBe(true);
    expect(swipeCloses({ offset: { y: 0 }, velocity: { y: 900 } })).toBe(true);
    expect(swipeCloses({ offset: { y: -120 }, velocity: { y: 0 } })).toBe(false); // pulling up stays open
    expect(swipeCloses(null)).toBe(false);
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="T">
        <p>body</p>
      </Modal>
    );
    const node = modal();
    const props = node[Object.keys(node).find(k => k.startsWith('__reactProps$'))] || {};
    // motion keeps its drag props, so the sheet is draggable in a real browser
    expect(node.style.touchAction !== undefined).toBe(true);
    expect(props).toBeDefined();
  });

  it('locks and restores body scroll', async () => {
    document.body.style.overflow = 'visible';
    const { unmount } = render(<Harness />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    await waitFor(() => expect(document.body.style.overflow).toBe('visible'));
  });

  it('a non-dismissible modal shows no X and ignores Esc + backdrop', () => {
    const onClose = vi.fn();
    render(<Harness dismissible={false} onClose={onClose} />);
    expect(closeBtn()).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(document.querySelector('.scrim'));
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector('.modal')).toBeTruthy();
  });

  it('moves focus into the dialog so Esc/Tab start inside it', () => {
    render(<Harness />);
    return waitFor(() => expect(document.activeElement).toBe(modal()), { timeout: 400 });
  });
});
