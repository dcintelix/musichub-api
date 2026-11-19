import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend | null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = configService.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendVerificationCode(email: string, name: string, code: string) {
    if (!this.resend) {
      throw new ServiceUnavailableException('Email delivery is not configured.');
    }

    const appUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const verificationUrl = `${appUrl.replace(/\/$/, '')}/verify-email?email=${encodeURIComponent(email)}`;
    const safeName = name.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] ?? character);

    const { error } = await this.resend.emails.send({
      from: this.configService.get<string>('EMAIL_FROM', 'no-reply@example.com'),
      to: email,
      subject: 'Your  verification code',
      html: `<p>Hello ${safeName},</p><p>Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>This code expires in 5 minutes. You can request a new code after 1 minute.</p><p><a href="${verificationUrl}">Enter your code</a></p>`,
      text: `Hello ${name}, your  verification code is ${code}. It expires in 5 minutes. You can request a new code after 1 minute. Enter it here: ${verificationUrl}`,
    });

    if (error) {
      throw new ServiceUnavailableException('Could not send the verification code. Please try again.');
    }
  }

  async sendPasswordResetEmail(email: string, name: string, token: string) {
    if (!this.resend) {
      throw new ServiceUnavailableException('Email delivery is not configured.');
    }

    const appUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    const safeName = name.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character] ?? character);

    const { error } = await this.resend.emails.send({
      from: this.configService.get<string>('EMAIL_FROM', 'no-reply@example.com'),
      to: email,
      subject: 'Reset your  password',
      html: `<p>Hello ${safeName},</p><p>We received a request to reset your password. <a href="${resetUrl}">Choose a new password</a>.</p><p>This link expires in 30 minutes and can only be used once. If you did not request this, you can ignore this email.</p>`,
      text: `Hello ${name}, reset your  password here: ${resetUrl}. This link expires in 30 minutes and can only be used once. If you did not request this, ignore this email.`,
    });

    if (error) {
      throw new ServiceUnavailableException('Could not send the password reset email. Please try again.');
    }
  }
}
