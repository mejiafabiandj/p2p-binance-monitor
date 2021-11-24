const sqlite3 = require('sqlite3');
const fs = require('fs');

var db;

function initDB() {
    let file = "./db/prices.db";
    db = new sqlite3.Database(file);
    if (!fs.existsSync(file)) {
        console.log("creating database file");
        fs.openSync(file, "w");
        createTables(db)

        console.log("database initialized");
    }
}

function createTables(newdb) {
    newdb.exec(`
    create table if not exists prices (
        id text primary key not null,
        trade_type text not null,
        asset text not null,
        fiat_unit text not null,
        price DOUBLE PRECISION not null,
        tradable_quantity DOUBLE PRECISION not null,
        trade_methods text,
		timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        max_single_trans_amount DOUBLE PRECISION,
        min_single_trans_amount DOUBLE PRECISION,
        nick_name text,
        advertiser_no text
    );
    create table if not exists alerts (
		id text primary key not null REFERENCES prices (id),
		time_reported TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);
	`, () => {
        //nothing to do
    });
}


function insertPrices(record) {
    let methods = record.adv.tradeMethods ? record.adv.tradeMethods.map(function(elem) {
        return elem.identifier;
    }).join(",") : null;

    db.run(
        `INSERT INTO prices (id, trade_type, asset, fiat_unit, price, tradable_quantity, trade_methods, max_single_trans_amount, min_single_trans_amount, nick_name, advertiser_no)
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS(SELECT 1 FROM prices WHERE id = ?);
        `, [record.adv.advNo, record.adv.tradeType, record.adv.asset, record.adv.fiatUnit, record.adv.price, record.adv.tradableQuantity, methods, record.adv.maxSingleTransAmount, record.adv.minSingleTransAmount, record.advertiser.nickName, record.advertiser.userNo, record.adv.advNo]);
}

function getAlerts(time, trade_type = 'SELL') {
    return new Promise((resolve, reject) => {
        db.all(
            `
            with orderedList AS (
                SELECT
                    id,
                    price,
                    timestamp,
                    ROW_NUMBER() OVER (ORDER BY price) AS row_n
                FROM prices
                WHERE timestamp > datetime('now',?)
					and trade_type = ?
                ),
                iqr AS (
                SELECT
                    price,
                    id,
                    timestamp,
                    (
                        SELECT price AS quartile_break
                        FROM orderedList
                        WHERE row_n = cast ( ((SELECT COUNT(*) FROM prices)*0.75) as int ) + ( ((SELECT COUNT(*) FROM prices)*0.75) > cast ( ((SELECT COUNT(*) FROM prices)*0.75) as int ))			
                    ) AS q_three,
                    (
                        SELECT price AS quartile_break
                        FROM orderedList
                        WHERE row_n = cast ( ((SELECT COUNT(*) FROM prices)*0.25) as int ) + ( ((SELECT COUNT(*) FROM prices)*0.25) > cast ( ((SELECT COUNT(*) FROM prices)*0.25) as int ))
                    ) AS q_one
                    FROM orderedList
                )
                
				SELECT id
                FROM iqr
                where price < (q_one - (1*(q_three - q_one)))
                    and not EXISTS (select 1 from alerts where alerts.id = iqr.id)
                order by timestamp desc
            ;
            `, [time, trade_type], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
    });
}

function insertAlert(id) {
    if (id) {
        db.run(
            `INSERT INTO alerts (id)
        SELECT ?
        WHERE NOT EXISTS(SELECT 1 FROM alerts WHERE id = ?);
        `, [id, id], (err) => {
                if (err) {
                    console.error(err);
                }
            });
    } else {
        console.error("Could not insert an alert: id param not defined");
    }
}

function getPriceByID(id, callback) {
    if (id) {
        db.get(`SELECT * FROM prices WHERE id = ?;`, id, callback);
    } else {
        console.error("Could not get a price: id param not defined");
    }

}

module.exports = {
    initDB,
    insertPrices,
    getAlerts,
    insertAlert,
    getPriceByID
};