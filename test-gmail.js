const { getUnreadEmails } = require("./integrations/gmail/gmail_service");

async function main() {
  try {
    const emails = await getUnreadEmails(5);

    console.log("UNREAD EMAILS:", emails.length);

    emails.forEach((email, index) => {
      console.log("");
      console.log(`--- EMAIL ${index + 1} ---`);
      console.log("FROM:", email.from);
      console.log("SUBJECT:", email.subject);
      console.log("MESSAGE:", email.message.slice(0, 500));
    });
  } catch (error) {
    console.error("GMAIL READ ERROR:", error.message);
  }
}

main();