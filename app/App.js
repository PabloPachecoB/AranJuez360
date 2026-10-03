import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { UserProvider } from "./context/UserContext";
import { CarritoProvider } from "./context/CarritoContext";
import StackNavigator from "./navigation/StackNavigator";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <UserProvider>
          <CarritoProvider>
            <NavigationContainer>
              <StackNavigator />
              <StatusBar style="auto" />
            </NavigationContainer>
          </CarritoProvider>
        </UserProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
