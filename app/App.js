import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter";
import { Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { NavigationContainer } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { UserProvider } from "./context/UserContext";
import StackNavigator from "./navigation/StackNavigator";

// Enlaces que abren la app: el NFC/QR del Paseo trae "paseo360://f/<código>".
const linking = {
  prefixes: [Linking.createURL("/"), "paseo360://"],
  config: { screens: { Escanear: "f/:codigo" } },
};

export default function App() {
  // Tipografías del diseño de Stitch (Manrope para títulos, Inter para texto).
  const [fuentesListas, errorFuentes] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
  });
  if (!fuentesListas && !errorFuentes) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <UserProvider>
          <NavigationContainer linking={linking}>
            <StackNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </UserProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
