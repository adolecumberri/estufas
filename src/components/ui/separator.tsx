import * as React from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

type SeparatorProps = React.ComponentPropsWithoutRef<typeof View> & {
  orientation?: 'horizontal' | 'vertical';
};

function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
  return (
    <View
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
      {...props}
    />
  );
}

export { Separator };
export type { SeparatorProps };
