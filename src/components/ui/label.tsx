import * as LabelPrimitive from '@rn-primitives/label';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Text>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Text> & { onPress?: () => void }
>(({ className, onPress, ...props }, ref) => (
  <LabelPrimitive.Root className="web:cursor-default" onPress={onPress}>
    <LabelPrimitive.Text
      ref={ref}
      className={cn(
        'text-sm native:text-base font-medium leading-none text-foreground web:peer-disabled:cursor-not-allowed web:peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  </LabelPrimitive.Root>
));
Label.displayName = 'Label';

export { Label };
