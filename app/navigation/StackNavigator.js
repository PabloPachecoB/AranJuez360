import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "../constants/colors";
import { useUserContext } from "../context/UserContext";
import AsistenteScreen from "../screens/AsistenteScreen";
import DesbloqueoScreen from "../screens/DesbloqueoScreen";
import DiversionScreen from "../screens/DiversionScreen";
import EscanearScreen from "../screens/EscanearScreen";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";
import OficinasScreen from "../screens/OficinasScreen";
import PorteriaScreen from "../screens/PorteriaScreen";
import RegistroScreen from "../screens/RegistroScreen";
import VerificarCodigoScreen from "../screens/VerificarCodigoScreen";

const Stack = createNativeStackNavigator();

export default function StackNavigator() {
  const { estado, user } = useUserContext();

  if (estado === "cargando") {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {estado === "autenticado" && user?.rol === "PORTERO" ? (
        // Los guardias usan la app en modo portería (invitaciones a oficinas y visitas).
        <Stack.Screen name="Porteria" component={PorteriaScreen} />
      ) : estado === "autenticado" ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Asistente" component={AsistenteScreen} />
          <Stack.Screen name="Escanear" component={EscanearScreen} />
          <Stack.Screen name="Diversion" component={DiversionScreen} />
          <Stack.Screen name="Oficinas" component={OficinasScreen} />
        </>
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
