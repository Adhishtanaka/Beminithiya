// Import necessary modules
const { Client, LocalAuth } = require("whatsapp-web.js");
const config = require("./config");
const { setupCommandHandlers } = require("./handlers/commandHandler");
const { formatMessage } = require("./utils/messageFormatter");

// --- Bot Initialization ---
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: config.BOT_CLIENT_ID,
  }),
  puppeteer: config.PUPPETEER_OPTIONS,
});

// --- User Session and State Management ---
// Stores user access tokens: { 'whatsapp_id': 'access_token' }
const userTokens = new Map();
// Stores user conversation states for multi-step commands: { 'whatsapp_id': { command: 'login', step: 1, data: {} } }
const userStates = new Map();

// --- Bot Event Handlers ---
client.on("qr", (qr) => {
  console.log("QR RECEIVED", qr);
  // You can use a library like 'qrcode-terminal' to display the QR in the console:
  require("qrcode-terminal").generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("Client is ready! WhatsApp Disaster Bot is Online!");
  // Optional: Send a startup message to a specific number for confirmation
  // client.sendMessage('YOUR_WHATSAPP_NUMBER@c.us', 'Hello! I am your disaster management bot and I am online. Type !help to see what I can do.');
});

client.on("message", async (msg) => {
  const senderId = msg.from;
  const text = msg.body.toLowerCase().trim();

  // Check if the user is in a multi-step conversation
  const currentState = userStates.get(senderId);

  try {
    // Handle the command
    await setupCommandHandlers(
      client,
      msg,
      text,
      senderId,
      currentState,
      userTokens,
      userStates,
    );
  } catch (error) {
    console.error("Error handling message:", error);
    msg.reply(
      formatMessage.error(
        "Sorry, an error occurred while processing your request. Please try again later.",
      ),
    );
  }
});

// --- Start the Bot ---
client.initialize().catch((err) => {
  console.error("Failed to initialize the bot:", err);
});

// Export maps for other modules to access
module.exports = {
  userTokens,
  userStates,
};
