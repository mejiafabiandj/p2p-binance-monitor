# p2p-binance-monitor


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
