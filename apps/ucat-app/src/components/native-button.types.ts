export type NativeButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  close?: boolean;
  secondary?: boolean;
  block?: boolean;
  compact?: boolean;
  systemImage?: "chevron.right";
  tint?: string;
  accessibilityLabel?: string;
};
