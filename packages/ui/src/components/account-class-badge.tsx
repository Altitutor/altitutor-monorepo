import { Badge, type BadgeProps } from './badge';

export type AccountClass = 'external' | 'internal_test';

export type AccountClassBadgeProps = Omit<BadgeProps, 'children'> & {
  accountClass: AccountClass | string | null | undefined;
};

export function AccountClassBadge({ accountClass, className, ...props }: AccountClassBadgeProps) {
  if (accountClass !== 'internal_test') return null;

  return (
    <Badge
      variant="outline"
      className={`border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 ${className ?? ''}`.trim()}
      {...props}
    >
      Internal test
    </Badge>
  );
}
