# p2p-binance-monitor

bot system based on https://github.com/sanchezmarcos/binancio

sends telegram alerts where a new low price is published on https://p2p.binance.com/

![image](https://user-images.githubusercontent.com/3708192/143322030-f200ddab-42c7-4b4c-bc98-89ea39c15d39.png)


## Configuration

1. Change your telegram Bot TOKEN and CHATID params on [src/telegram.js](src/telegram.js)

2. Set your desired Fiat, asset and operation on [index.js](https://github.com/mejiafabiandj/p2p-binance-monitor/blob/19045128ccf756e5236fb13698cc2f585b5f417d/src/index.js#L17)

      ![image](https://user-images.githubusercontent.com/3708192/143322307-7d25d9ab-aec7-4182-bf6c-acb69d9e2c12.png)



## Installation


1. Install dependences

```bash
npm install
```
```bash
sudo ln -s /usr/local/lib/node_modules/forever/bin/forever /usr/bin/forever
sudo npm install forever -g
```

2. run the project

```bash
node src/index.js
```

3. run in background

```bash
forever start src/index.js
```

Get running processes 
```bash
forever list
```

stop running 
```bash
forever stop src/index.js
```
