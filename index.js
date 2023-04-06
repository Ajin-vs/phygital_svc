'use strict'
const express = require('express');
const app = express();
const xrpl = require("xrpl");
var cors = require('cors');
const asyncHandler = require('express-async-handler');
const { json } = require('body-parser');
const moment = require('moment/moment');
const { response } = require('express');
const cc = require('five-bells-condition')
const crypto = require('crypto')
const fs = require('fs');
const path = require('path');
app.use(cors());
app.use(json())


const userDetails = [{ "name": "Ajin Venu", "mobile": 9633194654, "publicKey": "r4aa7XbH8PUyHGC9zHnXJ9vDBdpUd2Ak4G" }]
const pinDetails = [{ "mobile": 9748636760, "cbcdPin": 1234, "pSeed": 'sEdSqU1ifnZaS11TDYdF2RUdhABJfHv' }]

const net = "wss://s.devnet.rippletest.net:51233"
app.post('/getAccountInfo', asyncHandler(async function (req, res) {
    const client = new xrpl.Client("wss://s.devnet.rippletest.net:51233");
    await client.connect();
    let pKey = req.body.pKey
    const response = await client.request({
        command: "account_info",
        account: pKey,
        ledger_index: "validated",
    });
    // console.log(response);

    client.disconnect();

    res.status(200).send({ "message": response })


}));

app.get('/generateKeyPair', asyncHandler(async function (req, res) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        // The standard secure default length for RSA keys is 2048 bits
        modulusLength: 2048,

        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    const verifiableData = "this need to be verified";

    // The signature method takes the data we want to sign, the
    // hashing algorithm, and the padding scheme, and generates
    // a signature in the form of bytes
    const signature = crypto.sign("sha256", Buffer.from(verifiableData), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    });

    console.log(signature.toString("base64"), "signature");
    fs.writeFileSync(path.join(__dirname, 'privatekey.txt'), privateKey);
    fs.writeFileSync(path.join(__dirname, 'publickey.txt'), publicKey);



    res.status(200).send({ publicKey})
}))
app.get('/sign', asyncHandler(async function (req, res) {
    const privateKey =fs.readFileSync(path.join(__dirname, 'privatekey.txt'));
    // console.log(privateKey,"privateKet");
    const verifiableData = "this need to be verified";
    const signature = crypto.sign("sha256", Buffer.from(verifiableData), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    });

    console.log(signature.toString("base64"));
    fs.writeFileSync(path.join(__dirname, 'signature.txt'),JSON.stringify(signature))
    res.status(200).send(JSON.stringify({sign:signature}));



    
}))

app.get('/verify', asyncHandler(async function (req, res) {
    const verifiableData = "this need to be verified";
    const publicKey = fs.readFileSync(path.join(__dirname, 'publickey.txt'));
    const bufferObj=fs.readFileSync(path.join(__dirname, 'signature.txt'));
    let signa = JSON.parse(bufferObj)
    let signature = Buffer.from(signa, "utf8");
    console.log(signature);
    const isVerified = crypto.verify(
        "sha256",
        Buffer.from(verifiableData),
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        },
        signature
      );
      
      // isVerified should be `true` if the signature is valid
      console.log("signature verified: ", isVerified);
      
    res.status(200).send(signature.toString("base64"));
}))

app.post('/getAccount', asyncHandler(async (req, res) => {
    const client = new xrpl.Client(net)
    await client.connect()
    let faucetHost = null
    // -----------------------------------Create and fund a test account wallet
    const my_wallet = (await client.fundWallet(null, { faucetHost })).wallet

    // -----------------------------------Get the current balance.
    const my_balance = (await client.getXrpBalance(my_wallet.address))

    client.disconnect()
    res.status(200).send({ my_balance, my_wallet })
}))


app.post('/getAccountFromSeeds', asyncHandler(async (req, res) => {
    const seeds = req.body.seeds;
    const client = new xrpl.Client(net)
    await client.connect()
    const standby_wallet = xrpl.Wallet.fromSeed(seeds);
    const standby_balance = (await client.getXrpBalance(standby_wallet.address))
    client.disconnect();
    res.status(200).send({ standby_balance, standby_wallet });
    // const operational_wallet = xrpl.Wallet.fromSeed(lines[1])
}))
app.get('/balance', asyncHandler(async (req, res) => {
    const seeds = req.query.pSeed
    const client = new xrpl.Client(net)
    await client.connect()
    const standby_wallet = xrpl.Wallet.fromSeed(seeds);
    const standby_balance = (await client.getXrpBalance(standby_wallet.address))

    client.disconnect();
    res.status(200).send({ standby_balance });
    // const operational_wallet = xrpl.Wallet.fromSeed(lines[1])
}))

