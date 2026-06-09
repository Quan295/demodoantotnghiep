import { Stack } from 'expo-router';

export default function DispatcherLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="case-detail" />
    </Stack>
  );
}
