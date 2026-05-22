const TRANSITION_CLASS = 'transition-themes';
const TRANSITION_MS = 200;

export function flashThemeTransition() {
  const root = document.documentElement;
  root.classList.add(TRANSITION_CLASS);
  window.setTimeout(() => {
    root.classList.remove(TRANSITION_CLASS);
  }, TRANSITION_MS);
}
