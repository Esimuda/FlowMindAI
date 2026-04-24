export async function sendSms(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<string> {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }),
    }
  );
  const data = await res.json() as { sid?: string; status?: string; error_message?: string };
  if (!res.ok) throw new Error(data.error_message ?? `Twilio error ${res.status}`);
  return `SMS sent to ${to}. SID: ${data.sid}, Status: ${data.status}`;
}

export async function sendWhatsApp(
  accountSid: string,
  authToken: string,
  from: string,
  to: string,
  body: string
): Promise<string> {
  const whatsappFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
  const whatsappTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: whatsappFrom, To: whatsappTo, Body: body }),
    }
  );
  const data = await res.json() as { sid?: string; status?: string; error_message?: string };
  if (!res.ok) throw new Error(data.error_message ?? `Twilio WhatsApp error ${res.status}`);
  return `WhatsApp message sent to ${to}. SID: ${data.sid}, Status: ${data.status}`;
}
