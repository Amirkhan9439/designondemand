const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors")({origin: true});
const crypto = require("crypto");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const user = functions.config().design.user;     // e.g. "example@gmail.com"
const pass = functions.config().design.password; // e.g. "myAppPassword"
const app = express();
admin.initializeApp(); // Uses default credentials for Firestore, Storage, etc.

// Create Express app, configure middleware

app.use(express.json({limit: "50mb"}));
app.use(cors);

// Create references
const db = admin.firestore();
const bucket = admin.storage().bucket();

// Setup Nodemailer with your Gmail
const mailTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: user,
    pass: pass,
  },
});

// A reusable function for sending email with Nodemailer
async function sendEmailNodemailer(params) {
  const {
    from,
    to,
    subject,
    body,
    html,
    toName,
    attachments,
    cc,
    bcc
  } = params;

  try {
    let mailOptions = {
      from: from || `"DesignOnDemand" <${user}>`,
      to,
      subject
    };

    if (cc) mailOptions.cc = cc;
    if (bcc) mailOptions.bcc = bcc;

    if (html) mailOptions.html = html;
    if (body) mailOptions.text = body;

    if (attachments && attachments.length > 0) {
      mailOptions.attachments = attachments.map(att => ({
        filename: att.filename,
        content: Buffer.from(att.base64content, "base64"),
        contentType: att.contentType || "application/pdf",
      }));
    }

    await mailTransport.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Failed to send email via Nodemailer. Error:", error.message);
    return false;
  }
}

// Helper for uploading a base64 PDF/file to Cloud Storage & returning a public URL
async function uploadFile({base64FileString, filename, contentType = "application/pdf"}) {
  try {
    const fileBuffer = Buffer.from(base64FileString, "base64");
    const file = bucket.file(filename);

    await file.save(fileBuffer, {
      metadata: {
        contentType,
        cacheControl: "public, max-age=31536000",
      },
    });
    await file.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    console.log("File uploaded, public URL:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error uploading base64 file:", error);
    throw new Error(error.message);
  }
}
app.post("/test3", async (req, res) => {
  const docRef = db.collection("users").doc(`test3`);
  docRef.set({abc: "owoe"});
  return res.status(200).send("success");
});
app.post("/test2", async (req, res) => {
  console.log("DEBUG /test body =>", req.body);
  const {n, e} = req.body;
  const docRef = db.collection("users").doc(`woerowe`);
  docRef.set({abc: "owoe"});
  return res.status(200).send("success");
});
app.post("/test1", async (req, res) => {
  console.log("DEBUG /test body =>", req.body);
  const {n, e} = req.body;
  const docRef = db.collection("users").doc(`aeooe`);
  docRef.set({abc: e});
  return res.status(200).send("success");
});
app.post("/test", async (req, res) => {
  console.log("DEBUG /test body =>", req.body);
  const {n, e} = req.body;
  const docRef = db.collection("users").doc(`${n}`);
  docRef.set({abc: e});
  return res.status(200).send("success");
});
// ============== 1) /login route ==============
app.post("/login", async (req, res) => {
  try {
    const { uid, name, email } = req.body;
    if (!uid) {
      return res.status(400).json({ error: "No UID found" });
    }
    // Ensure user doc exists (create/update)
    const userDocRef = db.collection("users").doc(uid);
    await userDocRef.set({ name, email });
    // Now fetch only the user's projects
    const snapshot = await db
      .collection("projects")
      .where("userId", "==", uid)
      .get();

    const projects = {};
    snapshot.forEach((doc) => {
      projects[doc.id] = doc.data();
    });
    return res.status(200).json({ projects });
  } catch (error) {
    console.error("Error in /login route:", error);
    return res.status(500).json({ error: `Error: ${error.message}` });
  }
});

// ============== 2) /sendContact route ==============
// Receives { name, email, phone, message } to send as an email to realak9439@gmail.com
app.post("/sendContact", async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email || !phone || !message) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const mailOptions = {
      from: `"Contact Form" <${email}>`,
      to: "realak9439@gmail.com",
      subject: `Contact Form - ${name}`,
      text: `
Name: ${name}
Email: ${email}
Phone: ${phone}
Message: ${message}
      `,
    };

    await mailTransport.sendMail(mailOptions);
    console.log("Sent contact email from:", email);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Error in /sendContact:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ============== 3) /createProject route ==============
