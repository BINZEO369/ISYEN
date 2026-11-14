/* Browser-safe configuration only: the Supabase publishable/anon key is public; never expose service-role keys. */
(() => {
  const defaults = {
    supabaseUrl: "https://fabasazefdnkpygglajz.supabase.co",
    supabaseAnonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhYmFzYXplZmRua3B5Z2dsYWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzNjUyMjksImV4cCI6MjEwOTk0MTIyOX0.MgUDDJ79RekwPDhc6LB0pIyM2jxyncSnnmiKwaqxo6U",
    devicePins: [4, 5, 13, 14, 16, 17, 18, 21, 22, 23, 25, 33],
    sensorPins: [
      4, 5, 13, 14, 15, 16, 17, 18, 21, 22, 23, 25, 33, 34, 35, 36, 39,
    ],
    apiBaseUrl: "",
  };
  window.APP_CONFIG = Object.freeze(defaults);
  window.APP_CONFIG_READY = (async () => {
    try {
      const response = await fetch("/api/config", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (response.ok) {
        const runtime = await response.json();
        window.APP_CONFIG = Object.freeze({
          ...defaults,
          supabaseUrl:
            typeof runtime.supabaseUrl === "string"
              ? runtime.supabaseUrl
              : defaults.supabaseUrl,
          supabaseAnonKey:
            typeof runtime.supabaseAnonKey === "string"
              ? runtime.supabaseAnonKey
              : defaults.supabaseAnonKey,
          apiBaseUrl:
            typeof runtime.apiBaseUrl === "string"
              ? runtime.apiBaseUrl.replace(/\/+$/, "")
              : defaults.apiBaseUrl,
        });
      }
    } catch (error) {
      console.info(
        "Using built-in public app configuration.",
        error?.message || "Runtime config unavailable.",
      );
    }
    window.sb = window.supabase.createClient(
      window.APP_CONFIG.supabaseUrl,
      window.APP_CONFIG.supabaseAnonKey,
    );
    return window.sb;
  })();
})();
