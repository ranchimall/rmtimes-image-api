import { google } from "googleapis";
import { Readable } from "stream";

const auth = new google.auth.GoogleAuth({
  credentials: {
    project_id: process.env.GOOGLE_PROJECT_ID,
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/drive"],
});

export default async function handler(req, res) {

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Only POST allowed",
    });
  }

  try {

    const drive = google.drive({
      version: "v3",
      auth,
    });

    const {
      fileName,
      mimeType,
      base64,
    } = req.body;

    const buffer = Buffer.from(base64, "base64");

    const uniqueName =
      Date.now() + "_" + fileName;

    const imageStream = Readable.from(buffer);

    const file = await drive.files.create({
      requestBody: {
        name: uniqueName,
        parents: [
          process.env.GOOGLE_DRIVE_FOLDER_ID
        ],
      },
      media: {
        mimeType,
        body: imageStream,
      },
      supportsAllDrives: true, // Crucial: Tells Google to use shared folder quota
      fields: "id",
    });

    const fileId = file.data.id;

    await drive.permissions.create({
      fileId,
      supportsAllDrives: true, // Crucial: Allows setting permissions on shared drive files
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    return res.status(200).json({
      success: true,
      fileId,
      url:
        "https://drive.google.com/uc?export=view&id=" +
        fileId,
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });

  }

}
