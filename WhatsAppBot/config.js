/**
 * Configuration settings for the WhatsApp Disaster Bot
 */
module.exports = {
  // API configuration
  API_BASE_URL: "http://localhost:8000",

  // Bot configuration
  BOT_CLIENT_ID: "whatsapp-disaster-bot",

  // Puppeteer configuration
  PUPPETEER_OPTIONS: {
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", // Verify this path on your system
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--window-size=1280,720",
    ],
    defaultViewport: null,
  },

  // Message templates
  MESSAGE_TEMPLATES: {
    WELCOME: `📱 *WhatsApp Disaster Management Bot* 📱\n\nHello! I'm your disaster management assistant. Here's how I can help you:`,
    HELP_COMMANDS: [
      "🔐 *!login* - Log in to your account",
      "👤 *!profile* - View your user profile",
      // "📊 *!dashboard* - Access your dashboard",
      "🆘 *!reportemergency* - Report an emergency situation",
      "🔍 *!nearbydisasters* - Check for disasters near your location",
      "📍 *!monitordisasters* - Monitor disasters near your location",
      "🛑 *!stopmonitoring* - Stop active disaster monitoring",
      "🚪 *!logout* - Log out from your account",
      "❓ *!help* - Show this help message",
    ],
    FOOTER: "\nType *!cancel* at any time to cancel the current operation.",
  },
};
