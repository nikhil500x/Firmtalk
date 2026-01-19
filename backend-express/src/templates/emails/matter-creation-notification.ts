/**
 * Matter Creation Notification Email Template
 * Sent to all partners when a new matter is created for conflict checking
 */

export interface MatterCreationEmailParams {
  recipientEmail: string;
  recipientName: string;
  matterTitle: string;
  clientName: string;
  practiceArea: string;
  opposingParty?: string;
  assignedLawyerName: string;
  createdAt: string;
  description?: string;
  raiseConflictLink: string;
  viewMatterLink: string;
}

export const matterCreationEmailTemplate = (params: MatterCreationEmailParams): string => {
  const {
    recipientName,
    matterTitle,
    clientName,
    practiceArea,
    opposingParty,
    assignedLawyerName,
    createdAt,
    description,
    raiseConflictLink,
    viewMatterLink,
  } = params;

  // Format date nicely
  const formattedDate = new Date(createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Matter Created - Conflict Check Required</title>
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
      font-size: 24px;
      font-weight: 600;
    }
    .email-body {
      padding: 40px 30px;
    }
    .email-body h2 {
      margin: 0 0 20px 0;
      color: #2F3C44;
      font-size: 20px;
      font-weight: 600;
    }
    .email-body p {
      margin: 0 0 16px 0;
      line-height: 1.6;
      color: #555555;
      font-size: 16px;
    }
    .matter-details-box {
      background-color: #F9FAFB;
      border: 1.5px solid #E5E7EB;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #E5E7EB;
    }
    .detail-row:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #6B7280;
      min-width: 140px;
      font-size: 14px;
    }
    .detail-value {
      color: #2F3C44;
      font-size: 14px;
      flex: 1;
    }
    .conflict-warning {
      background-color: #FFF9E6;
      border-left: 4px solid #F59E0B;
      padding: 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .conflict-warning p {
      margin: 0;
      font-size: 14px;
      color: #92400E;
      font-weight: 500;
    }
    .cta-button {
      display: inline-block;
      background-color: #DC2626;
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 10px 10px 10px 0;
      transition: background-color 0.3s;
    }
    .cta-button:hover {
      background-color: #B91C1C;
    }
    .cta-button-secondary {
      display: inline-block;
      background-color: #0752C2;
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 40px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 10px 10px 10px 0;
      transition: background-color 0.3s;
    }
    .cta-button-secondary:hover {
      background-color: #053F9B;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
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
    @media only screen and (max-width: 600px) {
      .email-container {
        margin: 20px;
      }
      .email-header, .email-body, .email-footer {
        padding: 30px 20px;
      }
      .cta-button, .cta-button-secondary {
        display: block;
        margin: 10px 0;
      }
      .detail-row {
        flex-direction: column;
      }
      .detail-label {
        margin-bottom: 4px;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="email-header">
      <h1>🔔 New Matter Created</h1>
    </div>

    <!-- Body -->
    <div class="email-body">
      <h2>Hello ${recipientName},</h2>
      
      <p>
        A new matter has been created in TouchStone. As a partner, please review the details 
        below and check for any potential conflicts of interest.
      </p>

      <!-- Matter Details -->
      <div class="matter-details-box">
        <div class="detail-row">
          <span class="detail-label">Matter Title:</span>
          <span class="detail-value"><strong>${matterTitle}</strong></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Client:</span>
          <span class="detail-value">${clientName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Practice Area:</span>
          <span class="detail-value">${practiceArea}</span>
        </div>
        ${
          opposingParty
            ? `
        <div class="detail-row">
          <span class="detail-label">Opposing Party:</span>
          <span class="detail-value">${opposingParty}</span>
        </div>
        `
            : ''
        }
        <div class="detail-row">
          <span class="detail-label">Assigned Lawyer:</span>
          <span class="detail-value">${assignedLawyerName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Created:</span>
          <span class="detail-value">${formattedDate}</span>
        </div>
        ${
          description
            ? `
        <div class="detail-row">
          <span class="detail-label">Description:</span>
          <span class="detail-value">${description}</span>
        </div>
        `
            : ''
        }
      </div>

      <!-- Conflict Warning -->
      <div class="conflict-warning">
        <p>
          ⚠️ <strong>Action Required:</strong> If you identify any conflict of interest 
          (client conflict, opposing party relationship, personal interest, etc.), 
          please raise a conflict immediately.
        </p>
      </div>

      <p style="margin-top: 30px;">
        Please take a moment to review this matter and determine if there are any conflicts:
      </p>

      <!-- CTA Buttons -->
      <div class="button-container">
        <a href="${raiseConflictLink}" class="cta-button">⚠️ Raise Conflict</a>
        <a href="${viewMatterLink}" class="cta-button-secondary">View Matter Details</a>
      </div>

      <p style="margin-top: 30px; font-size: 14px; color: #6B7280;">
        <strong>Note:</strong> The conflict raise link will remain valid for 7 days.
        If no conflicts are identified, no further action is required.
      </p>
    </div>

    <!-- Footer -->
    <div class="email-footer">
      <p><strong>TouchStone Legal Practice Management</strong></p>
      <p>This is an automated notification. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
};

