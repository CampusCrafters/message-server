module.exports = {
    apps: [
      {
        name: "chat-server",
        script: "./src/app.ts",
        interpreter: "ts-node",
        env: {
          NODE_ENV: "development",
        },
        env_production: {
          NODE_ENV: "production",
        },
      },
    ],
  };
  