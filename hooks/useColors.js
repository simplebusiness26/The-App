import { useColorScheme } from "react-native";
import { INK } from "../utils/tokens";

const light={
  primary:INK.ink,
  background:INK.paper,
  card:INK.card,
  text:INK.ink,
  subtext:INK.inkSoft,
  border:INK.hair,
  danger:INK.red,
  success:INK.green,
};

// Xplorer's mapped, photographed and community content is designed on a light
// information ground. A separate dark palette would turn the same semantic map
// inks into different signals, so this challenger keeps one dependable visual
// language across system appearance settings.
const dark=light;

export function useColors(){
  useColorScheme();
  return light;
}
