const fs = require("fs");
const path = require("path");

const {
  getUnreadEmails,
  markEmailAsRead,
  sendEmail,
  getProfile
} = require("./gmail_service");

const {
  processCustomerMessage
} = require("../../agent/recovery_agent");

const { get } = require("../../db");

const PROCESSED_FILE = path.join(
  __dirname,
  "processed_messages.json"
);


/**
 * ============================================================
 * DUPLICATE MESSAGE PROTECTION
 * ============================================================
 */

function loadProcessedMessages() {
  try {

    if (!fs.existsSync(PROCESSED_FILE)) {
      return {
        processed_message_ids: []
      };
    }

    const data = JSON.parse(
      fs.readFileSync(
        PROCESSED_FILE,
        "utf8"
      )
    );

    if (
      !Array.isArray(
        data.processed_message_ids
      )
    ) {
      return {
        processed_message_ids: []
      };
    }

    return data;

  } catch (error) {

    console.error(
      "[GMAIL] Failed to load processed messages:",
      error.message
    );

    return {
      processed_message_ids: []
    };
  }
}


function saveProcessedMessage(messageId) {

  if (!messageId) return;

  const data =
    loadProcessedMessages();

  if (
    !data.processed_message_ids.includes(
      messageId
    )
  ) {

    data.processed_message_ids.push(
      messageId
    );
  }

  fs.writeFileSync(
    PROCESSED_FILE,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );
}


function hasProcessedMessage(messageId) {

  if (!messageId) {
    return false;
  }

  const data =
    loadProcessedMessages();

  return data.processed_message_ids.includes(
    messageId
  );
}


/**
 * ============================================================
 * EXTRACT EMAIL ADDRESS
 * ============================================================
 */

function extractEmailAddress(from) {

  if (!from) {
    return null;
  }

  const match =
    from.match(/<([^>]+)>/);

  if (match) {

    return match[1]
      .trim()
      .toLowerCase();
  }

  return from
    .trim()
    .toLowerCase();
}


/**
 * ============================================================
 * SELF EMAIL PROTECTION
 * ============================================================
 *
 * The connected Gmail account sends the AI replies.
 *
 * Because the test setup sends email to the same Gmail
 * account, Gmail can make the agent's own sent reply
 * appear as an unread message.
 *
 * We must NEVER process our own messages as customer
 * messages.
 */

async function isOwnGmailMessage(email) {

  try {

    const profile =
      await getProfile();

    const accountEmail =
      profile.emailAddress
        ?.trim()
        .toLowerCase();

    const senderEmail =
      extractEmailAddress(
        email.from
      );

    if (
      !accountEmail ||
      !senderEmail
    ) {
      return false;
    }

    return (
      senderEmail ===
      accountEmail
    );

  } catch (error) {

    console.error(
      "[GMAIL] Failed to determine connected Gmail account:",
      error.message
    );

    /*
     * Fail open here so a temporary profile
     * lookup problem does not accidentally
     * block legitimate customer messages.
     */
    return false;
  }
}


/**
 * ============================================================
 * FIND CRM CUSTOMER
 * ============================================================
 */

async function findCustomerByEmail(email) {

  if (!email) {
    return null;
  }

  const normalizedEmail =
    email
      .trim()
      .toLowerCase();


  /*
   * Normal CRM lookup.
   */

  const customer =
    await get(
      `
        SELECT *
        FROM customers
        WHERE LOWER(email) = ?
        LIMIT 1
      `,
      [normalizedEmail]
    );


  if (customer) {
    return customer;
  }


  /*
   * DEVELOPMENT TEST ONLY
   *
   * Allows the connected Gmail test account
   * to act as CUST-1001.
   */

  if (
    normalizedEmail ===
    "vikaspolisetty2006@gmail.com"
  ) {

    const testCustomer =
      await get(
        `
          SELECT *
          FROM customers
          WHERE id = ?
          LIMIT 1
        `,
        ["CUST-1001"]
      );

    return (
      testCustomer ||
      null
    );
  }

  return null;
}


/**
 * ============================================================
 * PROCESS ONE GMAIL MESSAGE
 * ============================================================
 */

