const express = require('express');
const router = express.Router();

const { getGmailClient } = require('../integrations/gmail/gmail_auth');
const { processUnreadGmail } = require('../integrations/gmail/gmail_processor');

function createRawEmail(to, subject, body) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body
  ].join('\r\n');

  return Buffer.from(message)
    .toString('base64url');
}

/*
 * POST /api/gmail/process-unread
 *
 * Reads unread Gmail messages and sends CRM customer
 * messages through the existing AI recovery pipeline.
 */
router.post('/process-unread', async (req, res) => {
  try {
    const limit = Number(req.body?.limit || 10);

    const result =
      await processUnreadGmail(limit);

    res.json(result);

  } catch (error) {

    console.error(
      '[GMAIL] Inbox processing error:',
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/*
 * POST /api/gmail/send-reply
 *
 * Sends the human-approved AI recovery response
 * through the connected Gmail account.
 */
router.post('/send-reply', async (req, res) => {

  try {

    const {
      customer_id,
      to,
      subject,
      body
    } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Missing recipient email.'
      });
    }

    if (!body) {
      return res.status(400).json({
        success: false,
        error: 'Missing email body.'
      });
    }

    const gmail =
      await getGmailClient();

    const raw =
      createRawEmail(
        to,
        subject ||
          'Payment Recovery Update',
        body
      );

    const result =
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw
        }
      });

    console.log(
      '[GMAIL] Recovery reply sent:',
      result.data.id
    );

    res.json({
      success: true,
      message: 'Recovery reply sent successfully via Gmail.',
      gmail_message_id: result.data.id,
      customer_id: customer_id || null,
      to
    });

  } catch (error) {

    console.error(
      '[GMAIL] Send reply error:',
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


module.exports = router;
