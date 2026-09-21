export type NativeButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  close?: boolean;
  secondary?: boolean;
  block?: boolean;
  compact?: boolean;
  tint?: string;
  accessibilityLabel?: string;
};
