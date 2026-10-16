import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hydrax.aquaai",
  appName: "HYDRAX",
  webDir: ".output/public",
  server: {
    cleartext: true,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
