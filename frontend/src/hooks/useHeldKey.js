import { useEffect, useRef } from 'react';

const isTypingTarget = (target) => {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

/**
 * Tracks whether a single character key is currently held down.
 *
 * Returns a ref, not state, on purpose: the only consumers are event handlers
 * reading `.current` at click time, and re-rendering the tree on every keypress
 * of a modifier-style key would be pure waste.
 *
 * Keydowns inside a text field are ignored — otherwise typing the letter in a
 * search box would arm a hidden click shortcut. The flag also resets on blur and
 * tab-away, because a keyup that happens while the window is unfocused never
 * reaches us and would otherwise leave the key stuck "held" forever.
 */
export const useHeldKey = (key) => {
  const held = useRef(false);
  const normalized = key.toLowerCase();

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;
      if (event.key.toLowerCase() === normalized) held.current = true;
    };
    const onKeyUp = (event) => {
      if (event.key.toLowerCase() === normalized) held.current = false;
    };
    const reset = () => {
      held.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', reset);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', reset);
    };
  }, [normalized]);

  return held;
};
