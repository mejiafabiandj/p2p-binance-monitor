const sendMessage = require("./telegram.js");
const sql = require("./sql.js");
const cron = require('node-cron');
const express = require('express');
const https = require("https");

app = express();

sql.initDB();


// Schedule tasks to be run on the server.
cron.schedule("*/20 * * * * *", function() {
    console.log("running at " + (new Date).toString());

    //get prices for buy
    getPrices({
        fiat: "COP",
        operation: "BUY",
        ticker: "USDT"
    });

    //get sale prices
    /*
    getPrices({
        fiat: "COP",
        operation: "SELL",
        ticker: "USDT"
    });
    */

});

app.listen(3000);

let totalPrices = [];

async function getPrices(answers) {
    totalPrices = [];
    const firstPage = await fetchP2PData(
        1,
        answers.fiat,
        answers.operation,
        answers.ticker
    );

    if (firstPage && firstPage.success) {
        const totalPages = Math.ceil(firstPage.total / 20);
        const pagesToRun = new Array(totalPages - 1).fill(null);
        const totalElements = await pagesToRun.reduce(async(prev, _, idx) => {
            const accData = await prev;
            const page = idx + 2;
            //console.log(`🔍  Fetching page ${page}/${totalPages}`);
            const pageResult = await fetchP2PData(
                page,
                answers.fiat,
                answers.operation,
                answers.ticker
            );
            if (pageResult && pageResult.success) {
                return [...accData, ...pageResult.data];
            }
            return accData;
        }, Promise.resolve(firstPage.data));

        totalElements.map((obj) => {
            //console.log(obj);
            sql.insertPrices(obj)
            totalPrices.push(parseInt(obj.adv.price));
        });

        console.log("Minimun price: " + totalPrices[0]);

        analysePrices();
    }
}

function fetchP2PData(
    page = 1,
    fiat = "COP",
    tradeType = "BUY",
    asset = "USDT"
) {
    return new Promise((resolve, reject) => {
        const baseObj = {
            page,
            rows: 20,
            payTypes: [],
            publisherType: null,
            asset,
            tradeType,
            fiat,
        };

        const stringData = JSON.stringify(baseObj);
        const options = {
            hostname: "p2p.binance.com",
            port: 443,
            path: "/bapi/c2c/v2/friendly/c2c/adv/search",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": stringData.length,
            },
        };

        const req = https.request(options, (res) => {
            let output = "";
            res.on("data", (d) => {
                output += d;
            });

            res.on("end", () => {
                try {
                    const jsonOuput = JSON.parse(output);
                    resolve(jsonOuput);
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on("error", (error) => {
            reject(error);
        });

        req.write(stringData);
        req.end();
    });
}

async function analysePrices() {
    const rows = await sql.getAlerts('-5 days', 'SELL');

    if (rows && rows.length > 0) {
        rows.forEach(row => {
            sql.insertAlert(row.id);

            sql.getPriceByID(row.id, (err, price) => {
                if (err) {
                    console.error(err);
                } else {
                    notifyAlert(price);
                }
            });
        });
    } else {
        console.log("No alerts found");
    }
}

function notifyAlert(price) {
    console.log("notifying: " + price.price + " - price Id: " + price.id);

    sendMessage(
        '💰📉 <b>New Price Alert: Binance P2P</b>\n<b>' + price.asset + ' to ' + price.fiat_unit + '</b>\n' +
        '<b>Price:</b> $' + price.price + '\n' +
        '<b>tradable quantity:</b> ' + price.tradable_quantity + ' ' + price.asset + '\n' +
        '<b>Payment Methods:</b> ' + price.trade_methods + '\n' +
        '<b>Order Limit:</b> ' + price.min_single_trans_amount + ' - ' + price.max_single_trans_amount + ' ' + price.fiat_unit + '\n' +
        '<b>Advertiser:</b> ' + price.nick_name + '\n' +
        '<a href="https://p2p.binance.com/en/advertiserDetail?advertiserNo=' + price.advertiser_no + '">https://p2p.binance.com/en/advertiserDetail?advertiserNo=' + price.advertiser_no + '</a>'
    );
}