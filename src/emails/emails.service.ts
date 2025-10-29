import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class EmailsService {
  private transporter: nodemailer.Transporter | null = null;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';

    if (this.isDevelopment) {
      // Development: Use Gmail with Nodemailer
      console.log('📧 Email Service: Using Gmail (Development)');
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });
    } else {
      // Production: Use SendGrid
      console.log('📧 Email Service: Using SendGrid (Production)');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');
    }
  }

  async sendSpeakerInvitation(
    speakerEmail: string,
    speakerName: string,
    eventName: string,
    eventDeadline: Date,
    portalUrl: string,
  ) {
    const subject = `Invitation: Submit your assets for ${eventName}`;
    const html = `
      <h2>Hello ${speakerName},</h2>
      <p>You've been invited to submit your speaker assets for <strong>${eventName}</strong>.</p>
      <p><strong>Deadline:</strong> ${eventDeadline.toLocaleDateString()}</p>
      <p>Please use the link below to access your personal submission portal:</p>
      <p><a href="${portalUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Submit Your Assets</a></p>
      <p>If you have any questions, please contact the event organizer.</p>
      <p>Best regards,<br>The StageAsset Team</p>
    `;

    return this.sendEmail(speakerEmail, subject, html);
  }

  async sendReminder(
    speakerEmail: string,
    speakerName: string,
    eventName: string,
    eventDeadline: Date,
    portalUrl: string,
  ) {
    const subject = `Reminder: Submit your assets for ${eventName}`;
    const html = `
      <h2>Hi ${speakerName},</h2>
      <p>This is a friendly reminder to submit your speaker assets for <strong>${eventName}</strong>.</p>
      <p><strong>Deadline:</strong> ${eventDeadline.toLocaleDateString()}</p>
      <p>Access your submission portal here:</p>
      <p><a href="${portalUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Submit Your Assets</a></p>
      <p>Don't miss the deadline!</p>
      <p>Best regards,<br>The StageAsset Team</p>
    `;

    return this.sendEmail(speakerEmail, subject, html);
  }

  async sendSubmissionConfirmation(
    speakerEmail: string,
    speakerName: string,
    eventName: string,
  ) {
    const subject = `Assets received for ${eventName}`;
    const html = `
      <h2>Thank you, ${speakerName}!</h2>
      <p>We've successfully received your assets for <strong>${eventName}</strong>.</p>
      <p>The event organizer will review your submission.</p>
      <p>Best regards,<br>The StageAsset Team</p>
    `;

    return this.sendEmail(speakerEmail, subject, html);
  }

  async sendPasswordReset(
    userEmail: string,
    userName: string,
    resetUrl: string,
  ) {
    const subject = 'Reset Your Password - StageAsset';
    const html = `
      <h2>Hi ${userName},</h2>
      <p>You requested to reset your password for your StageAsset account.</p>
      <p>Click the button below to reset your password:</p>
      <p><a href="${resetUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>Best regards,<br>The StageAsset Team</p>
    `;

    return this.sendEmail(userEmail, subject, html);
  }

  async sendEmailVerification(
    userEmail: string,
    userName: string,
    verificationUrl: string,
  ) {
    const subject = 'Verify Your Email - StageAsset';
    const html = `
      <h2>Welcome, ${userName}!</h2>
      <p>Thank you for signing up for StageAsset!</p>
      <p>Please verify your email address by clicking the button below:</p>
      <p><a href="${verificationUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p>Best regards,<br>The StageAsset Team</p>
    `;

    return this.sendEmail(userEmail, subject, html);
  }

  /**
   * Unified email sending method that switches between Gmail and SendGrid
   * based on NODE_ENV
   */
  private async sendEmail(to: string, subject: string, html: string) {
    try {
      if (this.isDevelopment) {
        // Development: Use Gmail via Nodemailer
        if (!this.transporter) {
          throw new Error('Email transporter not configured');
        }

        await this.transporter.sendMail({
          from: process.env.EMAIL_USER,
          to,
          subject,
          html,
        });
        console.log(`✅ Email sent via Gmail to: ${to}`);
      } else {
        // Production: Use SendGrid
        await sgMail.send({
          to,
          from: process.env.EMAIL_FROM || 'noreply@stageasset.com',
          subject,
          html,
        });
        console.log(`✅ Email sent via SendGrid to: ${to}`);
      }

      return { success: true };
    } catch (error) {
      console.error('❌ Error sending email:', error);
      throw error;
    }
  }
}