app.post('/sendXrp', asyncHandler(async (req, res) => {
    let operational_balance
    const client = new xrpl.Client(net)
    await client.connect()
    const standby_wallet = xrpl.Wallet.fromSeed(req.body.standbySeedField)
    const sendAmount = req.body.standbyAmountField
    const prepared = await client.autofill({
        "TransactionType": "Payment",
        "Account": standby_wallet.address,
        "Amount": xrpl.xrpToDrops(sendAmount),
        "Destination": req.body.standbyDestinationField
    })
    const signed = standby_wallet.sign(prepared)

    // -------------------------------------------------------- Submit signed blob
    const tx = await client.submitAndWait(signed.tx_blob)
    const stand_balance = client.getXrpBalance(standby_wallet.address)
    // operational_balance = client.getXrpBalance(operational_wallet.address)
    const tx_balance = xrpl.getBalanceChanges(tx.result.meta)
    client.disconnect()
    res.status(200).send({ stand_balance, operational_balance, tx_balance })

}))

app.get('/getUser', (req, res) => {
    let result = userDetails.filter(data => {
        return data.mobile.toString().startsWith(req.query.number)
    })
    res.status(200).send({ message: '', user: result });
});

app.get('/verifyPin', (req, res) => {
    let response = pinDetails.filter((data => {
        return (data.mobile == req.query.mobile) && (data.cbcdPin == req.query.cbdcPin)
    }))

    if (response.length > 0) {
        res.status(200).send({ message: "Validated" })
    } else {
        res.status(200).send({ message: "Invalid Pin" })
    }
})

app.get('/getTxRequest', asyncHandler(async function (req, res) {
    try {
        const client = new xrpl.Client(net);
        await client.connect();
        const pKey = req.query.pKey
        const response = await client.request({
            command: "account_tx",
            account: pKey,
        });
        let amount = xrpl.dropsToXrp(1000000);
        client.disconnect();
        res.status(200).send({ "message": response })

    } catch (error) {
        console.log(error);
    }


}));




app.post('/createEscrow', asyncHandler(async function (req, res, next) {
    let escrow = req.body.escrow;
    const seed = req.body.pSeed;
    const cust_otp = escrow.otp;
    const secret = Buffer.allocUnsafe(4);

    secret.writeInt32BE(cust_otp, 0);
    // Construct condition and fulfillment ---------------------------------------
    // const preimageData = crypto.randomBytes(32);
    const myFulfillment = new cc.PreimageSha256();
    myFulfillment.setPreimage(secret);
    const conditionHex = myFulfillment.getConditionBinary().toString('hex').toUpperCase();
    // const fullfillment = myFulfillment.serializeBinary().toString('hex').toUpperCase()

    // Connect -------------------------------------------------------------------
    const client = new xrpl.Client(net);
    await client.connect();

    // Prepare wallet to sign the transaction -------------------------------------
    const wallet = await xrpl.Wallet.fromSeed(seed);

    // Set the escrow finish time --------------------------------------------------
    let finishAfter = new Date((new Date().getTime() / 1000) + 60); // 1 minutes from now
    let cancelAfter = new Date((new Date().getTime() / 1000) + 120); // 2 minutes from now
    cancelAfter = new Date(cancelAfter * 1000);
    finishAfter = new Date(finishAfter * 1000);

    const escrowCreateTransaction = {
        "TransactionType": "EscrowCreate",
        "Account": wallet.address,
        "Destination": wallet.address,
        "Amount": xrpl.xrpToDrops(escrow.amount), //drops XRP
        "DestinationTag": 2023,
        "Condition": conditionHex,
        // "Fulfillment":myFulfillment.serializeBinary().toString('hex').toUpperCase(),
        "Fee": "12",
        // "FinishAfter":xrpl.isoTimeToRippleTime(finishAfter.toISOString()),
        "CancelAfter": xrpl.isoTimeToRippleTime(cancelAfter.toISOString()), // Refer for more details: https://xrpl.org/basic-data-types.html#specifying-time
    };
    xrpl.validate(escrowCreateTransaction);

    // Sign and submit the transaction --------------------------------------------
    const response = await client.submitAndWait(escrowCreateTransaction, { wallet });

    await client.disconnect();
    res.status(200).send(response.result)
}))