async function processGmailMessage(email) {

  /*
   * ========================================================
   * SELF-MESSAGE PROTECTION
   * ========================================================
   */

  if (
    await isOwnGmailMessage(email)
  ) {

    console.log(
      "[GMAIL AUTO] Own Gmail message skipped:",
      email.id
    );

    /*
     * Mark the agent's own message as read.
     *
     * This prevents the same sent message from
     * being discovered again on the next scan.
     */

    try {

      await markEmailAsRead(
        email.id
      );

    } catch (error) {

      console.error(
        "[GMAIL AUTO] Failed to mark own message as read:",
        error.message
      );
    }

    return {

      success: true,

      skipped: true,

      reason:
        "Message was sent by the connected Gmail account.",

      email: {

        id:
          email.id,

        thread_id:
          email.thread_id,

        message_id:
          email.message_id ||
          null,

        from:
          email.from,

        subject:
          email.subject
      }
    };
  }


  /*
   * ========================================================
   * DUPLICATE PROTECTION
   * ========================================================
   */

  if (
    hasProcessedMessage(
      email.id
    )
  ) {

    console.log(
      "[GMAIL AUTO] Duplicate message skipped:",
      email.id
    );

    return {

      success: true,

      skipped: true,

      reason:
        "Gmail message was already processed.",

      email: {

        id:
          email.id,

        thread_id:
          email.thread_id,

        message_id:
          email.message_id ||
          null,

        subject:
          email.subject
      }
    };
  }


  /*
   * ========================================================
   * EXTRACT SENDER
   * ========================================================
   */

  const senderEmail =
    extractEmailAddress(
      email.from
    );


  if (!senderEmail) {

    return {

      success: false,

      skipped: true,

      reason:
        "Could not determine sender email.",

      email
    };
  }


  /*
   * ========================================================
   * FIND CUSTOMER
   * ========================================================
   */

  const customer =
    await findCustomerByEmail(
      senderEmail
    );


  if (!customer) {

    return {

      success: false,

      skipped: true,

      reason:
        "Sender is not a CRM customer.",

      sender_email:
        senderEmail,

      subject:
        email.subject
    };
  }


  /*
   * ========================================================
   * CHECK EMAIL BODY
   * ========================================================
   */

  if (!email.message) {

    return {

      success: false,

      skipped: true,

      reason:
        "Email has no readable text.",

      customer_id:
        customer.id
    };
  }


  /*
   * ========================================================
   * BUILD AI CONTEXT
   * ========================================================
   */

  const context = {

    customer_id:
      customer.id,

    message:
      email.message,

    customer_name:
      customer.company_name,

    contact_person:
      customer.contact_person,

    preferred_language:
      customer.preferred_language,

    preferred_communication_tone:
      customer.preferred_communication_tone,

    late_payment_count:
      customer.late_payment_count,

    payment_behavior_notes:
      customer.payment_behavior_notes
  };


  /*
   * ========================================================
   * LOG CUSTOMER MESSAGE
   * ========================================================
   */

  console.log("");

  console.log(
    "========================================"
  );

  console.log(
    "GMAIL CUSTOMER MESSAGE"
  );

  console.log(
    "========================================"
  );

  console.log(
    "Customer:",
    customer.company_name
  );

  console.log(
    "Customer ID:",
    customer.id
  );

  console.log(
    "From:",
    senderEmail
  );

  console.log(
    "Subject:",
    email.subject
  );

  console.log(
    "Gmail Message ID:",
    email.id
  );

  console.log("");


  /*
   * ========================================================
   * AI RECOVERY AGENT
   * ========================================================
   */

  const result =
    await processCustomerMessage(
      context
    );


  /*
   * ========================================================
   * AUTOMATIC AI REPLY
   * ========================================================
   */

  const outboundMessage =
    result.analysis
      ?.suggested_response ||
    null;

  let gmailReply =
    null;


  if (outboundMessage) {

    try {

      gmailReply =
        await sendEmail({

          to:
            customer.email,

          subject:
            email.subject
              ? (
                email.subject
                  .toLowerCase()
                  .startsWith("re:")
                  ? email.subject
                  : `Re: ${email.subject}`
              )
              : "Payment Recovery Update",

          body:
            outboundMessage,

          /*
           * Keep the reply attached
           * to the original Gmail thread.
           */

          inReplyTo:
            email.message_id ||
            null,

          references:
            email.message_id ||
            null
        });


      console.log(
        "[GMAIL AUTO] Recovery reply sent:",
        gmailReply.id
      );


      console.log(
        "[GMAIL AUTO] Reply thread:",
        gmailReply.threadId
      );


    } catch (sendError) {

      console.error(
        "[GMAIL AUTO] Failed to send recovery reply:",
        sendError.message
      );
    }

  } else {

    console.log(
      "[GMAIL AUTO] No AI response generated; no reply sent."
    );
  }


  /*
   * ========================================================
   * RECORD MESSAGE AS PROCESSED
   * ========================================================
   */

  saveProcessedMessage(
    email.id
  );


  console.log(
    "[GMAIL AUTO] Message recorded as processed:",
    email.id
  );


  /*
   * ========================================================
   * MARK CUSTOMER MESSAGE AS READ
   * ========================================================
   */

  await markEmailAsRead(
    email.id
  );


  console.log(
    "[GMAIL] Customer email processed and marked as read:",
    email.id
  );


  /*
   * ========================================================
   * RETURN RESULT
   * ========================================================
   */

  return {

    success: true,

    skipped: false,

    email: {

      id:
        email.id,

      thread_id:
        email.thread_id,

      message_id:
        email.message_id ||
        null,

      from:
        email.from,

      subject:
        email.subject
    },


    customer: {

      id:
        customer.id,

      company_name:
        customer.company_name,

      contact_person:
        customer.contact_person,

      email:
        customer.email
    },


    analysis:
      result.analysis,

    decision:
      result.decision,

    state:
      result.state,

    outbound_message:
      outboundMessage,


    gmail_reply:
      gmailReply
        ? {

          success:
            true,

          id:
            gmailReply.id,

          threadId:
            gmailReply.threadId

        }

        : null
  };
}


/**
 * ============================================================
 * PROCESS UNREAD GMAIL MESSAGES
 * ============================================================
 */

async function processUnreadGmail(
  maxResults = 10
) {

  const emails =
    await getUnreadEmails(
      maxResults
    );

  const results = [];


  for (
    const email of emails
  ) {

    try {

      const result =
        await processGmailMessage(
          email
        );

      results.push(
        result
      );

    } catch (error) {

      console.error(
        "[GMAIL AUTO] Failed to process email:",
        error.message
      );


      results.push({

        success:
          false,

        skipped:
          false,

        error:
          error.message,

        email: {

          id:
            email.id,

          from:
            email.from,

          subject:
            email.subject
        }
      });
    }
  }


  return {

    success:
      true,

    scanned:
      emails.length,

    processed:
      results.filter(
        r =>
          r.success &&
          !r.skipped
      ).length,

    skipped:
      results.filter(
        r =>
          r.skipped
      ).length,

    results
  };
}


module.exports = {

  extractEmailAddress,

  findCustomerByEmail,

  processGmailMessage,

  processUnreadGmail
};