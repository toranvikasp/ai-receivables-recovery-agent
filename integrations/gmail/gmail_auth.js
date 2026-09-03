const fs = require("fs");
const path = require("path");
const http = require("http");
const { google } = require("googleapis");

const CREDENTIALS_PATH = path.join(
    process.cwd(),
    "gmail_credentials.json"
);

const TOKEN_PATH = path.join(
    process.cwd(),
    "token.json"
);

const SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify"
];

function loadCredentials() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        throw new Error(
            `Gmail credentials not found: ${CREDENTIALS_PATH}`
        );
    }

    const credentials = JSON.parse(
        fs.readFileSync(CREDENTIALS_PATH, "utf8")
    );

    return credentials.installed || credentials.web;
}

function createOAuthClient(redirectUri) {
    const config = loadCredentials();

    if (!config) {
        throw new Error("Invalid Google OAuth credentials.");
    }

    return new google.auth.OAuth2(
        config.client_id,
        config.client_secret,
        redirectUri
    );
}

async function authorize() {
    // Reuse saved token
    if (fs.existsSync(TOKEN_PATH)) {
        const config = loadCredentials();

        const oauth2Client = new google.auth.OAuth2(
            config.client_id,
            config.client_secret,
            "http://127.0.0.1"
        );

        const token = JSON.parse(
            fs.readFileSync(TOKEN_PATH, "utf8")
        );

        oauth2Client.setCredentials(token);

        return oauth2Client;
    }

    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const requestUrl = new URL(
                    req.url,
                    "http://127.0.0.1"
                );

                if (requestUrl.pathname !== "/oauth2callback") {
                    res.writeHead(404);
                    res.end("Not found");
                    return;
                }

                const error = requestUrl.searchParams.get("error");

                if (error) {
                    res.writeHead(400, {
                        "Content-Type": "text/html"
                    });

                    res.end(`
            <h2>Gmail authorization failed</h2>
            <p>${error}</p>
            <p>You can close this window.</p>
          `);

                    server.close();

                    reject(
                        new Error(`Google OAuth error: ${error}`)
                    );

                    return;
                }

                const code = requestUrl.searchParams.get("code");

                if (!code) {
                    res.writeHead(400);
                    res.end("Authorization code missing.");
                    return;
                }

                const redirectUri =
                    `http://127.0.0.1:${server.address().port}/oauth2callback`;

                const oauth2Client =
                    createOAuthClient(redirectUri);

                const { tokens } =
                    await oauth2Client.getToken(code);

                oauth2Client.setCredentials(tokens);

                fs.writeFileSync(
                    TOKEN_PATH,
                    JSON.stringify(tokens, null, 2),
                    "utf8"
                );

                res.writeHead(200, {
                    "Content-Type": "text/html"
                });

                res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Gmail Connected</title>
            </head>
            <body style="
              font-family: Arial;
              background: #111827;
              color: white;
              padding: 50px;
              text-align: center;
            ">
              <h1>✅ Gmail Connected</h1>
              <p>AI Receivables Recovery Agent is authorized.</p>
              <p>You can close this browser tab.</p>
            </body>
          </html>
        `);

                server.close();

                console.log(
                    "\n✅ Gmail authorization successful."
                );

                console.log(
                    `Token saved to: ${TOKEN_PATH}`
                );

                resolve(oauth2Client);
            } catch (err) {
                server.close();

                reject(err);
            }
        });

        server.on("error", reject);

        // Listen on a random available local port
        server.listen(0, "127.0.0.1", () => {
            const port = server.address().port;

            const redirectUri =
                `http://127.0.0.1:${port}/oauth2callback`;

            const oauth2Client =
                createOAuthClient(redirectUri);

            const authUrl =
                oauth2Client.generateAuthUrl({
                    access_type: "offline",
                    scope: SCOPES,
                    prompt: "consent",
                    include_granted_scopes: true
                });

            console.log("\n========================================");
            console.log("GMAIL AUTHORIZATION");
            console.log("========================================\n");

            console.log("Open this URL in your browser:\n");
            console.log(authUrl);

            console.log(
                "\nWaiting for Google authorization..."
            );
            console.log(
                `Callback: ${redirectUri}\n`
            );
        });
    });
}

async function getGmailClient() {
    const auth = await authorize();

    return google.gmail({
        version: "v1",
        auth
    });
}

module.exports = {
    authorize,
    getGmailClient
};