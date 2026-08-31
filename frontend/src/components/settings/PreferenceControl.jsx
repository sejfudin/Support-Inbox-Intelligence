import { Circle, Contrast } from 'lucide-react';

import SegmentedControl from '@/components/settings/SegmentedControl';

/**
 * Which preferences get icons on their segments, by key. Held here rather than
 * passed in, so every settings page renders the same preference the same way
 * without having to remember to hand over the map.
 */
const PREFERENCE_ICONS = {
  contrast: { default: Circle, high: Contrast },
};

/**
 * A `SegmentedControl` bound to one of the `<html>`-attribute preferences, with
 * the placeholder every one of them needs while storage is still being read.
 *
 * Shared by both settings pages (`SettingsPage`, `LeadershipSettingsPage`).
 */
export default function PreferenceControl({
  label,
  preferenceKey,
  value,
  options,
  onChange,
  ready,
}) {
  if (!ready) {
    return <div className="h-[36px] w-[12rem] rounded-[var(--r-control)] bg-muted" aria-hidden />;
  }

  const icons = PREFERENCE_ICONS[preferenceKey];

  return (
    <SegmentedControl
      label={label}
      options={icons ? options.map((o) => ({ ...o, icon: icons[o.value] })) : options}
      value={value}
      onChange={(next) => onChange(preferenceKey, next)}
      testIdPrefix={`settings-${preferenceKey}`}
    />
  );
}
