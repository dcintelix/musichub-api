export const AppConfig = () => ({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 3000),
  APP_NAME: process.env.APP_NAME || '',
  APP_PUBLIC_URL: process.env.APP_PUBLIC_URL || 'http://localhost:3001',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3001',
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'local-development-access-secret',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'local-development-refresh-secret',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM || 'no-reply@example.com',
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'cloudflare_r2',
  R2_ACCOUNT_ID: process.env.CF_ACCOUNT_ID || process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.CF_ACCESS_KEY || process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.CF_SECRET_KEY || process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.CF_R2_BUCKET || process.env.R2_BUCKET_NAME,
  R2_REGION: process.env.CF_R2_REGION || process.env.R2_REGION || 'auto',
  R2_ENDPOINT: process.env.CF_R2_ENDPOINT
    || process.env.R2_ENDPOINT
    || (process.env.CF_ACCOUNT_ID
      ? `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined),
  R2_PUBLIC_BASE_URL: process.env.CF_R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL,
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:3001',
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug',
});
