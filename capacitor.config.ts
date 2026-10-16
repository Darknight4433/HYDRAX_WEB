import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.hydrax.aquaai",
  appName: "HYDRAX",
  webDir: "dist",
  server: {
    cleartext: true,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
