import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border p-[2px] transition-[background-color,border-color,box-shadow] duration-200",
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:shadow-[0_0_16px_-7px_hsl(var(--primary)/0.95)]",
      "data-[state=unchecked]:border-border data-[state=unchecked]:bg-secondary hover:data-[state=unchecked]:border-muted-foreground/60 hover:data-[state=unchecked]:bg-muted",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-45",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full shadow-sm ring-0 transition-[transform,background-color] duration-200",
        "data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground",
        "data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-muted-foreground",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
