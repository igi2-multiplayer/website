export async function onRequestPost(context) {
  try {
    const request = context.request;
    const data = await request.json();

    const token = data["cf-turnstile-response"];

    if (!data.name || !data.email || !data.subject || !data.message || !token) {
      return new Response("Missing fields", { status: 400 });
    }

    // ✅ Verify Turnstile
    const verify = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${context.env.TURNSTILE_SECRET_KEY}&response=${token}`
    });

    const result = await verify.json();

    if (!result.success) {
      return new Response("Bot verification failed", { status: 400 });
    }


    // 🔐 Basic HTML escape (security)
    const escapeHTML = (str) =>
      str.replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[m]));

    const BREVO_API_KEY = context.env.BREVO_API_KEY;

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          email: "igi2.homecoming@gmail.com",
          name: "Homecoming Gaming"
        },
        to: [{
          email: "igi2.homecoming@gmail.com"
        }],

        // ✅ So reply button replies to user
        replyTo: {
          email: data.email,
          name: data.name
        },

        subject: data.subject,

        htmlContent: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:Arial,sans-serif;">

  <div style="width:100%;padding:40px 0;background-color:#f4f6f8;">
    
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#2b6df6,#00bfff);padding:35px 20px;text-align:center;color:#ffffff;">
        
        <img src="https://igi2multiplayer.pages.dev/logo.png" 
             alt="Homecoming Gaming"
             style="width:70px;margin-bottom:15px;display:block;margin-left:auto;margin-right:auto;">

        <h2 style="margin:0;font-size:22px;">
          Homecoming Gaming
        </h2>

      </div>

      <!-- Content -->
      <div style="padding:30px 25px;color:#333333;font-size:14px;line-height:1.6;">

        <p><strong>Name:</strong> ${escapeHTML(data.name)}</p>

        <p><strong>Email:</strong> 
          <a href="mailto:${escapeHTML(data.email)}" style="color:#2b6df6;text-decoration:none;">
            ${escapeHTML(data.email)}
          </a>
        </p>

        <p><strong>Subject:</strong> ${escapeHTML(data.subject)}</p>

        <div style="margin-top:18px;padding:18px;background:#f1f3f6;border-radius:8px;">
          ${escapeHTML(data.message).replace(/\n/g, "<br>")}
        </div>

      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:22px;background:#f0f2f5;font-size:12px;color:#777777;">
        © ${new Date().getFullYear()} Homecoming Gaming — All Rights Reserved<br><br>
        <a href="https://igi2multiplayer.pages.dev" style="color:#2b6df6;text-decoration:none;">
          Visit our Website
        </a>
        &nbsp;|&nbsp;
        <a href="mailto:igi2.homecoming@gmail.com" style="color:#2b6df6;text-decoration:none;">
          Contact Support
        </a>
      </div>

    </div>

  </div>

</body>
</html>
        `
      })
    });

    if (!response.ok) {
      return new Response("Failed to send email", { status: 500 });
    }

    return new Response("Email sent successfully", { status: 200 });

  } catch (err) {
    return new Response("Server error: " + err.message, { status: 500 });
  }
}
