import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import ReceiveScreen from './src/screens/ReceiveScreen';
import SendScreen from './src/screens/SendScreen';
import PairingScreen from './src/screens/PairingScreen';
import TransferScreen from './src/screens/TransferScreen';
import DoneScreen from './src/screens/DoneScreen';
import HelpScreen from './src/screens/HelpScreen';

export type RootStackParamList = {
  Home: undefined;
  Receive: undefined;
  Send: undefined;
  Pairing: {
    code: string;
    onConfirm: (ok: boolean) => void;
  };
  Transfer: {
    total: number;
    received: number;
    fileName?: string;
    fileIndex?: number;
    fileTotal?: number;
  };
  Done: {
    filePath: string;
    verified: boolean;
    fileCount?: number;
  };
  Help: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f8fafc',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#0f172a' },
        }}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Receive"
          component={ReceiveScreen}
          options={{ title: 'Receive' }}
        />
        <Stack.Screen
          name="Send"
          component={SendScreen}
          options={{ title: 'Send' }}
        />
        <Stack.Screen
          name="Pairing"
          component={PairingScreen}
          options={{ title: 'Pair Devices', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Transfer"
          component={TransferScreen}
          options={{ title: 'Transfer', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Done"
          component={DoneScreen}
          options={{ title: 'Done', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Help"
          component={HelpScreen}
          options={{ title: 'Help' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
