/**
 * Invitation Email Template
 * Professional HTML email template for user invitations
 */

interface InvitationEmailParams {
  recipientName: string;
  inviterName: string;
  firmName: string;
  roleName: string;
  invitationLink: string;
  expiresInHours: number;
}

export const invitationEmailTemplate = (params: InvitationEmailParams): string => {
  const { recipientName, inviterName, firmName, roleName, invitationLink, expiresInHours } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to Join ${firmName}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f4f4f7;
      color: #333333;
    }
    .email-container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .email-header {
      background: linear-gradient(135deg, #0752C2 0%, #053F9B 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .email-header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 28px;
      font-weight: 600;
    }
    .email-body {
      padding: 40px 30px;
    }
    .email-body h2 {
      margin: 0 0 20px 0;
      color: #2F3C44;
      font-size: 22px;
      font-weight: 600;
    }
    .email-body p {
      margin: 0 0 16px 0;
      line-height: 1.6;
      color: #555555;
      font-size: 16px;
    }
    .role-badge {
      display: inline-block;
      background-color: #E8F1FF;
      color: #0752C2;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      margin: 10px 0 20px 0;
    }
    .cta-button {
      display: inline-block;
      background-color: #0752C2;
      color: #ffffff;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: background-color 0.3s;
    }
    .cta-button:hover {
      background-color: #053F9B;
    }
    .info-box {
      background-color: #FFF9E6;
      border-left: 4px solid #FFC107;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 0;
      font-size: 14px;
      color: #856404;
    }
    .email-footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    .email-footer p {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #6B7280;
    }
    .link-text {
      color: #0752C2;
      word-break: break-all;
      font-size: 13px;
      margin-top: 20px;
      display: block;
    }
    @media only screen and (max-width: 600px) {
      .email-container {
        margin: 20px;
      }
      .email-header, .email-body, .email-footer {
        padding: 30px 20px;
      }
      .email-header h1 {
        font-size: 24px;
      }
      .email-body h2 {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="email-header">
      <h1>🎉 You're Invited!</h1>
    </div>

    <!-- Body -->
    <div class="email-body">
      <h2>Hello ${recipientName},</h2>
      
      <p>
        <strong>${inviterName}</strong> has invited you to join <strong>${firmName}</strong> 
        on TouchStone, our legal practice management platform.
      </p>

      <p>You've been assigned the following role:</p>
      <div class="role-badge">${roleName}</div>

      <p>
        To accept this invitation and set up your account, please click the button below:
      </p>

      <div style="text-align: center;">
        <a href="${invitationLink}" class="cta-button">Accept Invitation</a>
      </div>

      <div class="info-box">
        <p>
          ⏰ This invitation will expire in <strong>${expiresInHours} hours</strong>. 
          Please complete your registration before the link expires.
        </p>
      </div>

      <p style="margin-top: 30px;">
        Once you accept, you'll be guided through a quick onboarding process to complete your profile.
      </p>

      <p>If you have any questions, feel free to reach out to ${inviterName} or your system administrator.</p>

      <p style="margin-top: 30px; font-size: 14px; color: #6B7280;">
        <strong>Can't click the button?</strong> Copy and paste this link into your browser:
      </p>
      <span class="link-text">${invitationLink}</span>
    </div>

    <!-- Footer -->
    <div class="email-footer">
      <p><strong>${firmName}</strong></p>
      <p>Powered by TouchStone Legal Practice Management</p>
      <p style="margin-top: 20px; font-size: 12px;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

