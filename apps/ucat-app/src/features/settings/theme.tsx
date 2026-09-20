import {
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { Appearance, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Preference = "system" | "light" | "dark";
const Theme = createContext({
  preference: "system" as Preference,
  scheme: "light",
  setPreference: (_value: Preference) => {},
});
export function AppThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setValue] = useState<Preference>("system");
  useEffect(() => {
    void AsyncStorage.getItem("ucat-appearance").then((value) => {
      if (value === "light" || value === "dark") setValue(value);
    });
  }, []);
  useLayoutEffect(() => {
    Appearance.setColorScheme(
      preference === "system" ? "unspecified" : preference,
    );
  }, [preference]);
  const setPreference = (value: Preference) => {
    setValue(value);
    void AsyncStorage.setItem("ucat-appearance", value);
  };
  return (
    <Theme
      value={{
        preference,
        scheme:
          preference === "system"
            ? system === "dark"
              ? "dark"
              : "light"
            : preference,
        setPreference,
      }}
    >
      {children}
    </Theme>
  );
}
export const useAppTheme = () => use(Theme);
