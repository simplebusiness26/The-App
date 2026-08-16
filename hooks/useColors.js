import { useColorScheme } from "react-native";
import { INK } from "../utils/tokens";

const light = {
  primary: INK.brandDeep,
  background: INK.paper,
  card: INK.card,
  text: INK.ink,
  subtext: INK.inkSoft,
  border: INK.hair,
  danger: INK.red,
  success: INK.brandDeep,
};

const dark = {
  primary: INK.brand,
  background: INK.navy,
  card: INK.navySoft,
  text: INK.onNavy,
  subtext: INK.onNavySoft,
  border: INK.navySoft,
  danger: INK.coral,
  success: INK.brand,
};

export function useColors() {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}
