import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useThemeConfig } from '@/context/ThemeConfigContext';
import { DEFAULT_COLOR_THEME } from '@/lib/themes';
import { TASK_MANAGER_LOGO_SRC } from '@/lib/brandAssets';

// One-line lockup: mark, then TASK MANAGER on a single baseline — bold TASK, regular
// MANAGER. Geometry measured off Montserrat itself at fontSize 200 (cap height 140),
// so the viewBox is the lockup's ink box and nothing more:
//
//   TASK      wght 765, x 0,   advance 509 (natural 553, so -8%)
//   MANAGER   wght 400, x 555, advance 943 (natural 1072, so -12%)
//   baseline  y 140, with 3 units opened above and below it for the S and G overshoot
//
// The tracking is negative in both words and deliberately uneven: the regular MANAGER is
// pulled 12% in against TASK's 8% because a light weight at the same tracking reads airy
// next to a bold one, and the two words have to look equally dense to work as one mark.
// Neither goes further — past ~-11% TASK's A and S start to touch, and past ~-15% so do
// MANAGER's A, N and G. MANAGER's x leaves 66 units of visible space after the K, on top
// of the 23-unit left sidebearing the M carries and the eye already reads as part of it.
//
// Every line stays pinned to an explicit `textLength`. The svg is sized by height and
// takes its width from the viewBox, so an advance that differs from what's assumed
// here (a fallback face, a different Montserrat cut) would leave the wordmark
// mis-sized rather than merely mis-tracked. `lengthAdjust` stays at the default
// "spacing" so the tracking absorbs the difference and no glyph is ever stretched.
const WORDMARK_VIEWBOX = { x: -1, y: -3, w: 1489, h: 146 };
const BASELINE = 140;

const WORDS = {
  task: { x: 0, size: 200, weight: 765, length: 509 },
  manager: { x: 555, size: 200, weight: 400, length: 943 },
};

// `showTagline` adds BUILT BY INTERNS, FOR INTERNS as a second line, ruled to the exact
// width of TASK MANAGER above it. Unlike the wordmark this line is tracked *out*: at cap
// 49 its natural advance is only 1200, so filling 1489 spreads it by ~0.15em per gap,
// which is the look — a wide, quiet rule under a tight wordmark. The size is what makes
// that work. Set the tagline smaller and the same 1489 would scatter the letters (cap 27
// would need +0.8em), larger and there is no tracking left to give it any air.
const TAGLINE_VIEWBOX = { x: -1, y: -3, w: 1489, h: 221 };
const TAGLINE = { y: 215, size: 70, weight: 640, length: 1489 };

// Two lockups, two shapes: a single line is ~10x as wide as it is tall, the tagline block
// only ~6.7x, and the mark has to sit against a block rather than a line. So each size
// token carries its own mark / block / gap triple per variant instead of deriving one from
// the other. Two placements set the ceilings — `md` in the sidebar, where 163px is all
// that's left of the 17rem rail once its padding, the notification bell and the collapse
// toggle are out, and `xl` in the login hero's ~380px of card width. The wordmark is
// `shrink-0`, so anything wider silently runs under its neighbour instead of scaling down.
// The gap ratios only hold because brand/TMLogo.png is trimmed to its ink (232x232, edge
// to edge); put transparent padding back into the asset and the mark reads both smaller
// and further from the text.
const LOCKUP = {
  wordmark: {
    sm: { mark: 'h-[28px] w-[28px]', block: 'h-[10px]', gap: 'gap-[7px]' },
    md: { mark: 'h-[30px] w-[30px]', block: 'h-[11px]', gap: 'gap-[8px]' },
    lg: {
      mark: 'h-[46px] w-[46px] md:h-[54px] md:w-[54px]',
      block: 'h-[17px] md:h-[20px]',
      gap: 'gap-[11px] md:gap-[13px]',
    },
    xl: {
      mark: 'h-[52px] w-[52px] md:h-[60px] md:w-[60px]',
      block: 'h-[19px] md:h-[22px]',
      gap: 'gap-[13px] md:gap-[15px]',
    },
  },
  tagline: {
    sm: { mark: 'h-[20px] w-[20px]', block: 'h-[16px]', gap: 'gap-[6px]' },
    md: { mark: 'h-[26px] w-[26px]', block: 'h-[20px]', gap: 'gap-[7px]' },
    lg: {
      mark: 'h-[32px] w-[32px] md:h-[36px] md:w-[36px]',
      block: 'h-[24px] md:h-[28px]',
      gap: 'gap-[9px] md:gap-[10px]',
    },
    xl: {
      mark: 'h-[36px] w-[36px] md:h-[42px] md:w-[42px]',
      block: 'h-[28px] md:h-[32px]',
      gap: 'gap-[10px] md:gap-[12px]',
    },
  },
};

