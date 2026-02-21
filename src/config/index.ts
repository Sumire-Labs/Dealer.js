function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

export const config = {
  discordToken: requireEnv('DISCORD_TOKEN'),
  clientId: requireEnv('DISCORD_CLIENT_ID'),
  guildId: optionalEnv('GUILD_ID'), // optional: set for dev (instant), omit for global (up to 1h)
  databaseUrl: requireEnv('DATABASE_URL'),
} as const;
