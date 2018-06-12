require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const IPFS = require('ipfs');
const OrbitDB = require('orbit-db');
const uuid = require('uuid/v4');

const ipfsPath = process.env.IPFS_PATH || `${process.env.HOME}/.ipfs`;
const ipfsBootstrap = process.env.IPFS_BOOTSTRAP || '';
const dbPath = process.env.DB_PATH || `${process.env.HOME}/.orbitdb`;
const dbName = process.env.DB_NAME || "knowledge-db";
const port = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.json());

const ipfsOptions = {
    repo: ipfsPath,
    config: {
        "Bootstrap": ipfsBootstrap.split(',').map((val) => val.trim()).filter((val) => val.length > 0),
    },
    EXPERIMENTAL: {
        pubsub: true,
    }
};

const ipfs = new IPFS(ipfsOptions);

ipfs.on('error', (err) => console.error("IPFS Error: ", err));
ipfs.on('ready', async () => {
    const orbitdb = new OrbitDB(ipfs, dbPath);

    const db = await orbitdb.docstore(dbName, {
        write: ['*'],
    });
    await db.load()

    // Listen for updates from peers
    db.events.on('replicated', (address) => {
        console.log(db.iterator({ limit: -1 }).collect())
    });

    console.log("OrbitDB Database address: ", db.address.toString());

    app.post('/api/v1/posts', (req, res) => {
        const post = Object.assign(req.body, { _id: uuid() });

        return db.put(post)
            .then(() => res.send(JSON.stringify(post)));
    })

    app.get('/api/v1/posts', (req, res) => {
        return res.send(JSON.stringify(db.query(() => true)));
    })

    app.get('/api/v1/posts/:postId', (req, res) => {
        return res.send(JSON.stringify(db.get(req.params.postId)));
    });

    app.listen(port, () => console.log(`Listening on port ${port}...`));
});
