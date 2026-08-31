import { Switcher } from '@/components/ui/switcher';

/**
 * Theme, text size and contrast are all "pick one of two or three, and the
 * thing being picked stays the same" — the switcher's job exactly, rather than
 * a hand-rolled segmented control per setting.
 *
 * Shared by both settings pages (`SettingsPage`, `LeadershipSettingsPage`).
 */
export default function SegmentedControl({ label, options, value, onChange, testIdPrefix }) {
  return (
    <Switcher
      label={label}
      value={value}
      onChange={onChange}
      items={options.map((option) => ({
        ...option,
        dataTest: `${testIdPrefix}-${option.value}-button`,
      }))}
    />
  );
}
