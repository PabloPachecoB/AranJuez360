import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// En el celular los tokens viven SOLO en SecureStore (cifrado por el sistema).
// AsyncStorage se usa únicamente en web, donde SecureStore no existe.
const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const esWeb = Platform.OS === "web";

const getItem = (key) => (esWeb ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key));
const setItem = (key, value) =>
  esWeb ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value);
const deleteItem = (key) => (esWeb ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key));

export const getAccessToken = () => getItem(ACCESS_KEY);
export const getRefreshToken = () => getItem(REFRESH_KEY);
export const setAccessToken = (access) => setItem(ACCESS_KEY, access);

export async function setTokens({ access, refresh }) {
  if (access) await setItem(ACCESS_KEY, access);
  if (refresh) await setItem(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY)]);
}