app.get('/lookUpEscrow', asyncHandler(async function (req, res, next) {
    const pKey = req.query.pKey
    const client = new xrpl.Client(net);
    await client.connect();
    let escrowLookUps = await client.request({

        "command": "account_objects",
        "account": pKey,
        "ledger_index": "validated",
        "type": "escrow"

    })
    client.disconnect();
    res.status(200).send(escrowLookUps)
}))

app.post('/cancelEscrow', asyncHandler(async function (req, res, next) {
    const seed = req.body.pSeed;
    const sequenceNumber = req.body.escrow.sequence;
    // Connect -------------------------------------------------------------------
    const client = new xrpl.Client(net);
    await client.connect();

    // Prepare wallet to sign the transaction -------------------------------------
    const wallet = await xrpl.Wallet.fromSeed(seed);


    // Construct the escrow cancel transaction ------------------------------------

    if (!sequenceNumber) {
        throw new Error("Please specify the sequence number of the escrow you created");
    };

    const escrowCancelTransaction = {
        "Account": wallet.address,
        "TransactionType": "EscrowCancel",
        "Owner": wallet.address,
        "OfferSequence": sequenceNumber, // Sequence number
    };

    xrpl.validate(escrowCancelTransaction);

    // Sign and submit the transaction --------------------------------------------
    const response = await client.submitAndWait(escrowCancelTransaction, { wallet });

    await client.disconnect();
    res.status(200).send(response.result)


}))

app.get('/finishEscrow', asyncHandler(async function (req, res, next) {

    const seed = "sEdSFvqSN51N6PmrY2Zdqy6uJ51FfFn";
    const cust_otp = 987;
    const secret = Buffer.allocUnsafe(4);

    secret.writeInt32BE(cust_otp, 0);
    // Construct condition and fulfillment ---------------------------------------
    // const preimageData = crypto.randomBytes(32);
    const myFulfillment = new cc.PreimageSha256();
    myFulfillment.setPreimage(secret);
    const condition = myFulfillment.getConditionBinary().toString('hex').toUpperCase();
    const fulfillment = myFulfillment.serializeBinary().toString('hex').toUpperCase()
    const offerSequence = 26361036;
    // const condition = "A0258020C5384AC71EDBD53A993D6038D5548DD5C6ECB9F90DB790C5525F4F2CD850BFF2810120";
    const client = new xrpl.Client(net);
    await client.connect();

    // Prepare wallet to sign the transaction -------------------------------------
    const wallet = await xrpl.Wallet.fromSeed(seed);


    if ((!offerSequence) || (condition === "")) {
        throw new Error("Please specify the sequence number, condition and fulfillment of the escrow you created");
    };

    const escrowFinishTransaction = {
        "Account": wallet.address,
        "TransactionType": "EscrowFinish",
        "Owner": wallet.address,
        // This should equal the sequence number of the escrow transaction
        "OfferSequence": offerSequence,
        // Crypto condition that must be met before escrow can be completed, passed on escrow creation
        "Condition": condition,
        // // Fulfillment of the condition, passed on escrow creation
        "Fulfillment": fulfillment,
    };

    xrpl.validate(escrowFinishTransaction);

    // Sign and submit the transaction --------------------------------------------
    const response = await client.submit(escrowFinishTransaction, { wallet });

    await client.disconnect();
    res.status(200).send(response.result)


}))

app.post('/submitOfflineXrp', asyncHandler(async function (req, res, next) {
    let operational_balance
    const signed = req.body.signed;
    const client = new xrpl.Client(net)
    await client.connect();
    // console.log(signed);
    // -------------------------------------------------------- Submit signed blob
    const tx = await client.submit(signed)
    // const stand_balance = client.getXrpBalance(standby_wallet.address)
    // // operational_balance = client.getXrpBalance(operational_wallet.address)
    // const tx_balance = xrpl.getBalanceChanges(tx.result.meta)
    client.disconnect()
    res.status(200).send({ message: "done" })
}))

app.listen(3000, () => {
    console.log("server started at port 3000");
})