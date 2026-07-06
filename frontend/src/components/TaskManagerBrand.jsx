import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useThemeConfig } from '@/context/ThemeConfigContext';
import { DEFAULT_COLOR_THEME } from '@/lib/themes';
import {
  LOGO_PRESENTATION_SHELL,
  TASK_MANAGER_LOGO_WHITE_SRC,
  usesThemedLogoShell,
} from '@/lib/brandAssets';

const LOGO_SIZE = {
  sm: 'h-8 w-8',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
  xl: 'h-14 w-14',
};

const BRAND_GAP = {
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-3.5',
  xl: 'gap-4',
};

const WORDMARK_SIZE = {
  sm: 'text-[15px] leading-none',
  md: 'text-lg leading-none',
  lg: 'text-3xl leading-none md:text-4xl',
  xl: 'text-4xl leading-none md:text-[2.75rem]',
};

function Wordmark({ size = 'md', onDark = false, className }) {
  return (
    <div
      className={cn(
        'flex items-baseline font-semibold tracking-tight',
        WORDMARK_SIZE[size],
        className
      )}
    >
      <span className={onDark ? 'text-background' : 'text-foreground'}>Task</span>
      <span className="ml-px text-primary">Manager</span>
    </div>
  );
}

function TaskManagerLogoMark({ size = 'md', logoClassName, shellClassName }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-primary shadow-sm',
        LOGO_SIZE[size],
        shellClassName
      )}
      data-test="task-manager-logo-shell"
      data-logo-variant="shell"
      aria-hidden
    >
      <img
        src={TASK_MANAGER_LOGO_WHITE_SRC}
        alt="Task Manager"
        className={cn('h-[72%] w-[72%] object-contain', logoClassName)}
        data-test="task-manager-logo"
      />
    </span>
  );
}

export function TaskManagerBrand({
  size = 'md',
  showWordmark = true,
  linkTo = '/dashboard',
  onDark = false,
  className,
  wordmarkClassName,
  logoClassName,
  shellClassName,
}) {
  const { colorTheme, ready } = useThemeConfig();
  const activeTheme = ready ? colorTheme : DEFAULT_COLOR_THEME;

  const content = (
    <div
      className={cn('flex min-w-0 items-center', BRAND_GAP[size], className)}
      data-theme-brand={activeTheme}
      data-logo-presentation={LOGO_PRESENTATION_SHELL}
      data-logo-shell={usesThemedLogoShell() ? 'true' : 'false'}
    >
      <TaskManagerLogoMark
        size={size}
        logoClassName={logoClassName}
        shellClassName={shellClassName}
      />
      {showWordmark ? (
        <Wordmark size={size} onDark={onDark} className={cn('min-w-0', wordmarkClassName)} />
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
