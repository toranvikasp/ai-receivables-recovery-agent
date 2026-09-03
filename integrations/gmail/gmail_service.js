const { getGmailClient } = require("./gmail_auth");

function decodeBase64Url(data) {
    if (!data) return "";

    return Buffer.from(
        data
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
        "base64"
    ).toString("utf8");
}

function findTextPart(payload) {
    if (!payload) return "";

    // Plain text body
    if (
        payload.mimeType === "text/plain" &&
        payload.body &&
        payload.body.data
    ) {
        return decodeBase64Url(payload.body.data);
    }

    // Multipart message
    if (Array.isArray(payload.parts)) {
        for (const part of payload.parts) {
            const text = findTextPart(part);

            if (text) {
                return text;
            }
        }
    }

    return "";
}

function getHeader(headers, name) {
    const header = (headers || []).find(
        h => h.name.toLowerCase() === name.toLowerCase()
    );

    return header ? header.value : "";
}

function parseEmail(message) {
    const payload = message.payload || {};

    const headers = payload.headers || [];

    return {
        id: message.id,
        thread_id: message.threadId,

        from: getHeader(headers, "From"),
        to: getHeader(headers, "To"),
        subject: getHeader(headers, "Subject"),
        date: getHeader(headers, "Date"),

        message: findTextPart(payload).trim()
    };
}

async function getUnreadEmails(maxResults = 10) {
    const gmail = await getGmailClient();

    const response = await gmail.users.messages.list({
        userId: "me",
        q: "is:unread",
        maxResults
    });

    const messages = response.data.messages || [];

    const emails = [];

    for (const item of messages) {
        const result = await gmail.users.messages.get({
            userId: "me",
            id: item.id,
            format: "full"
        });

        emails.push(parseEmail(result.data));
    }

    return emails;
}

async function getEmail(messageId) {
    const gmail = await getGmailClient();

    const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full"
    });

    return parseEmail(response.data);
}

/* ============================================================
   MARK GMAIL MESSAGE AS READ
   ============================================================ */

async function markEmailAsRead(messageId) {
    if (!messageId) {
        throw new Error("Gmail message ID is required.");
    }

    const gmail = await getGmailClient();

    await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
            removeLabelIds: ["UNREAD"]
        }
    });

    return {
        success: true,
        id: messageId
    };
}

function createRawEmail({
    to,
    subject,
    body,
    inReplyTo,
    references
}) {
    const lines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "MIME-Version: 1.0"
    ];

    if (inReplyTo) {
        lines.push(`In-Reply-To: ${inReplyTo}`);
    }

    if (references) {
        lines.push(`References: ${references}`);
    }

    lines.push("");
    lines.push(body);

    return lines.join("\r\n");
}

async function sendEmail({
    to,
    subject,
    body,
    inReplyTo = null,
    references = null
}) {
    if (!to) {
        throw new Error("Recipient email is required.");
    }

    if (!subject) {
        throw new Error("Email subject is required.");
    }

    if (!body) {
        throw new Error("Email body is required.");
    }

    const gmail = await getGmailClient();

    const rawEmail = createRawEmail({
        to,
        subject,
        body,
        inReplyTo,
        references
    });

    const encodedMessage = Buffer.from(rawEmail)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
            raw: encodedMessage
        }
    });

    return {
        success: true,
        id: response.data.id,
        threadId: response.data.threadId
    };
}

async function getProfile() {
    const gmail = await getGmailClient();

    const response =
        await gmail.users.getProfile({
            userId: "me"
        });

    return response.data;
}

module.exports = {
    getUnreadEmails,
    getEmail,
    markEmailAsRead,
    sendEmail,
    getProfile
};