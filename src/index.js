require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');

const IPFS = require('ipfs');
const OrbitDB = require('orbit-db');
const uuid = require('uuid/v4');

const ipfsPath = process.env.IPFS_PATH || `${process.env.HOME}/.ipfs`;
const ipfsBootstrap = process.env.IPFS_BOOTSTRAP || '';
const dbPath = process.env.DB_PATH || `${process.env.HOME}/.orbitdb`;
const dbName = process.env.DB_NAME || "inmutable-db";
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

    const db = await orbitdb.eventlog(dbName, {
        write: ['*'],
    });
    await db.load()

    // Listen for updates from peers
    db.events.on('replicated', (address) => {
        console.log('Replicated: ', address);
    });

    console.log("OrbitDB Database address: ", db.address.toString());
    try {
        app.post('/api/v1/posts', (req, res) => {
            let post = Object.assign(req.body, { _id: uuid() });
            return db.add(post)
                .then(function (hash) {
                    post = Object.assign({ _hash: hash}, post);
                    res.send(post);
                })
        })
    
        app.get('/api/v1/posts', (req, res) => {
            const items = db.iterator({ limit: -1 }).collect();
            items.forEach(element => {
                console.log(element.payload.value)
            });
           return res.send(items)
        });
    
        app.get('/api/v1/posts/:hash', (req, res) => { 
            const item = db.get(req.params.hash).payload.value;
            console.log(item);
            return res.send(item);
        });            
    } catch (error) {
        console.log(error)
    }

    app.listen(port, () => console.log(`Listening on port ${port}...`));
})