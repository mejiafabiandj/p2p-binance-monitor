const sendMessage = require("./telegram.js");
const sql = require("./sql.js");
const cron = require('node-cron');
const express = require('express');
const https = require("https");

app = express();

sql.initDB();


// Schedule tasks to be run on the server.
cron.schedule("0,20,40 * * * * *", function() {
    //get prices for buy
    getPrices({
        fiat: "COP",
        operation: "BUY",
        ticker: "USDT"
    });
});

cron.schedule("10,30,50 * * * * *", function() {
    //get sale prices
    getPrices({
        fiat: "COP",
        operation: "SELL",
        ticker: "USDT"
    });
});

app.listen(3000);

async function getPrices(answers) {
    console.log(answers.operation + " Analysis running at " + (new Date).toString());

    var totalPrices = [];
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

        if (answers.operation == "BUY") {
            console.log("Minimun Buy price: " + totalPrices[0]);
        } else {
            console.log("Maximum Sale price: " + totalPrices[0]);
        }


        analysePrices(answers.operation);
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

async function analysePrices(operation) {
    const rows = await sql.getAlerts('-5 days', operation == 'BUY' ? 'SELL' : 'BUY');

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
        //console.log("No alerts found");
    }
}

function notifyAlert(price) {

    sql.getAlertByID(price.id, (err, alert) => {
        if (err) {
            console.error(err);
        } else {
            if (alert.silent) {
                console.log("Alert not send - ommiting notification due las alert time: " + price.price + " - price Id: " + price.id);
            } else {
                console.log("notifying: " + price.price + " - price Id: " + price.id);
                sendMessage(
                    '💰' + (price.trade_type == 'SELL' ? '📉' : '📈') + ' <b>New Price Alert: Binance P2P</b>\n' +
                    '<b>Time to: ' + (price.trade_type == 'SELL' ? 'BUY' : 'SELL') + ' ' + price.asset + ' / ' + price.fiat_unit + '</b>\n' +
                    '<b>Price:</b> $' + price.price + '\n' +
                    '<b>tradable quantity:</b> ' + price.tradable_quantity + ' ' + price.asset + '\n' +
                    '<b>Payment Methods:</b> ' + price.trade_methods + '\n' +
                    (price.min_single_trans_amount ? '<b>Order Limit:</b> ' + price.min_single_trans_amount + ' - ' + price.max_single_trans_amount + ' ' + price.fiat_unit + '\n' : '') +
                    (price.advertiser_no ? '<b>Advertiser:</b> <a href="https://p2p.binance.com/en/advertiserDetail?advertiserNo=' + price.advertiser_no + '">' + price.nick_name + '</a>' : '')
                );
            }
        }
    });

}