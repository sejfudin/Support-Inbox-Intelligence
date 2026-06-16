'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

const Slider = React.forwardRef(
  (
    {
      className,
      value,
      defaultValue = [0],
      min = 0,
      max = 100,
      step = 1,
      onValueChange,
      disabled,
      ...props
    },
    ref
  ) => {
    const currentValue = Array.isArray(value)
      ? value[0]
      : Array.isArray(defaultValue)
        ? defaultValue[0]
        : defaultValue;
    const percentage = ((currentValue - min) / (max - min)) * 100;

    return (
      <div
        className={cn(
          'relative flex h-5 w-full touch-none select-none items-center',
          disabled && 'opacity-50',
          className
        )}
      >
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/15">
          <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
        </div>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          disabled={disabled}
          onChange={(event) => onValueChange?.([Number(event.target.value)])}
          className={cn(
            'absolute inset-0 h-5 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none disabled:pointer-events-none',
            '[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent',
            '[&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110',
            '[&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-transparent',
            '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background [&::-moz-range-thumb]:shadow-sm'
          )}
          {...props}
        />
      </div>
    );
  }
);
Slider.displayName = 'Slider';

export { Slider };
