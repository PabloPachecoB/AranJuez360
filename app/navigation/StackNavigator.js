import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "../constants/colors";
import { useUserContext } from "../context/UserContext";
import DesbloqueoScreen from "../screens/DesbloqueoScreen";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";
import RegistroScreen from "../screens/RegistroScreen";
import VerificarCodigoScreen from "../screens/VerificarCodigoScreen";

const Stack = createNativeStackNavigator();

export default function StackNavigator() {
  const { estado } = useUserContext();

  if (estado === "cargando") {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {estado === "autenticado" ? (
        <Stack.Screen name="Home" component={HomeScreen} />
      ) : estado === "bloqueado" ? (
        <Stack.Screen name="Desbloqueo" component={DesbloqueoScreen} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Registro" component={RegistroScreen} />
          <Stack.Screen name="VerificarCodigo" component={VerificarCodigoScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
