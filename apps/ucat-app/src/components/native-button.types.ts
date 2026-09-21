export type NativeButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  close?: boolean;
  secondary?: boolean;
  block?: boolean;
  tint?: string;
};
