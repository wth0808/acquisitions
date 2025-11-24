import arcjet, { shield, detectBot, slidingWindow } from "@arcjet/node";

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: "LIVE",
      allow: [
        "CATEGORY:SEARCH_ENGINE", // Google, Bing, etc.
        "CATEGORY:PREVIEW", // Link previews e.g. Slack, Discord
        "CATEGORY:TOOL", // Postman, curl, etc.
      ],
    }),
    slidingWindow({
      mode: "LIVE",
      interval: 2,
      max: 5,
    }),
  ],
});

export default aj;
