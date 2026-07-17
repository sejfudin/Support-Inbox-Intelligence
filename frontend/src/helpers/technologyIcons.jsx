import { Code2 } from 'lucide-react';
import {
  Angular,
  CPlusPlus,
  CSharp,
  Django,
  FastAPI,
  Flutter,
  Go,
  Kotlin,
  Laravel,
  NextJs,
  NodeJs,
  Rails,
  React as ReactIcon,
  RustDark,
  Spring,
  SvelteJS,
  Swift,
  VueJs,
} from 'developer-icons';

// Maps a Technology (by its stable slug) to a brand logo from `developer-icons`.
// Technologies that are conceptual rather than a single product (Data
// Engineering, Machine Learning, Manual QA, DevOps, …) intentionally have no
// entry and fall back to a neutral code glyph via TechnologyIcon below.
const ICON_BY_SLUG = {
  react: ReactIcon,
  angular: Angular,
  'vue-js': VueJs,
  'next-js': NextJs,
  svelte: SvelteJS,
  'node-js': NodeJs,
  'spring-boot': Spring,
  dotnet: CSharp,
  django: Django,
  fastapi: FastAPI,
  go: Go,
  laravel: Laravel,
  'ruby-on-rails': Rails,
  kotlin: Kotlin,
  swift: Swift,
  'react-native': ReactIcon,
  flutter: Flutter,
  rust: RustDark,
  cpp: CPlusPlus,
};

export const getTechnologyIcon = (technology) => ICON_BY_SLUG[technology?.slug] || null;

/**
 * Renders a technology's brand logo, or a neutral fallback glyph for
 * conceptual technologies that have no single logo. `size` is in px.
 */
export function TechnologyIcon({ technology, size = 14, className }) {
  const Icon = getTechnologyIcon(technology);
  if (Icon) return <Icon size={size} className={className} />;
  return <Code2 size={size} className={className} />;
}
