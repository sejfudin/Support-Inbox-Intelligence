import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ANIMATION_DURATION = 350;

const SheetContext = React.createContext({ isClosing: false });

const Sheet = ({ open, onOpenChange, ...props }) => {
  const [isOpen, setIsOpen] = React.useState(open);
  const [isClosing, setIsClosing] = React.useState(false);
  const timeoutRef = React.useRef(null);

  React.useEffect(() => {
    if (open) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsClosing(false);
      setIsOpen(true);
    } else if (isOpen) {
      setIsClosing(true);
      timeoutRef.current = setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
        timeoutRef.current = null;
      }, ANIMATION_DURATION);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [open, isOpen]);

  return (
    <SheetContext.Provider value={{ isClosing }}>
      <SheetPrimitive.Root
        open={isOpen}
        onOpenChange={(newOpen) => {
          if (onOpenChange) {
            onOpenChange(newOpen);
          }
        }}
        {...props}
      >
        {props.children}
      </SheetPrimitive.Root>
    </SheetContext.Provider>
  );
};

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => {
  const { isClosing } = React.useContext(SheetContext);

  return (
    <SheetPrimitive.Overlay asChild {...props} ref={ref}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isClosing ? 0 : 1 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className={cn("fixed inset-0 z-50 bg-black/80", className)}
      />
    </SheetPrimitive.Overlay>
  );
});
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva("fixed z-50 gap-4 bg-background p-6 shadow-lg", {
  variants: {
    side: {
      top: "inset-x-0 top-0 border-b",
      bottom: "inset-x-0 bottom-0 border-t",
      left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
      right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
    },
  },
  defaultVariants: {
    side: "right",
  },
});

const getMotionVariants = (side) => {
  const variants = {
    top: {
      initial: { y: "-100%" },
      animate: { y: 0 },
      exit: { y: "-100%" },
    },
    bottom: {
      initial: { y: "100%" },
      animate: { y: 0 },
      exit: { y: "100%" },
    },
    left: {
      initial: { x: "-100%" },
      animate: { x: 0 },
      exit: { x: "-100%" },
    },
    right: {
      initial: { x: "100%" },
      animate: { x: 0 },
      exit: { x: "100%" },
    },
  };
  return variants[side] || variants.right;
};

const SheetContent = React.forwardRef(
  ({ side = "right", className, children, ...props }, ref) => {
    const motionVariants = getMotionVariants(side);
    const { isClosing } = React.useContext(SheetContext);

    return (
      <SheetPortal>
        <SheetOverlay />
        <SheetPrimitive.Content ref={ref} asChild {...props}>
          <motion.div
            initial={motionVariants.initial}
            animate={isClosing ? motionVariants.exit : motionVariants.animate}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
            }}
            className={cn(sheetVariants({ side }), className)}
          >
            {children}
            <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          </motion.div>
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col space-y-2 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
