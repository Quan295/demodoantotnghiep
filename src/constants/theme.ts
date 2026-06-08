/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0A0D12',
    background: '#FCFCFD',
    backgroundElement: '#F2F4F7',
    backgroundSelected: '#E4E7EC',
    textSecondary: '#475467',
    primary: '#D92D20', // Emergency Red
    primaryDark: '#B42318',
    primaryLight: '#FEE4E2',
    success: '#12B76A',
    successLight: '#D1FADF',
    border: '#D0D5DD',
    card: '#FFFFFF',
  },
  dark: {
    text: '#F9FAFB',
    background: '#0C0E12', // Deep Navy Black
    backgroundElement: '#151B26', // Card element background
    backgroundSelected: '#222B3A',
    textSecondary: '#98A2B3',
    primary: '#F04438', // Vibrant Emergency Red
    primaryDark: '#D92D20',
    primaryLight: '#55160C',
    success: '#32D583',
    successLight: '#053321',
    border: '#1F2A37',
    card: '#111827',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
