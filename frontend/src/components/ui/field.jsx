import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Label above, control, optional hint under it.
 *
 * This file used to hold shadcn's ten-part `Field` kit — `FieldSet`,
 * `FieldLegend`, `FieldGroup` and friends — which nothing in the app ever
 * imported. It is the library's Field now: the form row the design actually
 * uses, at the sizes the design actually specifies.
 *
 * The label is 11.5px/500 secondary and the hint 11px tertiary. Both are fixed
 * type sizes, so they do not move with density — compact tightens the gap
 * between rows, never the legibility of the text in them.
 *
 * @param {object} props
 * @param {React.ReactNode} props.label
 * @param {React.ReactNode} [props.hint]   sits under the control, e.g. "Managed by your admin."
 * @param {React.ReactNode} [props.error]  replaces the hint and colours the row
 * @param {string} [props.htmlFor]         id of the control, so the label is clickable
 */
function Field({ label, hint, error, htmlFor, className, children, ...props }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="text-[11.5px] font-medium leading-none text-muted-foreground"
        >
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-[11px] leading-snug text-[hsl(var(--tone-danger-fg))]">{error}</p>
      ) : hint ? (
        <p className="text-[11px] leading-snug text-muted-foreground/75">{hint}</p>
      ) : null}
    </div>
  );
}

export { Field };