// Accepts { uid, name, email, sections } and builds an invoice, stores to Firestore, emails user & admin
app.post("/createProject", async (req, res) => {
  try {
    const { uid, name, email, sections } = req.body;
    if (!uid || !name || !email || !sections) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1) Generate random 8-char string
    const randomId = crypto.randomBytes(4).toString("hex");

    // 2) Build project data
    const projectData = {
      userId: uid,
      userName: name,
      userEmail: email,
      sections,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      progress: [{ timeStamp: `${Date.now()}`, status: "Order Recieved" }],
      invoiceURL: "", // We'll fill it in after uploading PDF
    };

    // 3) Save doc => projects/{randomId}
    await db.collection("projects").doc(randomId).set(projectData);

    // 4) Build invoice from template
    const templatePath = path.join(__dirname, "assets", "template.html");
    let html = fs.readFileSync(templatePath, "utf8");

    // Flatten subsections into a single table
    let serviceRows = "";
    let grandTotal = 0;
    let indexCounter = 1;

    sections.forEach((sec) => {
      sec.subsections.forEach((sub) => {
        const price = Number(sub.price) || 0;
        const vat = Number(sub.vatPercent) || 0;
        const total = price + (price * vat / 100);
        grandTotal += total;

        serviceRows += `
          <tr>
            <td>${indexCounter}</td>
            <td>${sub.title} - ${sub.subtitle || ""}</td>
            <td>${price.toFixed(2)}</td>
            <td>${vat}%</td>
            <td>${total.toFixed(2)}</td>
          </tr>
        `;
        indexCounter++;
      });
    });

    // Format date
    const now = new Date();
    const invoiceDate = now.toLocaleString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });

    // Replace placeholders
    html = html
      .replace(/{invoice.invoiceNumber}/g, randomId)
      .replace(/{invoice.invoiceDate}/g, invoiceDate)
      .replace(/{invoice.client.name}/g, name)
      .replace(/{invoice.client.email}/g, email)
      .replace(/{invoice.currency}/g, "AED")
      .replace(/{invoice.invoiceProject}/g, "Project " + randomId)
      .replace(/{invoice.total}/g, grandTotal.toFixed(2))
      .replace(/{invoice.email}/g, email)
      // service provider placeholders
      .replace(/{invoice.serviceProvider.name}/g, "DesignOnDemand");

    // Insert dynamic service rows
    html = html.replace("<!-- More rows as needed -->", serviceRows);

    // 6) Generate PDF
    const map = { html };
    let pdfBase64 = "";
    try {
      const response = await axios.post("https://util.racdayinsure.com/htmlToPdf", map);
      pdfBase64 = response.data;
    } catch (error) {
      console.error("Error generating PDF:", error);
      return res.status(500).json({ error: "PDF generation error" });
    }

    // 7) Upload PDF to Cloud Storage
    const filename = `invoices/${randomId}.pdf`;
    let invoiceURL = "";
    try {
      invoiceURL = await uploadFile({
        base64FileString: pdfBase64,
        filename,
        contentType: "application/pdf",
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      return res.status(500).json({ error: "File upload error" });
    }

    // 8) Update doc with invoiceURL
    await db.collection("projects").doc(randomId).update({ invoiceURL });

    // 9) Email PDF to user & admin
    const attachments = [
      {
        base64content: pdfBase64,
        filename: `${randomId}.pdf`,
        contentType: "application/pdf",
      },
    ];

    const subject = `Invoice for Project ${randomId}`;
    const plainBody = `Dear ${name}, please find attached the invoice for your project ${randomId}.`;
    const htmlBody = `<p>Dear ${name},</p>
      <p>Please find attached the invoice for your project <strong>${randomId}</strong>.</p>
      <p>Regards,<br/>DesignOnDemand</p>`;

    // Send to user
    await sendEmailNodemailer({
      to: email,
      subject,
      body: plainBody,
      html: htmlBody,
      attachments,
    });

    // Also send to admin
    await sendEmailNodemailer({
      to: "realak9439@gmail.com",
      subject,
      body: plainBody,
      html: htmlBody,
      attachments,
    });

    return res.json({
      message: "Project created, invoice generated and emailed successfully.",
      projectId: randomId,
      invoiceURL,
    });
  } catch (error) {
    console.error("Error in createProjectHandler:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ============== 4) /getAdminData (GET) ==============
// Returns all projects, merges user doc info (name/email)
app.get("/getAdminData", async (req, res) => {
  try {
    const projectsSnap = await db.collection("projects").get();
    const projects = [];

    for (const doc of projectsSnap.docs) {
      const projectData = doc.data();
      const userId = projectData.userId || null;

      let userDoc = null;
      if (userId) {
        userDoc = await db.collection("users").doc(userId).get();
      }

      if (userDoc && userDoc.exists) {
        const userData = userDoc.data();
        projectData.userName = userData.name || "";
        projectData.userEmail = userData.email || "";
      }

      projects.push({
        projectId: doc.id,
        ...projectData,
      });
    }

    return res.status(200).json({ projects });
  } catch (error) {
    console.error("Error in /getAdminData:", error);
    return res.status(500).json({ error: error.message });
  }
});

// ============== 5) /updateStatus (POST) ==============
// Body: { projectId, status, paid (optional boolean) }
app.post("/updateStatus", async (req, res) => {
  try {
    const { projectId, status, paid } = req.body;
    if (!projectId || !status) {
      return res
        .status(400)
        .json({ error: "Missing projectId or status" });
    }

    const projectRef = db.collection("projects").doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return res.status(404).json({ error: "Project not found" });
    }

    const projectData = projectSnap.data();

    // Append new progress item
    const newProgressItem = {
      timeStamp: `${Date.now()}`,
      status,
    };

    const oldProgress = Array.isArray(projectData.progress)
      ? projectData.progress
      : [];

    oldProgress.push(newProgressItem);

    // If "paid" param is present
    let paidObj = {};
    if (typeof paid === "boolean") {
      paidObj.paid = paid;
    }

    // Update doc
    await projectRef.update({
      progress: oldProgress,
      ...paidObj,
    });

    // Possibly fetch user email if not stored in doc
    let userEmail = projectData.userEmail;
    if (!userEmail && projectData.userId) {
      const userDoc = await db.collection("users").doc(projectData.userId).get();
      if (userDoc.exists) {
        userEmail = userDoc.data().email;
      }
    }

    // Send status update email to user
    if (userEmail) {
      const mailOptions = {
        from: `"DesignOnDemand" <${user}>`,
        to: userEmail,
        subject: `Project ${projectId} Status Updated`,
        text: `Hello,

Your project status has been updated to: "${status}"

Thank you,
DesignOnDemand`,
      };
      await mailTransport.sendMail(mailOptions);
    }

    return res.status(200).json({
      message: "Status updated successfully",
      updatedProgress: newProgressItem,
      paid: typeof paid === "boolean" ? paid : "unchanged",
    });
  } catch (error) {
    console.error("Error in /updateStatus:", error);
    return res.status(500).json({ error: error.message });
  }
});

// Finally export the Express app as an HTTP function
exports.api = functions.https.onRequest(app);
