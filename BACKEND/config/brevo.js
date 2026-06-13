import axios from "axios";

export const sendEmail = async (options) => {
  const { from, to, subject, html, text, attachments } = options;

  // 1. Parse recipients
  let recipients = [];
  if (Array.isArray(to)) {
    recipients = to.map(email => ({ email: email.trim() }));
  } else if (typeof to === "string") {
    recipients = to.split(",").map(email => ({ email: email.trim() })).filter(Boolean);
  }

  // 2. Parse sender
  let senderName = "HRMS System";
  let senderEmail = process.env.BREVO_SENDER_EMAIL;
  
  if (from) {
    const fullMatch = from.match(/^"?([^"<]*)"?\s*<([^>]+)>/);
    if (fullMatch) {
      const namePart = fullMatch[1].trim();
      const emailPart = fullMatch[2].trim();
      if (namePart) senderName = namePart;
      if (emailPart) senderEmail = emailPart;
    } else if (from.includes("@")) {
      senderEmail = from.trim();
    }
  }

  // 3. Format attachments
  const brevoAttachments = [];
  if (attachments && Array.isArray(attachments)) {
    for (const att of attachments) {
      let base64Content = "";
      if (Buffer.isBuffer(att.content)) {
        base64Content = att.content.toString("base64");
      } else if (typeof att.content === "string") {
        if (att.content.includes("base64,")) {
          base64Content = att.content.split("base64,")[1];
        } else {
          base64Content = att.content;
        }
      }
      brevoAttachments.push({
        name: att.filename,
        content: base64Content
      });
    }
  }

  // 4. Construct payload
  const payload = {
    sender: {
      name: senderName,
      email: senderEmail
    },
    to: recipients,
    subject: subject,
  };

  if (html) {
    payload.htmlContent = html;
  }
  if (text) {
    payload.textContent = text;
  }
  if (brevoAttachments.length > 0) {
    payload.attachment = brevoAttachments;
  }

  // 5. Send POST request to Brevo API
  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      throw new Error("BREVO_API_KEY is not defined in the environment variables.");
    }

    console.log("📨 [Brevo Diagnostics] Outgoing payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post("https://api.brevo.com/v3/smtp/email", payload, {
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      }
    });

    // console.log("📩 [Brevo Diagnostics] Response data:", JSON.stringify(response.data, null, 2));

    return {
      messageId: response.data.messageId,
      response: "250 OK"
    };
  } catch (error) {
    console.error("❌ Brevo API Error:", error.response ? error.response.data : error.message);
    throw error;
  }
};

export default sendEmail;
