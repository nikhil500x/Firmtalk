import sgMail from '@sendgrid/mail';
import { invitationEmailTemplate } from '../templates/emails/invitation-email';
import { matterCreationEmailTemplate, MatterCreationEmailParams } from '../templates/emails/matter-creation-notification';

/**
 * Email Service
 * Wrapper for Twilio SendGrid email service
 */

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export interface SendInvitationEmailParams {
  recipientEmail: string;
  recipientName?: string;
  inviterName: string;
  firmName: string;
  roleName: string;
  invitationLink: string;
  expiresInHours: number;
}

export class EmailService {
  /**
   * Send invitation email to a new user
   * @param {SendInvitationEmailParams} params - Email parameters
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  static async sendInvitationEmail(params: SendInvitationEmailParams): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      const {
        recipientEmail,
        recipientName,
        inviterName,
        firmName,
        roleName,
        invitationLink,
        expiresInHours,
      } = params;

      const htmlContent = invitationEmailTemplate({
        recipientName: recipientName || recipientEmail,
        inviterName,
        firmName,
        roleName,
        invitationLink,
        expiresInHours,
      });

      // Prepare email message using SendGrid format
      const msg = {
        to: recipientEmail,
        from: process.env.SENDGRID_FROM_EMAIL || `noreply@yourdomain.com`, // TODO: Update with your verified sender email
        subject: `You've been invited to join ${firmName}`,
        html: htmlContent,
      };

      // Send email using SendGrid
      const [response] = await sgMail.send(msg);

      // Extract message ID from response headers
      const messageId = response.headers['x-message-id'] as string;

      return {
        success: true,
        messageId: messageId,
      };
    } catch (error: any) {
      console.error('SendGrid email error:', error);
      
      // Handle SendGrid specific errors
      if (error.response) {
        console.error('SendGrid error body:', error.response.body);
        return {
          success: false,
          error: error.response.body?.errors?.[0]?.message || error.message,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send matter creation notification email to partners
   * @param {MatterCreationEmailParams} params - Email parameters
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  static async sendMatterCreationEmail(params: MatterCreationEmailParams): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      const htmlContent = matterCreationEmailTemplate(params);

      // Prepare email message using SendGrid format
      const msg = {
        to: params.recipientEmail,
        from: process.env.SENDGRID_FROM_EMAIL || `noreply@yourdomain.com`,
        subject: `New Matter Created: ${params.matterTitle} - Conflict Check Required`,
        html: htmlContent,
      };

      // Send email using SendGrid
      const [response] = await sgMail.send(msg);

      // Extract message ID from response headers
      const messageId = response.headers['x-message-id'] as string;

      return {
        success: true,
        messageId: messageId,
      };
    } catch (error: any) {
      console.error('SendGrid email error:', error);

      // Handle SendGrid specific errors
      if (error.response) {
        console.error('SendGrid error body:', error.response.body);
        return {
          success: false,
          error: error.response.body?.errors?.[0]?.message || error.message,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send leaves report email with CSV attachment
   * @param params - Email parameters including CSV content
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  static async sendLeavesReportEmail(params: {
    recipientEmails: string[];
    senderName: string;
    weekStart: string;
    weekEnd: string;
    csvContent: string;
    totalLeaves: number;
  }): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      const {
        recipientEmails,
        senderName,
        weekStart,
        weekEnd,
        csvContent,
        totalLeaves,
      } = params;

      // Convert CSV content to base64 for attachment
      const csvBase64 = Buffer.from(csvContent).toString('base64');

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a365d;">Firmwide Leaves Report</h2>
          <p>Hi,</p>
          <p>Please find attached the firmwide leaves report for the week of <strong>${weekStart}</strong> to <strong>${weekEnd}</strong>.</p>
          <div style="background-color: #f7fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Total Leaves:</strong> ${totalLeaves}</p>
          </div>
          <p>This report was generated by <strong>${senderName}</strong> from Touchstone Partners.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #718096; font-size: 12px;">This is an automated email from Touchstone Partners HR System.</p>
        </div>
      `;

      // Prepare email message with attachment
      const msg = {
        to: recipientEmails,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourdomain.com',
        subject: `Firmwide Leaves Report: ${weekStart} to ${weekEnd}`,
        html: htmlContent,
        attachments: [
          {
            content: csvBase64,
            filename: `leaves_report_${weekStart}_to_${weekEnd}.csv`,
            type: 'text/csv',
            disposition: 'attachment',
          },
        ],
      };

      // Send email using SendGrid
      const [response] = await sgMail.send(msg);

      // Extract message ID from response headers
      const messageId = response.headers['x-message-id'] as string;

      return {
        success: true,
        messageId: messageId,
      };
    } catch (error: any) {
      console.error('SendGrid email error:', error);

      if (error.response) {
        console.error('SendGrid error body:', error.response.body);
        return {
          success: false,
          error: error.response.body?.errors?.[0]?.message || error.message,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify SendGrid API configuration
   * @returns {Promise<boolean>} True if API key is configured
   */
  static async verifyConfiguration(): Promise<boolean> {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        console.error('SENDGRID_API_KEY not found in environment variables');
        return false;
      }
      if (!process.env.SENDGRID_FROM_EMAIL) {
        console.error('SENDGRID_FROM_EMAIL not found in environment variables');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Email service configuration error:', error);
      return false;
    }
  }
}

