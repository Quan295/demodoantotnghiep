import { Stack } from 'expo-router';
import { ThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { useColorScheme, Platform, View, StyleSheet } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {Platform.OS !== 'web' && <AnimatedSplashOverlay />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0B0F17' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(citizen)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="(dispatcher)" />
      </Stack>
    </ThemeProvider>
  );
}
