export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();

    const name = formData.get("name");
    const email = formData.get("email");
    const txn = formData.get("txn");
    const product = formData.get("product");
    const file = formData.get("screenshot");
    const token = formData.get("cf-turnstile-response"); // Turnstile token

    // ===========================
    // BASIC FIELD CHECK
    // ===========================
    if (!name || !email || !txn || !file || !product || !token) {
      return new Response("Missing fields", { status: 400 });
    }

    // ===========================
    // TURNSTILE VERIFICATION
    // ===========================
    const TURNSTILE_SECRET = context.env.TURNSTILE_SECRET_KEY;

    if (!TURNSTILE_SECRET) {
      return new Response("Turnstile secret not configured", { status: 500 });
    }

    const verifyResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `secret=${TURNSTILE_SECRET}&response=${token}`
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.success) {
      return new Response("Captcha verification failed", { status: 403 });
    }

    // ===========================
    // FILE VALIDATION (SERVER)
    // ===========================
    const allowedTypes = ["image/jpeg", "image/png"];
    const maxSize = 1 * 1024 * 1024; // 1MB

    if (!allowedTypes.includes(file.type)) {
      return new Response("Only JPG and PNG images are allowed", { status: 400 });
    }

    if (file.size > maxSize) {
      return new Response("File size exceeds 1MB limit", { status: 400 });
    }

    // ===========================
    // FILE CONVERSION
    // ===========================
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    const base64File = btoa(binary);

    // ===========================
    // EMAIL CONFIG
    // ===========================
    const BREVO_API_KEY = context.env.BREVO_API_KEY;

    if (!BREVO_API_KEY) {
      return new Response("BREVO_API_KEY not set", { status: 500 });
    }

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
        subject: `UPI Payment - ${product}`,
        htmlContent: `
          <h3>UPI Payment Details</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Tools:</strong> ${product}</p>
          <p><strong>Transaction ID:</strong> ${txn}</p>
        `,
        attachment: [{
          content: base64File,
          name: file.name
        }]
      })
    });

    const result = await response.text();
    console.log("Brevo response:", result);

    if (!response.ok) {
      return new Response("Email failed: " + result, { status: 500 });
    }

    return new Response("Success", { status: 200 });

  } catch (err) {
    return new Response("Server error: " + err.message, { status: 500 });
  }
}
