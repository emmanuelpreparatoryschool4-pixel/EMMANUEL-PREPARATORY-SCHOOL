import React from 'react';
import { cn, getInitials } from '@/lib/utils';

interface AvatarProps {
  firstName?: string;
  lastName?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeStyles = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
};

export function Avatar({ firstName, lastName, src, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        className={cn('rounded-full object-cover', sizeStyles[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-primary-100 font-semibold text-primary-700',
        sizeStyles[size],
        className
      )}
    >
      {firstName && lastName ? getInitials(firstName, lastName) : '?'}
    </div>
  );
}