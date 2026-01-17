import "../global.css";
import { Slot } from "expo-router";
import { ShareIntentProvider } from "expo-share-intent";

export default function Layout() {
  return (
    <ShareIntentProvider>
      <Slot />
    </ShareIntentProvider>
  );
}