function Wordmark({ size = 'md', variant = 'wordmark', onDark = false, className }) {
  const withTagline = variant === 'tagline';
  const box = withTagline ? TAGLINE_VIEWBOX : WORDMARK_VIEWBOX;

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      className={cn(
        'w-auto shrink-0 font-brand',
        // The artwork sets the lockup in one ink (#3f3f3f), so every line takes a single
        // fill rather than muting MANAGER or the tagline. `data-brand-line` is there for a
        // theme that wants to break that and accent one word from CSS — today none do, the
        // themed sample tints the mark only.
        onDark ? 'fill-background' : 'fill-foreground',
        LOCKUP[variant][size].block,
        className
      )}
      role="img"
      aria-label={withTagline ? 'Task Manager — built by interns for interns' : 'Task Manager'}
      data-test="task-manager-wordmark"
    >
      <text
        data-brand-line="task"
        x={WORDS.task.x}
        y={BASELINE}
        textLength={WORDS.task.length}
        fontSize={WORDS.task.size}
        fontWeight={WORDS.task.weight}
      >
        TASK
      </text>
      <text
        data-brand-line="manager"
        x={WORDS.manager.x}
        y={BASELINE}
        textLength={WORDS.manager.length}
        fontSize={WORDS.manager.size}
        fontWeight={WORDS.manager.weight}
      >
        MANAGER
      </text>
      {withTagline ? (
        <text
          data-brand-line="tagline"
          x="0"
          y={TAGLINE.y}
          textLength={TAGLINE.length}
          fontSize={TAGLINE.size}
          fontWeight={TAGLINE.weight}
        >
          BUILT BY INTERNS, FOR INTERNS
        </text>
      ) : null}
    </svg>
  );
}

// The mark is painted, not placed: `--brand-mark` hands the artwork's URL to CSS, which draws
// it as a background image under Symphony Indigo and, under every other palette, uses it as a
// mask and floods the shape with that palette's accent instead. See the brand block in
// index.css for why the flat silhouette still reads as the logo.
function TaskManagerLogoMark({ size = 'md', variant = 'wordmark', onDark = false, logoClassName }) {
  return (
    <span
      style={{ '--brand-mark': `url(${TASK_MANAGER_LOGO_SRC})` }}
      className={cn('shrink-0', LOCKUP[variant][size].mark, logoClassName)}
      data-brand-mark
      data-brand-on-dark={onDark ? '' : undefined}
      data-test="task-manager-logo"
      aria-hidden
    />
  );
}

export function TaskManagerBrand({
  size = 'md',
  showWordmark = true,
  showTagline = false,
  linkTo = '/dashboard',
  onDark = false,
  className,
  wordmarkClassName,
  logoClassName,
}) {
  const { colorTheme, ready } = useThemeConfig();
  const activeTheme = ready ? colorTheme : DEFAULT_COLOR_THEME;
  // The tagline only exists as a second line under the wordmark, so asking for it without
  // one leaves the mark on its own at the single-line proportions.
  const variant = showWordmark && showTagline ? 'tagline' : 'wordmark';

  const content = (
    <div
      className={cn('flex min-w-0 items-center', LOCKUP[variant][size].gap, className)}
      data-theme-brand={activeTheme}
    >
      <TaskManagerLogoMark
        size={size}
        variant={variant}
        onDark={onDark}
        logoClassName={logoClassName}
      />
      {showWordmark ? (
        <Wordmark size={size} variant={variant} onDark={onDark} className={wordmarkClassName} />
      ) : null}
    </div>
  );

  if (!linkTo) {
    return content;
  }

  return (
    <Link
      to={linkTo}
      className="inline-flex min-w-0 transition-opacity hover:opacity-90"
      data-test="task-manager-brand-link"
      aria-label="Task Manager home"
    >
      {content}
    </Link>
  );
}
