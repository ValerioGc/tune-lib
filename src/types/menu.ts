import type { IconName } from '@/config/icons';

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconName;
  description?: string;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
  divider?: boolean;
}
