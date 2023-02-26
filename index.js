const express = require('express');
const app = express();
const xrpl = require("xrpl");
var cors = require('cors');
const asyncHandler = require('express-async-handler');
const { json } = require('body-parser');
app.use(cors());
app.use(json())

const userDetails =[{"name":"Ajin Venu","mobile":9633194654,"publicKey":"r4aa7XbH8PUyHGC9zHnXJ9vDBdpUd2Ak4G" },{"name":"Aiswarya S","mobile":9633194655,"publicKey":"r4aa7XbH8PUyHGC9zHnXJ9vDBdpUd2Ak4G" }]

app.post('/', asyncHandler(async function (req, res) {
    console.log("reachees", req.body);
    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233");
    await client.connect();

    const response = await client.request({
        command: "account_info",
        account: "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe",
        ledger_index: "validated",
    });
    // console.log(response);

    client.disconnect();

    res.status(200).send({ "message": response })


}));

app.post('/getAccount', asyncHandler(async (req, res) => {
    const net = req.body.net
    const client = new xrpl.Client(net)
    await client.connect()
    let faucetHost = null
    // -----------------------------------Create and fund a test account wallet
    const my_wallet = (await client.fundWallet(null, { faucetHost })).wallet

    // -----------------------------------Get the current balance.
    const my_balance = (await client.getXrpBalance(my_wallet.address))

    client.disconnect()
    console.log(my_balance, my_wallet);
    res.status(200).send({ my_balance, my_wallet })
}))

app.post('/getAccountFromSeeds', asyncHandler(async (req, res) => {
    console.log(req.body);
    const net = req.body.net
    const seeds = req.body.seeds;
    const client = new xrpl.Client(net)
    await client.connect()
    const standby_wallet = xrpl.Wallet.fromSeed(seeds);
    const standby_balance = (await client.getXrpBalance(standby_wallet.address))
    client.disconnect();
    res.status(200).send({ standby_balance, standby_wallet });
    // const operational_wallet = xrpl.Wallet.fromSeed(lines[1])
}))

app.post('/sendXrp', asyncHandler(async (req, res) => {
    console.log(req.body);
    const client = new xrpl.Client(req.body.net)
    await client.connect()
    const standby_wallet = xrpl.Wallet.fromSeed(req.body.standbySeedField)
    // const operational_wallet = xrpl.Wallet.fromSeed(req.body.operationalSeedField)
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
    stand_balance = client.getXrpBalance(standby_wallet.address)
    // operational_balance = client.getXrpBalance(operational_wallet.address)
    const tx_balance =xrpl.getBalanceChanges(tx.result.meta)
    client.disconnect()
    res.status(200).send({stand_balance,operational_balance,tx_balance})
}))

app.get('/getUser', (req, res) => {
    console.log(req.query);
    let result =userDetails.filter(data=>{
        return data.mobile.toString().startsWith(req.query.number)
    })
    console.log(result);
    res.status(200).send({message:'',user:result});
});
app.listen(3000, () => {
    console.log("server started at port 3000");
})