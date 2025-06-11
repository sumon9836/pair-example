/*const express = require('express');
const fs = require('fs');
const pino = require('pino');
const NodeCache = require('node-cache');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require('baileys');
const { upload } = require('./mega');
const { Mutex } = require('async-mutex');
const config = require('./config');
const path = require('path');

var app = express();
var port = 3000;
var session;
const msgRetryCounterCache = new NodeCache();
const mutex = new Mutex();
app.use(express.static(path.join(__dirname, 'static')));

async function connector(Num, res) {
    var sessionDir = './session';
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir);
    }
    var { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    session = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }).child({ level: 'fatal' }))
        },
      //  printQRInTerminal: false,
        logger: pino({ level: 'fatal' }).child({ level: 'fatal' }),
        browser: Browsers.macOS("Safari"), //check docs for more custom options
        markOnlineOnConnect: true, //true or false yoour choice
        msgRetryCounterCache
    });

    if (!session.authState.creds.registered) {
        await delay(1500);
        Num = Num.replace(/[^0-9]/g, '');
        var code = await session.requestPairingCode(Num);
        if (!res.headersSent) {
            res.send({ code: code?.match(/.{1,4}/g)?.join('-') });
        }
    }

    session.ev.on('creds.update', async () => {
        await saveCreds();
    });

    session.ev.on('connection.update', async (update) => {
        var { connection, lastDisconnect } = update;
        if (connection === 'open') {
            console.log('Connected successfully');
            await delay(5000);
            var myr = await session.sendMessage(session.user.id, { text: `${config.MESSAGE}` });
            var pth = './session/creds.json';
            try {
                var url = await upload(pth);
                var sID;
                if (url.includes("https://mega.nz/file/")) {
                    sID = config.PREFIX + url.split("https://mega.nz/file/")[1];
                } else {
                    sID = 'Fekd up';
                }
              //edit this you can add ur own image in config or not ur choice
              await session.sendMessage(session.user.id, { image: { url: `${config.IMAGE}` }, caption: `*Session ID*\n\n${sID}` }, { quoted: myr });
            
            } catch (error) {
                console.error('Error:', error);
            } finally {
                //await delay(500);
                if (fs.existsSync(path.join(__dirname, './session'))) {
                    fs.rmdirSync(path.join(__dirname, './session'), { recursive: true });
                }
            }
        } else if (connection === 'close') {
            var reason = lastDisconnect?.error?.output?.statusCode;
            reconn(reason);
        }
    });
}

function reconn(reason) {
    if ([DisconnectReason.connectionLost, DisconnectReason.connectionClosed, DisconnectReason.restartRequired].includes(reason)) {
        console.log('Connection lost, reconnecting...');
        connector();
    } else {
        console.log(`Disconnected! reason: ${reason}`);
        session.end();
    }
}

app.get('/pair', async (req, res) => {
    var Num = req.query.code;
    if (!Num) {
        return res.status(418).json({ message: 'Phone number is required' });
    }
  
  //you can remove mutex if you dont want to queue the requests
    var release = await mutex.acquire();
    try {
        await connector(Num, res);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "fekd up"});
    } finally {
        release();
    }
});

app.listen(port, () => {
    console.log(`Running on PORT:${port}`);
});
*/
const express = require('express');
const fs = require('fs');
const pino = require('pino');
const NodeCache = require('node-cache');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require('baileys');
const { upload } = require('./mega');
const { Mutex } = require('async-mutex');
const config = require('./config');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000; // ✅ Required for Render
const sessionDir = './session';
let session;
const msgRetryCounterCache = new NodeCache();
const mutex = new Mutex();

app.use(express.static(path.join(__dirname, 'static')));

// ✅ Optional health check for Render
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

async function connector(Num, res) {
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    session = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        browser: Browsers.macOS("Safari"),
        logger: pino({ level: 'silent' }),
        markOnlineOnConnect: true,
        msgRetryCounterCache
    });

    if (!session.authState.creds.registered) {
        await delay(1500);
        Num = Num.replace(/\D/g, '');
        try {
            const code = await session.requestPairingCode(Num);
            if (!res.headersSent) {
                return res.send({ code: code?.match(/.{1,4}/g)?.join('-') || 'Invalid' });
            }
        } catch (err) {
            console.error("Error generating pairing code:", err);
            if (!res.headersSent) res.status(500).json({ error: "Failed to generate pairing code" });
        }
    }

    session.ev.on('creds.update', saveCreds);

    session.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
            console.log('[✓] Connected successfully.');
            try {
                await delay(3000);
                const welcomeMsg = await session.sendMessage(session.user.id, { text: config.MESSAGE });

                const credPath = path.join(sessionDir, 'creds.json');
                if (!fs.existsSync(credPath)) throw new Error("Credentials file not found");

                const url = await upload(credPath);
                const sID = url.includes("https://mega.nz/file/")
                    ? config.PREFIX + url.split("https://mega.nz/file/")[1]
                    : 'Upload failed';

                await session.sendMessage(session.user.id, {
                    image: { url: config.IMAGE },
                    caption: `*Session ID*\n\n${sID}`
                }, { quoted: welcomeMsg });

            } catch (err) {
                console.error('Error while handling successful connection:', err);
            } finally {
                if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
            }
        } else if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode || 0;
            handleDisconnect(reason);
        }
    });
}

function handleDisconnect(reason) {
    if ([DisconnectReason.connectionLost, DisconnectReason.connectionClosed, DisconnectReason.restartRequired].includes(reason)) {
        console.log('[!] Disconnected unexpectedly, reconnecting...');
        connector(); // Be careful if reconnecting without phone number
    } else {
        console.log(`[X] Disconnected with reason: ${reason}`);
        if (session?.end) session.end();
    }
}

app.get('/pair', async (req, res) => {
    const Num = req.query.code;
    if (!Num) {
        return res.status(400).json({ error: 'Phone number is required as ?code=xxxxxxxxxx' });
    }

    const release = await mutex.acquire();
    try {
        await connector(Num, res);
    } catch (err) {
        console.error("Pairing error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Internal server error during pairing" });
    } finally {
        release();
    }
});

app.listen(port, () => {
    console.log(`🟢 Server running on PORT: ${port}`);
});
